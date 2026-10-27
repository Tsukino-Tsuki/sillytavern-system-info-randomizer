// 作者：wwj
import { choose, randomIdentifier, randomIndex, randomSubset } from './random.js';
import { expandTemplate } from './templates.js';
import { validateSettings } from './settings.js';

export function generateInformation(settings, substituteParams, index = randomIndex) {
    validateSettings(settings);
    const lines = [];
    const cleanLabel = (label) => label.trim().replace(/[:：]\s*$/, '');
    if (settings.titles.length) lines.push(`${cleanLabel(choose(settings.titles, index))}:`);
    const selected = randomSubset(settings.groups.filter((entry) => entry.enabled),
        settings.minGroups, settings.maxGroups, index);
    for (const group of selected) {
        const header = cleanLabel(choose(group.headers, index));
        const value = group.mode === 'template'
            ? expandTemplate(choose(group.templates, index), substituteParams)
            : randomIdentifier(group.mode, group.length, index);
        const compact = value.replace(/\s+/gu, '');
        if (!compact) throw new Error(`信息组“${group.name}”生成的内容为空`);
        lines.push(`${header}: ${compact}`);
    }
    const text = lines.join('\n');
    if (text.length > 100000) throw new Error('生成结果超过 100000 字符，请减少信息组或长度');
    return text;
}
