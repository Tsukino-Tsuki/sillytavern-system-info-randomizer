// 作者：wwj
import { defaultSettings, PRESETS, presetGroup } from './presets.js';
import { OS_PRESETS } from './os-presets.js';
import { MAX_GROUPS, validateSettings } from './settings.js';

export function migrateSettings(previous) {
    if (!previous) return defaultSettings();
    if (previous.schemaVersion === 2) return validateSettings(previous);
    if (previous.schemaVersion !== 1) throw new Error('不支持此配置版本');
    const next = structuredClone(previous);
    next.schemaVersion = 2;
    next.minGroups = 4;
    next.maxGroups = 8;
    // 旧版分段已由紧凑输出替代；自定义标头、模板和变量保持原样。
    for (const group of next.groups) delete group.chunk;
    for (const preset of OS_PRESETS) {
        if (next.groups.length >= MAX_GROUPS) break;
        if (!next.groups.some((group) => group.name === preset.name)) {
            next.groups.push(presetGroup(PRESETS.indexOf(preset)));
        }
    }
    return validateSettings(next);
}
