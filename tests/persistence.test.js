// 作者：wwj
import test from 'node:test';
import assert from 'node:assert/strict';
import { saveConfiguration } from '../persistence.js';
import { defaultSettings } from '../presets.js';
import { SETTINGS_KEY } from '../settings.js';

function setup() {
    const previous = defaultSettings();
    const next = structuredClone(previous);
    next.variableNames.push('four', 'five');
    const context = { extensionSettings: { [SETTINGS_KEY]: previous }, getRequestHeaders: () => ({}) };
    const response = (settings) => ({ ok: true, json: async () => ({ settings: JSON.stringify({ extension_settings: {
        [SETTINGS_KEY]: settings,
    } }) }) });
    return { previous, next, context, response };
}

test('保存后核对实际落盘配置', async () => {
    const { context, next, response } = setup();
    let stored;
    await saveConfiguration(context, next, async () => { stored = context.extensionSettings[SETTINGS_KEY]; },
        async () => response(stored));
    assert.equal(context.extensionSettings[SETTINGS_KEY], next);
});

test('原生吞掉保存错误或其他请求保存旧配置，均不能误判成功', async () => {
    const { context, next, previous, response } = setup();
    await assert.rejects(saveConfiguration(context, next, async () => {}, async () => response(previous)), /尚未保存/);
    assert.equal(context.extensionSettings[SETTINGS_KEY], previous);
});

test('读取失败或契约缺失时回滚内存配置并报错', async () => {
    for (const reply of [{ ok: false, status: 500 }, { ok: true, json: async () => ({}) }]) {
        const { context, next, previous } = setup();
        await assert.rejects(saveConfiguration(context, next, async () => {}, async () => reply));
        assert.equal(context.extensionSettings[SETTINGS_KEY], previous);
    }
});
