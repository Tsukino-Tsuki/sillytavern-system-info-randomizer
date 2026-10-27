// 作者：wwj
import { SETTINGS_KEY } from './settings.js';

export async function saveConfiguration(context, settings, saveNative, request = fetch) {
    const previous = context.extensionSettings[SETTINGS_KEY];
    context.extensionSettings[SETTINGS_KEY] = settings;
    try {
        await saveNative();
        // 原生saveSettings吞掉失败；读取落盘配置确认，不能以全局SETTINGS_UPDATED事件判定本次保存。
        const response = await request('/api/settings/get', {
            method: 'POST', headers: context.getRequestHeaders(), body: '{}', cache: 'no-store',
        });
        if (!response.ok) throw new Error(`无法确认设置保存结果（HTTP ${response.status}）`);
        const payload = await response.json();
        if (typeof payload.settings !== 'string') throw new Error('酒馆返回的设置格式无效');
        const stored = JSON.parse(payload.settings).extension_settings?.[SETTINGS_KEY];
        if (JSON.stringify(stored) !== JSON.stringify(settings)) throw new Error('酒馆尚未保存此配置，请稍后重试');
    } catch (error) {
        context.extensionSettings[SETTINGS_KEY] = previous;
        throw error;
    }
}
