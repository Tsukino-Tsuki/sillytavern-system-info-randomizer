// 作者：wwj
export function inputField(label, key, value, type = 'text') {
    const wrapper = document.createElement('label');
    wrapper.className = 'sir-field';
    const caption = document.createElement('span');
    caption.textContent = label;
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    else { input.rows = 5; input.spellcheck = false; }
    input.className = 'text_pole';
    input.dataset.field = key;
    input.value = value;
    wrapper.append(caption, input);
    return wrapper;
}

export function button(text, action) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'menu_button';
    element.textContent = text;
    element.addEventListener('click', action);
    return element;
}

export function groupCard(group, index, move, remove) {
    const card = document.createElement('fieldset');
    card.className = 'sir-group';
    card.dataset.group = String(index);
    const legend = document.createElement('legend');
    legend.textContent = `信息组 ${index + 1}`;
    const top = document.createElement('div');
    top.className = 'sir-toolbar';
    const enabled = document.createElement('label');
    enabled.className = 'checkbox_label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.field = 'enabled';
    checkbox.checked = group.enabled;
    enabled.append(checkbox, '启用');
    const up = button('上移', () => move(index, -1));
    up.disabled = index === 0;
    top.append(enabled, inputField('分组名称', 'name', group.name), up,
        button('下移', () => move(index, 1)), button('删除', () => remove(index)));
    const columns = document.createElement('div');
    columns.className = 'sir-columns';
    columns.append(inputField('标头候选（每行一个）', 'headers', group.headers.join('\n'), 'textarea'));
    const right = document.createElement('div');
    right.className = 'sir-value';
    const modeLabel = document.createElement('label');
    modeLabel.textContent = '内容生成方式';
    const select = document.createElement('select');
    select.className = 'text_pole';
    select.dataset.field = 'mode';
    for (const [value, text] of [['template', '酒馆宏 / 普通文本模板'], ['alnum', 'JS 字母数字串'],
        ['hex', 'JS 十六进制串'], ['uuid', 'JS UUID v4']]) select.add(new Option(text, value));
    select.value = group.mode;
    modeLabel.append(select);
    const template = inputField('信息候选模板（每行一个）', 'templates', group.templates.join('\n'), 'textarea');
    const numeric = document.createElement('div');
    numeric.className = 'sir-toolbar';
    numeric.append(inputField('字符数（连续输出）', 'length', group.length, 'number'));
    numeric.querySelector('[data-field="length"]').min = '1';
    numeric.querySelector('[data-field="length"]').max = '4096';
    const toggle = () => {
        template.hidden = select.value !== 'template';
        numeric.hidden = !['hex', 'alnum'].includes(select.value);
    };
    select.addEventListener('change', toggle);
    toggle();
    right.append(modeLabel, template, numeric);
    columns.append(right);
    card.append(legend, top, columns);
    return card;
}
