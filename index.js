// 作者：wwj
import { defaultSettings } from './presets.js';
import { SETTINGS_KEY } from './settings.js';
import { createController } from './controller.js';
import { createUi } from './ui.js';
import { is_group_generating } from '../../../group-chats.js';
import { saveSettings } from '../../../../script.js';
import { saveConfiguration } from './persistence.js';

async function initialize() {
    if (document.getElementById('sir-panel')) return;
    const context = window.SillyTavern.getContext();
    if (!context.extensionSettings[SETTINGS_KEY]) {
        context.extensionSettings[SETTINGS_KEY] = defaultSettings();
        context.saveSettingsDebounced();
    }
    const response = await fetch(new URL('./settings.html', import.meta.url));
    if (!response.ok) throw new Error(`加载设置面板失败（HTTP ${response.status}）`);
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    const panel = template.content.firstElementChild;
    const host = document.querySelector('#rm_extensions_block .extensions_block')
        || document.getElementById('extensions_settings');
    if (!host) throw new Error('找不到酒馆扩展设置容器');
    host.insertBefore(panel, host.querySelector(':scope > hr'));
    const getSettings = () => window.SillyTavern.getContext().extensionSettings[SETTINGS_KEY];
    const ui = createUi(panel, { getSettings, commitSettings: async (settings) => {
        await saveConfiguration(window.SillyTavern.getContext(), settings, saveSettings);
    } });
    const controller = createController({ getContext: () => window.SillyTavern.getContext(), getSettings,
        isGroupGenerating: () => is_group_generating, report: ui.report, preview: ui.preview, busy: ui.busy });
    ui.bind(controller);
    controller.bind();
    await controller.syncCurrent();
}

jQuery(() => initialize().catch((error) => {
    console.error('[system-info-randomizer]', error);
    window.toastr?.error?.(error.message, '随机系统信息初始化失败', { escapeHtml: true });
}));
