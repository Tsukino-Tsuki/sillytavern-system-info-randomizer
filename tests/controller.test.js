// 作者：wwj
import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../controller.js';
import { defaultSettings } from '../presets.js';
import { STATE_KEY } from '../settings.js';

function setup() {
    const settings = defaultSettings();
    const messages = [], previews = [];
    let sequence = 0, saved = 0, inGroup = false;
    let ctx = { chatId: 'one', chatMetadata: {}, groupId: null,
        saveMetadata: async () => { saved++; }, substituteParams: (text) => text };
    const controller = createController({ getContext: () => ctx, getSettings: () => settings,
        isGroupGenerating: () => inGroup, generate: () => `result-${++sequence}`,
        report: (text, level) => messages.push({ text, level }), preview: (text) => previews.push(text) });
    return { controller, settings, messages, previews,
        get ctx() { return ctx; }, set ctx(value) { ctx = value; },
        get sequence() { return sequence; }, get saved() { return saved; },
        set inGroup(value) { inGroup = value; } };
}

test('3个变量共享同一次随机结果，扩展到5个不重新抽取', async () => {
    const env = setup();
    await env.controller.refresh();
    assert.deepEqual(Object.values(env.ctx.chatMetadata.variables), Array(3).fill('result-1'));
    env.settings.variableNames.push('four', 'five');
    await env.controller.syncCurrent();
    assert.deepEqual(Object.values(env.ctx.chatMetadata.variables), Array(5).fill('result-1'));
    assert.equal(env.sequence, 1);
});

test('正常生成、重生成、swipe均刷新；continue沿用', async () => {
    const env = setup();
    for (const type of [undefined, 'regenerate', 'swipe']) await env.controller.beforeGeneration(type);
    assert.equal(env.sequence, 3);
    await env.controller.beforeGeneration('continue');
    assert.equal(env.sequence, 3);
});

test('首次continue且没有结果时初始化一次', async () => {
    const env = setup();
    await env.controller.beforeGeneration('continue');
    await env.controller.beforeGeneration('continue');
    assert.equal(env.sequence, 1);
});

test('dryRun、quiet、已中止请求、手动模式和停用不刷新', async () => {
    const env = setup();
    await env.controller.beforeGeneration(undefined, {}, true);
    await env.controller.beforeGeneration('quiet');
    await env.controller.beforeGeneration(undefined, { signal: { aborted: true } });
    env.settings.autoRefresh = false;
    await env.controller.beforeGeneration();
    env.settings.enabled = false;
    await env.controller.refresh();
    assert.equal(env.sequence, 0);
});

test('群聊忽略外层事件，每个实际成员请求刷新一次，包括自动群聊', async () => {
    const env = setup();
    env.ctx.groupId = 'group';
    await env.controller.beforeGeneration();
    assert.equal(env.sequence, 0);
    env.inGroup = true;
    await env.controller.beforeGeneration('group_chat');
    await env.controller.beforeGeneration('group_chat');
    assert.equal(env.sequence, 2);
});

test('聊天切换不复制其他聊天内容，返回时恢复已存快照', async () => {
    const env = setup();
    await env.controller.refresh();
    const first = env.ctx;
    env.ctx = { ...first, chatId: 'two', chatMetadata: {} };
    await env.controller.syncCurrent();
    assert.equal(env.controller.currentText(), '');
    assert.equal(env.ctx.chatMetadata.variables, undefined);
    await env.controller.refresh();
    assert.equal(env.controller.currentText(), 'result-2');
    env.ctx = first;
    await env.controller.syncCurrent();
    assert.equal(env.controller.currentText(), 'result-1');
});

test('变量改名清理旧赋值，但保留被其他功能覆盖的值', async () => {
    const env = setup();
    await env.controller.refresh();
    env.ctx.chatMetadata.variables.system_information_2 = 'external';
    env.settings.variableNames = ['new_name'];
    await env.controller.syncCurrent();
    assert.deepEqual(env.ctx.chatMetadata.variables, { system_information_2: 'external', new_name: 'result-1' });
});

test('停用清除本插件赋值，重新启用恢复快照', async () => {
    const env = setup();
    await env.controller.refresh();
    env.settings.enabled = false;
    await env.controller.syncCurrent();
    assert.deepEqual(env.ctx.chatMetadata.variables, {});
    env.settings.enabled = true;
    await env.controller.syncCurrent();
    assert.equal(env.ctx.chatMetadata.variables.system_information, 'result-1');
});

test('保存失败仍保留本次可读取变量并报告失败', async () => {
    const env = setup();
    env.ctx.saveMetadata = async () => { throw new Error('offline'); };
    assert.equal(await env.controller.refresh(), true);
    assert.equal(env.controller.currentText(), 'result-1');
    assert.match(env.messages.at(-1).text, /保存失败/);
});

test('没有聊天时不创建变量', async () => {
    const env = setup();
    env.ctx.chatId = undefined;
    assert.equal(await env.controller.refresh(), false);
    assert.equal(env.sequence, 0);
});

test('并发刷新共用进行中的保存，不重复生成', async () => {
    const env = setup();
    let finish;
    env.ctx.saveMetadata = () => new Promise((resolve) => { finish = resolve; });
    const first = env.controller.refresh();
    const second = env.controller.refresh();
    assert.equal(env.sequence, 1);
    finish();
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
});

test('保存期间切换聊天不会回写新聊天或更新新预览', async () => {
    const env = setup();
    let finish;
    env.ctx.saveMetadata = () => new Promise((resolve) => { finish = resolve; });
    const promise = env.controller.refresh();
    env.ctx = { ...env.ctx, chatId: 'two', chatMetadata: {} };
    await env.controller.syncCurrent();
    finish();
    await promise;
    assert.equal(env.ctx.chatMetadata[STATE_KEY], undefined);
    assert.equal(env.previews.at(-1), '');
});
