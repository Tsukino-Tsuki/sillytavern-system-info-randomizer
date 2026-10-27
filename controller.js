// 作者：wwj
import { generateInformation } from './generator.js';
import { STATE_KEY, validateSettings } from './settings.js';

function chatContext(getContext) {
    const context = getContext();
    const id = context.getCurrentChatId?.() ?? context.chatId;
    if (id === null || id === undefined || id === '' || !context.chatMetadata) return null;
    return context;
}

export function createController({ getContext, getSettings, isGroupGenerating, report, preview,
    busy = () => {}, generate = generateInformation }) {
    let pending = null;
    const bindings = [];
    const sameChat = (context) => getContext().chatMetadata === context.chatMetadata
        && (getContext().getCurrentChatId?.() ?? getContext().chatId)
        === (context.getCurrentChatId?.() ?? context.chatId);

    function currentText() {
        return chatContext(getContext)?.chatMetadata[STATE_KEY]?.text || '';
    }

    function removeAssignments(context, state, keep = []) {
        const vars = context.chatMetadata.variables;
        if (!vars) return;
        for (const name of state.assignedNames || []) {
            if (!keep.includes(name) && vars[name] === state.text) delete vars[name];
        }
    }

    function assign(context, state, names) {
        removeAssignments(context, state, names);
        const vars = context.chatMetadata.variables ??= {};
        for (const name of names) {
            Object.defineProperty(vars, name, { value: state.text, enumerable: true, writable: true, configurable: true });
        }
        state.assignedNames = [...names];
    }

    async function save(context) {
        try { await context.saveMetadata(); return true; }
        catch (error) {
            if (sameChat(context)) report(`当前内容已在内存中更新，但聊天保存失败：${error.message}`, 'warning');
            return false;
        }
    }

    function refresh() {
        const context = chatContext(getContext);
        if (!context) { report('请先打开一个角色或群聊', 'warning'); return Promise.resolve(false); }
        if (!getSettings().enabled) { report('请先启用插件', 'warning'); return Promise.resolve(false); }
        if (pending?.metadata === context.chatMetadata) return pending.promise;
        let text;
        try {
            text = generate(getSettings(), (template) => context.substituteParams(template));
        } catch (error) {
            const fallback = currentText() ? '已保留当前聊天的上一份结果' : '当前聊天尚无可用结果';
            report(`${error.message}；${fallback}`, 'error');
            return Promise.resolve(false);
        }
        const previous = context.chatMetadata[STATE_KEY];
        if (previous) removeAssignments(context, previous, getSettings().variableNames);
        const state = { text, assignedNames: [], count: (previous?.count || 0) + 1, updatedAt: Date.now() };
        assign(context, state, getSettings().variableNames);
        context.chatMetadata[STATE_KEY] = state;
        preview(text);
        busy(true);
        const job = { metadata: context.chatMetadata, promise: null };
        job.promise = save(context).then((saved) => {
            if (saved && sameChat(context)) report(`已随机生成并同步到 ${state.assignedNames.length} 个变量（${text.length} 字符）`);
            return true;
        }).finally(() => {
            if (pending === job) { pending = null; busy(false); }
        });
        pending = job;
        return job.promise;
    }

    async function syncCurrent() {
        const context = chatContext(getContext);
        preview(currentText());
        busy(Boolean(pending && pending.metadata === context?.chatMetadata));
        if (!context) { report('打开聊天后即可生成和注入'); return; }
        const settings = getSettings();
        const state = context.chatMetadata[STATE_KEY];
        try { validateSettings(settings); }
        catch (error) { report(error.message, 'error'); return; }
        if (state?.text) {
            if (settings.enabled) assign(context, state, settings.variableNames);
            else { removeAssignments(context, state); state.assignedNames = []; }
            if (!await save(context) || !sameChat(context)) return false;
        }
        report(!settings.enabled ? '已停用；当前聊天中由插件写入的变量已清除'
            : state?.text ? '已恢复当前聊天的结果，所有目标变量保持同步'
                : '当前聊天暂无结果；生成时自动准备，也可点击“立即随机并注入”');
        return true;
    }

    async function beforeGeneration(type, options = {}, dryRun = false) {
        const settings = getSettings();
        if (!settings.enabled || !settings.autoRefresh || dryRun || type === 'quiet' || options.signal?.aborted) return;
        // 外层群聊不发模型请求；每个成员实际生成前分别准备一次，覆盖自动群聊。
        if (getContext().groupId != null && !isGroupGenerating()) return;
        if (type === 'continue' && currentText()) return;
        await refresh();
    }

    function bind() {
        const context = getContext();
        const events = context.eventTypes;
        if (!events?.GENERATION_AFTER_COMMANDS || !context.eventSource?.on) throw new Error('当前酒馆缺少生成前事件，请升级酒馆');
        for (const [event, handler] of [[events.GENERATION_AFTER_COMMANDS, beforeGeneration],
            [events.CHAT_CHANGED, syncCurrent]]) {
            context.eventSource.on(event, handler);
            bindings.push([context.eventSource, event, handler]);
        }
    }

    function dispose() {
        for (const [source, event, handler] of bindings.splice(0)) source.removeListener(event, handler);
    }
    return { refresh, syncCurrent, currentText, beforeGeneration, bind, dispose };
}
