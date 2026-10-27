// 作者：wwj；仅操作已准备的隔离测试实例，所有模型请求均为本地模拟。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1360, height: 1050 } });
    const requests = [], errors = [], results = [];
    const output = process.env.ST_TEST_OUTPUT || process.cwd();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/horde/text-models', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/horde/status', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('**/api/backends/kobold/status', (route) => route.fulfill({ json: {
        model: 'synthetic-test', koboldUnitedVersion: '1.2.5', koboldCppVersion: '0.0',
    } }));
    await page.route('**/api/backends/kobold/generate', async (route) => {
        const snapshot = await page.evaluate(() => SillyTavern.getContext().chatMetadata.systemInfoRandomizer);
        requests.push({ prompt: route.request().postDataJSON().prompt, snapshot });
        await route.fulfill({ json: { results: [{ text: ` Synthetic reply ${requests.length}.` }] } });
    });
    try {
        await page.goto(process.env.ST_TEST_URL || 'http://127.0.0.1:8912', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#sir-save') && SillyTavern.getContext().characters.length > 0);
        await page.evaluate(async () => {
            const ctx = SillyTavern.getContext();
            const script = await import('/script.js');
            const groups = await import('/scripts/group-chats.js');
            const { kai_settings } = await import('/scripts/kai-settings.js');
            kai_settings.api_server = 'http://127.0.0.1:1';
            kai_settings.streaming_kobold = false;
            kai_settings.preset_settings = 'gui';
            document.querySelector('#main_api').value = 'kobold';
            document.querySelector('#main_api').dispatchEvent(new Event('change', { bubbles: true }));
            script.setOnlineStatus('synthetic-test');
            const members = ctx.characters.filter((c) => c.name.startsWith('Random Info Test ')).slice(-2).map((c) => c.avatar);
            if (members.length !== 2) throw new Error('请先运行browser-integration.cjs准备合成角色');
            const response = await fetch('/api/groups/create', { method: 'POST', headers: ctx.getRequestHeaders(),
                body: JSON.stringify({ name: `Metadata Group ${Date.now()}`, members, activation_strategy: 1, generation_mode: 0 }) });
            if (!response.ok) throw new Error('创建合成群聊失败');
            const group = await response.json();
            await groups.getGroups();
            if (!await groups.openGroupById(group.id)) throw new Error('打开合成群聊失败');
            document.querySelector('#send_textarea').value = 'Group metadata verification';
            await SillyTavern.getContext().generate();
        });
        assert.equal(requests.length, 2);
        assert.deepEqual(requests.map((request) => request.snapshot.count), [1, 2]);
        for (const request of requests) assert.ok(request.prompt.includes(request.snapshot.text));
        assert.notEqual(requests[0].snapshot.text, requests[1].snapshot.text);
        results.push('群聊正常Generate：2成员各刷新一次，外层不重复，每个实际请求含对应快照');

        await page.evaluate(async () => {
            await (await import('/scripts/group-chats.js')).generateGroupWrapper(true, 'normal');
        });
        assert.equal(requests.length, 4);
        assert.deepEqual(requests.slice(2).map((request) => request.snapshot.count), [3, 4]);
        results.push('自动群聊直接wrapper路径：每成员仍刷新一次');

        await page.evaluate(() => SillyTavern.getContext().generate('continue'));
        assert.equal(requests.length, 5);
        assert.equal(requests[4].snapshot.count, 4);
        assert.equal(requests[4].snapshot.text, requests[3].snapshot.text);
        results.push('群聊继续生成：复用上一结果');

        await page.evaluate(async () => {
            const ctx = SillyTavern.getContext();
            await ctx.selectCharacterById(ctx.characters.findIndex((c) => c.name.startsWith('Random Info Test A')));
            (await import('/script.js')).setOnlineStatus('synthetic-test');
            await SillyTavern.getContext().generate('regenerate');
        });
        const previous = requests.at(-1).snapshot;
        await page.evaluate(() => SillyTavern.getContext().generate('swipe'));
        assert.equal(requests.at(-1).snapshot.count, previous.count + 1);
        results.push('单聊真实regenerate和swipe均重新抽样');

        await page.locator('#extensions-settings-button > .drawer-toggle').click();
        await page.locator('#sir-panel .inline-drawer-toggle').click();
        await page.locator('#sir-groups .sir-group').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'groups-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#sir-groups .sir-group').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'groups-mobile.png') });
        assert.equal(await page.locator('#sir-panel').evaluate((panel) => panel.scrollWidth > panel.clientWidth + 2), false);
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(output, 'generation-validation.json'), JSON.stringify({ results, errors, modelRequests: requests.length }, null, 2));
        console.log(JSON.stringify({ results, errors, modelRequests: requests.length }, null, 2));
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
