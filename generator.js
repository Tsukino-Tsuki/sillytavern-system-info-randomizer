// 作者：wwj
import { choose, randomIdentifier, randomIndex } from './random.js';
import { expandTemplate } from './templates.js';
import { validateSettings } from './settings.js';

export function generateInformation(settings, substituteParams, index = randomIndex) {
    validateSettings(settings);
    const lines = [];
    const cleanLabel = (label) => label.trim().replace(/[:：]\s*$/, '');
    if (settings.titles.length) lines.push(`${cleanLabel(choose(settings.titles, index))}:`);
    for (const group of settings.groups.filter((entry) => entry.enabled)) {
        const header = cleanLabel(choose(group.headers, index));
        const value = group.mode === 'template'
            ? expandTemplate(choose(group.templates, index), substituteParams)
            : randomIdentifier(group.mode, group.length, group.chunk, index);
        lines.push(`${header}: ${value}`);
    }
    const text = lines.join('\n');
    if (text.length > 100000) throw new Error('生成结果超过 100000 字符，请减少信息组或长度');
    return text;
}
