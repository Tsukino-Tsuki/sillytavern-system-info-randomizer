// 作者：wwj
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../presets.js';
import { validateSettings } from '../settings.js';
import { randomIndex, randomIdentifier } from '../random.js';
import { parseTemplate, expandTemplate } from '../templates.js';
import { generateInformation } from '../generator.js';

test('JS 使用拒绝采样消除取模偏差', () => {
    const values = [0xffffffff, 4];
    assert.equal(randomIndex(3, { getRandomValues: (buffer) => { buffer[0] = values.shift(); } }), 1);
    assert.equal(values.length, 0);
});

test('所有预设有效，6类48个标头与6个整段标题', () => {
    const settings = validateSettings(defaultSettings());
    assert.equal(settings.groups.length, 6);
    assert.equal(settings.groups.reduce((count, group) => count + group.headers.length, 0), 48);
    assert.equal(settings.titles.length, 6);
});

test('每组独立选择标头和模板，生成后不含宏且同步输出格式', () => {
    const settings = defaultSettings();
    settings.groups = [{ ...settings.groups[0], headers: ['Alpha', 'Beta:'], templates: ['x', 'y'] }];
    const indexes = [1, 1, 0];
    const text = generateInformation(settings, () => { throw new Error('没有宏不该调用解析器'); }, () => indexes.shift());
    assert.equal(text, 'Internal System Information:\nBeta: x');
});

test('停用的信息组不输出，空标题省略', () => {
    const settings = defaultSettings();
    settings.titles = [];
    settings.groups.forEach((group, index) => { group.enabled = index === 2; });
    const text = generateInformation(settings, () => '', () => 0);
    assert.equal(text, `Build Fingerprint: ${'0'.repeat(64)}`);
});

test('新旧roll规范化后传给原生解析器', () => {
    const passed = [];
    const result = expandTemplate('{{roll::1d9999}} / {{roll 1d999}} / {{random::a,b}} / {{random::a::b}}', (macro) => {
        passed.push(macro); return macro.includes('roll') ? '17' : 'a';
    });
    assert.equal(result, '17 / 17 / a / a');
    assert.deepEqual(passed, ['{{roll 1d9999}}', '{{roll 1d999}}', '{{random::a,b}}', '{{random::a::b}}']);
});

test('拒绝破损、嵌套、有副作用、空候选及非法骰子宏', () => {
    for (const text of ['{{roll} 1d9999}}', '{{roll }} 1d9999}}', '{{roll::0d6}}', '{{roll::1001d6}}',
        '{{roll::1d0}}', '{{random::a::::b}}', '{{setvar::x::1}}', '{{random::{{roll::6}}::b}}', '1d9999}}']) {
        assert.throws(() => parseTemplate(text), undefined, text);
    }
});

test('宏未展开或原生解析返回空串时明确失败', () => {
    assert.throws(() => expandTemplate('{{roll::1d6}}', () => ''), /未能展开/);
    assert.throws(() => expandTemplate('{{roll::1d6}}', (macro) => macro), /未能展开/);
});

test('JS字符数、分段和UUID v4格式正确', () => {
    assert.equal(randomIdentifier('alnum', 11, 4, () => 1), 'bbbb bbbb bbb');
    assert.equal(randomIdentifier('hex', 11, 0, () => 15), 'f'.repeat(11));
    assert.match(randomIdentifier('uuid', 32, 0), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('每次默认结果重抽，候选均来自配置范围', () => {
    const settings = defaultSettings();
    const outputs = new Set(Array.from({ length: 50 }, () => generateInformation(settings, () => '17')));
    assert.equal(outputs.size, 50);
    for (const text of outputs) {
        assert.equal(text.split('\n').length, 7);
        for (const [index, line] of text.split('\n').slice(1).entries()) {
            assert.ok(settings.groups[index].headers.includes(line.split(':')[0]));
        }
    }
});

test('变量重复、空名、宏字符、原型键和超量配置被拒绝', () => {
    for (const names of [[], [''], ['x', 'x'], ['x::y'], ['__proto__'], ['constructor'], Array(6).fill('x')]) {
        const settings = defaultSettings(); settings.variableNames = names;
        assert.throws(() => validateSettings(settings));
    }
});

test('任何候选中的错误都会拒绝配置，不会等随机抽到才发现', () => {
    const settings = defaultSettings();
    settings.groups[0].templates.push('{{roll} 1d4}}');
    assert.throws(() => validateSettings(settings), /第 1 组/);
});
