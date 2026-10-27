// 作者：wwj
import { PRESETS, presetGroup } from './presets.js';
import { MAX_GROUPS, MAX_VARIABLES, linesFrom, validateSettings } from './settings.js';
import { button, groupCard, inputField } from './ui-fields.js';

export function createUi(root, { getSettings, commitSettings }) {
    const el = (id) => root.querySelector(`#sir-${id}`);
    let draft = structuredClone(getSettings());
    let controller;
    let working = false;
    let saving = false;

    function updateButtons() {
        el('refresh').disabled = working || saving;
        el('save').disabled = working || saving;
        el('refresh').textContent = working || saving ? '正在保存…' : '立即随机并注入';
    }

    function report(message, level = 'info') {
        el('status').textContent = message;
        el('status').dataset.level = level;
        if (level !== 'info') window.toastr?.[level]?.(message, '随机系统信息', { escapeHtml: true });
    }

    function readDraft() {
        return { schemaVersion: 2, enabled: el('enabled').checked, autoRefresh: el('auto').checked,
            minGroups: Number(el('min-groups').value), maxGroups: Number(el('max-groups').value),
            titles: linesFrom(el('titles').value),
            variableNames: [...el('variables').querySelectorAll('input')].map((input) => input.value.trim()),
            groups: [...el('groups').querySelectorAll('[data-group]')].map((card) => {
                const field = (name) => card.querySelector(`[data-field="${name}"]`);
                return { enabled: field('enabled').checked, name: field('name').value.trim(),
                    headers: linesFrom(field('headers').value), mode: field('mode').value,
                    templates: linesFrom(field('templates').value), length: Number(field('length').value) };
            }) };
    }

    function renderMacros() {
        el('macros').replaceChildren(...draft.variableNames.map((name) => {
            const code = document.createElement('code');
            code.textContent = `{{getvar::${name}}}`;
            return code;
        }));
    }

    function render() {
        el('enabled').checked = draft.enabled;
        el('auto').checked = draft.autoRefresh;
        el('min-groups').value = draft.minGroups;
        el('max-groups').value = draft.maxGroups;
        el('titles').value = draft.titles.join('\n');
        el('variables').replaceChildren(...draft.variableNames.map((name, index) => {
            const row = document.createElement('div');
            row.className = 'sir-variable';
            const remove = button('移除', () => changeStructure(() => draft.variableNames.splice(index, 1)));
            remove.disabled = draft.variableNames.length === 1;
            row.append(inputField(`变量 ${index + 1}`, 'variable', name), remove);
            return row;
        }));
        el('groups').replaceChildren(...draft.groups.map((group, index) => groupCard(group, index,
            (position, delta) => changeStructure(() => {
                const other = position + delta;
                if (other >= 0 && other < draft.groups.length) {
                    [draft.groups[position], draft.groups[other]] = [draft.groups[other], draft.groups[position]];
                }
            }), (position) => changeStructure(() => draft.groups.splice(position, 1)))));
        const lastGroup = el('groups').lastElementChild;
        if (lastGroup) [...lastGroup.querySelectorAll('button')].find((entry) => entry.textContent === '下移').disabled = true;
        el('add-variable').disabled = draft.variableNames.length >= MAX_VARIABLES;
        el('add-group').disabled = draft.groups.length >= MAX_GROUPS;
        renderMacros();
    }

    function changeStructure(change) {
        draft = readDraft();
        change();
        render();
        report('设置尚未保存；点击“保存设置”应用修改');
    }

    async function save(sync = true) {
        if (saving) return false;
        saving = true;
        updateButtons();
        try {
            const next = validateSettings(readDraft());
            await commitSettings(structuredClone(next));
            draft = structuredClone(next);
            renderMacros();
            const synchronized = sync ? await controller.syncCurrent() : true;
            if (sync && synchronized && next.enabled) report('设置已保存；新的候选范围将在下次随机时生效');
            return true;
        } catch (error) {
            report(`${error.message}；已保留上一份有效设置`, 'error');
            return false;
        } finally { saving = false; updateButtons(); }
    }

    function bind(value) {
        controller = value;
        PRESETS.forEach((preset, index) => el('preset').add(new Option(preset.name, String(index))));
        el('preset').add(new Option('空白自定义组', '-1'));
        el('add-variable').addEventListener('click', () => changeStructure(() => {
            if (draft.variableNames.length >= MAX_VARIABLES) return;
            let number = draft.variableNames.length + 1;
            while (draft.variableNames.includes(`system_information_${number}`)) number++;
            draft.variableNames.push(`system_information_${number}`);
        }));
        el('add-group').addEventListener('click', () => changeStructure(() => {
            if (draft.groups.length >= MAX_GROUPS) return;
            const index = Number(el('preset').value);
            draft.groups.push(index >= 0 ? presetGroup(index) : { enabled: true, name: '自定义信息',
                headers: ['Internal Identifier'], templates: ['{{roll::1d9999}}'], mode: 'template', length: 32 });
        }));
        el('save').addEventListener('click', () => save());
        el('refresh').addEventListener('click', async () => {
            if (working) return;
            if (await save(false)) {
                if (getSettings().enabled) await controller.refresh();
                else await controller.syncCurrent();
            }
        });
        root.addEventListener('input', (event) => {
            if (event.target.matches('input, textarea, select')) report('设置尚未保存；点击“保存设置”应用修改');
        });
        render();
    }

    return { bind, report,
        preview: (text) => { el('preview').textContent = text || '当前聊天暂无注入结果'; },
        busy: (value) => {
            working = value;
            updateButtons();
        },
    };
}
