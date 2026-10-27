// 作者：wwj
function canonicalMacro(body) {
    const roll = body.match(/^roll(?:::|:|\s+)\s*(.+)$/i);
    if (roll) {
        const formula = roll[1].trim();
        const dice = formula.match(/^(?:(\d*)d)?(\d+)([+-]\d+)?$/i);
        if (!dice || (!/d/i.test(formula) && dice[3]) || Number(dice[1] || 1) < 1 || Number(dice[1] || 1) > 1000
            || Number(dice[2]) < 1 || Number(dice[2]) > 1000000000) {
            throw new Error(`骰子公式无效或超出范围：${formula}`);
        }
        // 空格形式同时兼容当前新引擎和旧引擎；界面仍接受新版双冒号形式。
        return `{{roll ${formula}}}`;
    }
    const random = body.match(/^random(?:::|:|\s+)\s*(.+)$/i);
    if (random) {
        const list = random[1];
        const options = list.includes('::') ? list.split('::') : list.split(/(?<!\\),/);
        if (options.some((option) => !option.trim())) throw new Error('random 候选不能为空');
        return `{{random::${list}}}`;
    }
    throw new Error('模板仅支持 random 和 roll 宏；其他文字请直接填写');
}

export function parseTemplate(text) {
    const parts = [];
    const pattern = /{{([^{}]*)}}/g;
    let start = 0;
    for (const match of text.matchAll(pattern)) {
        const literal = text.slice(start, match.index);
        if (/[{}]/.test(literal)) throw new Error('模板花括号不完整，或包含嵌套宏');
        parts.push({ literal }, { macro: canonicalMacro(match[1].trim()) });
        start = match.index + match[0].length;
    }
    const tail = text.slice(start);
    if (/[{}]/.test(tail)) throw new Error('模板花括号不完整，或包含嵌套宏');
    parts.push({ literal: tail });
    return parts;
}

export function expandTemplate(text, substituteParams) {
    return parseTemplate(text).map((part) => {
        if ('literal' in part) return part.literal;
        const value = substituteParams(part.macro);
        if (typeof value !== 'string' || !value.trim() || /[{}]/.test(value)) {
            throw new Error(`酒馆未能展开宏：${part.macro}`);
        }
        return value;
    }).join('');
}
