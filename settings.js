// 作者：wwj
import { parseTemplate } from './templates.js';
export const SETTINGS_KEY = 'system-info-randomizer';
export const STATE_KEY = 'systemInfoRandomizer';
export const MAX_VARIABLES = 5;
export const MAX_GROUPS = 30;
const reserved = new Set(['__proto__', 'prototype', 'constructor']);

function checkLines(lines, label, maxLength, allowEmpty = false) {
    if (!Array.isArray(lines) || (!allowEmpty && !lines.length) || lines.length > 200) {
        throw new Error(`${label}需要 1–200 条候选${allowEmpty ? '，也可留空' : ''}`);
    }
    if (lines.some((line) => typeof line !== 'string' || !line.trim()
        || line.length > maxLength || /[\r\n]/.test(line))) {
        throw new Error(`${label}每行不能为空、不能含换行，且最多 ${maxLength} 个字符`);
    }
}

export function validateSettings(settings) {
    if (settings.schemaVersion !== 2) throw new Error('不支持此配置版本');
    if (typeof settings.enabled !== 'boolean' || typeof settings.autoRefresh !== 'boolean') {
        throw new Error('启用和自动刷新设置无效');
    }
    const names = settings.variableNames;
    if (!Array.isArray(names) || !names.length || names.length > MAX_VARIABLES) throw new Error('变量数量须为 1–5 个');
    if (names.some((name) => typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name)
        || reserved.has(name))) throw new Error('变量名须以英文字母或下划线开头，仅含字母、数字、下划线，最多64字符');
    if (new Set(names).size !== names.length) throw new Error('变量名不能重复');
    checkLines(settings.titles, '整段标题', 160, true);
    if (settings.titles.some((line) => /[{}]/.test(line))) throw new Error('整段标题请填写普通文字');
    if (!Array.isArray(settings.groups) || !settings.groups.length || settings.groups.length > MAX_GROUPS) {
        throw new Error('信息组数量须为 1–30 组');
    }
    if (!settings.groups.some((group) => group.enabled)) throw new Error('至少启用一个信息组');
    if (!Number.isInteger(settings.minGroups) || !Number.isInteger(settings.maxGroups)
        || settings.minGroups < 1 || settings.maxGroups > MAX_GROUPS || settings.minGroups > settings.maxGroups) {
        throw new Error('每次抽取数量须为 1–30，且最少不能大于最多');
    }
    settings.groups.forEach((group, index) => {
        const label = `第 ${index + 1} 组`;
        if (typeof group.enabled !== 'boolean' || typeof group.name !== 'string' || !group.name.trim()) {
            throw new Error(`${label}名称或启用设置无效`);
        }
        checkLines(group.headers, `${label}标头`, 160);
        if (group.headers.some((line) => /[{}]/.test(line) || !line.replace(/[:：\s]/g, ''))) {
            throw new Error(`${label}标头请填写普通文字`);
        }
        if (!['template', 'alnum', 'hex', 'uuid'].includes(group.mode)) throw new Error(`${label}生成方式无效`);
        if (!Number.isInteger(group.length) || group.length < 1 || group.length > 4096) {
            throw new Error(`${label}长度须为1–4096`);
        }
        if (group.mode === 'template') {
            checkLines(group.templates, `${label}模板`, 20000);
            try { group.templates.forEach(parseTemplate); }
            catch (error) { throw new Error(`${label}：${error.message}`); }
        }
    });
    return settings;
}

export function linesFrom(text) {
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
