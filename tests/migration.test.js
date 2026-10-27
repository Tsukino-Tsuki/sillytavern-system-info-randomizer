// 作者：wwj
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../presets.js';
import { migrateSettings } from '../migration.js';
import { validateSettings } from '../settings.js';

function legacy() {
    const settings = defaultSettings();
    settings.schemaVersion = 1;
    delete settings.minGroups;
    delete settings.maxGroups;
    settings.groups = settings.groups.slice(0, 6).map((group) => ({ ...group, chunk: 8 }));
    return settings;
}

test('1.0升级保留自定义内容、变量、停用设置，补充新组且不修改源对象', () => {
    const old = legacy();
    old.enabled = false; old.autoRefresh = false;
    old.variableNames = ['custom_metadata']; old.titles = ['My Header'];
    old.groups[0].headers = ['My Version'];
    old.groups[0].templates = ['a {{roll 1d9}} b']; old.groups[0].enabled = false;
    const before = structuredClone(old);
    const next = migrateSettings(old);
    assert.deepEqual(old, before);
    assert.equal(next.schemaVersion, 2);
    assert.equal(next.minGroups, 4); assert.equal(next.maxGroups, 8);
    assert.equal(next.groups.length, 20);
    assert.deepEqual(next.variableNames, old.variableNames);
    assert.deepEqual(next.titles, old.titles);
    assert.equal(next.enabled, false); assert.equal(next.autoRefresh, false);
    assert.deepEqual(next.groups.slice(0, 6), old.groups.map(({ chunk, ...group }) => group));
    assert.equal(validateSettings(next), next);
});

test('升级幂等，用户删除新增预设后不会在重载时自动补回', () => {
    const next = migrateSettings(legacy());
    next.groups.pop();
    next.minGroups = 2; next.maxGroups = 3;
    assert.equal(migrateSettings(next), next);
    assert.equal(next.groups.length, 19);
    assert.equal(next.minGroups, 2);
});

test('接近30组上限时保留原组，只追加可容纳的新组', () => {
    const old = legacy();
    old.groups = Array.from({ length: 29 }, (_, index) => ({ ...structuredClone(old.groups[0]), name: `custom ${index}` }));
    const next = migrateSettings(old);
    assert.equal(next.groups.length, 30);
    assert.deepEqual(next.groups.slice(0, 29).map((group) => group.name), old.groups.map((group) => group.name));
    assert.equal(migrateSettings(next).groups.length, 30);
});

test('已有同名系统组保留自定义内容，未知版本拒绝迁移', () => {
    const old = legacy();
    old.groups[0].name = 'Linux 发行版';
    const next = migrateSettings(old);
    assert.equal(next.groups.filter((group) => group.name === 'Linux 发行版').length, 1);
    assert.deepEqual(next.groups[0].headers, old.groups[0].headers);
    assert.throws(() => migrateSettings({ schemaVersion: 99 }), /不支持/);
    assert.deepEqual(migrateSettings(undefined), defaultSettings());
});
