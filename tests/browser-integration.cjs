// 作者：wwj；仅在独立的合成测试数据目录运行，模型请求由浏览器拦截，不连接真实服务。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1360, height: 1050 } });
    const results = [], errors = [], requests = [];
    const output = process.env.ST_TEST_OUTPUT || process.cwd();
    const nameA = `Random Info Test A ${Date.now()}`;
    const nameB = nameA.replace('Test A', 'Test B');
    page.on('pageerror', (error) => errors.push(error.message));
    // 测试固定外部目录与连接状态，避免与本插件无关的公网Horde请求影响隔离验收。
    await page.route('**/api/horde/text-models', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/horde/status', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('**/api/backends/kobold/status', (route) => route.fulfill({ json: {
        model: 'synthetic-test', koboldUnitedVersion: '1.2.5', koboldCppVersion: '0.0',
    } }));
    await page.route('**/api/backends/kobold/generate', async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ results: [{ text: ' Synthetic verification reply.' }] }) });
    });
    const click = (selector) => page.locator(selector).evaluate((button) => button.click());
    const state = () => page.evaluate(() => {
        const ctx = SillyTavern.getContext();
        const settings = ctx.extensionSettings['system-info-randomizer'];
        return { settings, snapshot: ctx.chatMetadata.systemInfoRandomizer,
            values: settings.variableNames.map((name) => ctx.chatMetadata.variables?.[name]),
            macros: settings.variableNames.map((name) => ctx.substituteParams(`{{getvar::${name}}}`)) };
    });
    const emit = (type, dryRun = false) => page.evaluate(async ({ type, dryRun }) => {
        const ctx = SillyTavern.getContext();
        await ctx.eventSource.emit(ctx.eventTypes.GENERATION_AFTER_COMMANDS, type, {}, dryRun);
    }, { type, dryRun });
    const waitSaved = () => page.waitForFunction(() => !document.querySelector('#sir-refresh').disabled);
    try {
        await page.goto(process.env.ST_TEST_URL || 'http://127.0.0.1:8912', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.SillyTavern?.getContext && document.querySelector('#sir-save'));
        await page.waitForFunction(() => document.querySelector('dialog[open] .onboarding')
            || SillyTavern.getContext().characters.length > 0);
        const onboarding = page.locator('dialog[open]').filter({ has: page.locator('.onboarding') }).locator('.popup-button-ok');
        if (await onboarding.count()) await onboarding.evaluate((button) => button.click());
        await page.waitForFunction(() => SillyTavern.getContext().characters.length > 0);
        await page.evaluate(async () => {
            const { defaultSettings } = await import('/scripts/extensions/third-party/system-info-randomizer/presets.js');
            SillyTavern.getContext().extensionSettings['system-info-randomizer'] = defaultSettings();
            await (await import('/script.js')).saveSettings();
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#sir-save') && SillyTavern.getContext().characters.length > 0);
        await page.evaluate(async ([nameA, nameB]) => {
            const ctx = SillyTavern.getContext();
            for (const name of [nameA, nameB]) {
                if (ctx.characters.some((character) => character.name === name)) continue;
                const response = await fetch('/api/characters/create', { method: 'POST', headers: ctx.getRequestHeaders(),
                    body: JSON.stringify({ ch_name: name, description: 'SYNTHETIC-BEGIN\n{{getvar::system_information}}\nSYNTHETIC-END',
                        first_mes: 'Hello', personality: '', scenario: '', mes_example: '', creator_notes: '', tags: [] }) });
                if (!response.ok) throw new Error(`创建测试角色失败 ${response.status}`);
            }
            await ctx.getCharacters();
            await SillyTavern.getContext().selectCharacterById(
                SillyTavern.getContext().characters.findIndex((character) => character.name === nameA));
        }, [nameA, nameB]);
        await click('#sir-refresh');
        await page.waitForFunction(() => SillyTavern.getContext().chatMetadata.systemInfoRandomizer?.text);
        await waitSaved();
        let current = await state();
        assert.equal(current.values.length, 3);
        assert.ok(current.values.every((value) => value === current.snapshot.text));
        assert.deepEqual(current.macros, current.values);
        assert.equal(current.snapshot.text.includes('{{'), false);
        results.push('原生面板加载、首次生成、3变量相同、getvar读取已展开内容');

        const compatibility = await page.evaluate(async () => {
            const { generateInformation } = await import('/scripts/extensions/third-party/system-info-randomizer/generator.js');
            const ctx = SillyTavern.getContext(), outputs = [];
            const previous = ctx.powerUserSettings.experimental_macro_engine;
            try {
                for (const enabled of [false, true]) {
                    ctx.powerUserSettings.experimental_macro_engine = enabled;
                    const settings = structuredClone(ctx.extensionSettings['system-info-randomizer']);
                    settings.groups[0].templates = ['{{random::a,b}} {{random::a::b}} {{roll 1d999}} {{roll::1d9999}}'];
                    outputs.push(generateInformation(settings, (macro) => ctx.substituteParams(macro)));
                }
            } finally { ctx.powerUserSettings.experimental_macro_engine = previous; }
            return outputs;
        });
        compatibility.forEach((text) => assert.match(text.split('\n')[1], /: [ab] [ab] \d+ \d+$/));
        results.push('新版与旧版宏引擎：逗号random、双冒号random、新旧roll均成功');

        for (const type of [undefined, 'regenerate', 'swipe']) {
            await emit(type); const next = await state();
            assert.equal(next.snapshot.count, current.snapshot.count + 1);
            assert.notEqual(next.snapshot.text, current.snapshot.text); current = next;
        }
        for (const [type, dryRun] of [['continue', false], ['quiet', false], [undefined, true]]) {
            await emit(type, dryRun); assert.equal((await state()).snapshot.text, current.snapshot.text);
        }
        results.push('生成/重生成/swipe刷新；continue/quiet/dryRun保持结果');

        await click('#sir-add-variable'); await click('#sir-add-variable');
        await click('#sir-save'); await waitSaved();
        current = await state();
        assert.equal(current.values.length, 5);
        assert.deepEqual(current.macros, Array(5).fill(current.snapshot.text));
        assert.equal(await page.locator('#sir-add-variable').isDisabled(), true);
        results.push('界面增至5变量、立即同步旧结果、上限禁用');

        await page.evaluate(() => { document.querySelector('#sir-variables input').value = 'bad::name'; });
        await click('#sir-save');
        assert.match(await page.locator('#sir-status').textContent(), /已保留上一份有效设置/);
        assert.equal((await state()).settings.variableNames[0], 'system_information');
        await page.evaluate(() => { document.querySelector('#sir-variables input').value = 'system_information'; });
        results.push('非法变量名不覆盖有效配置');

        const select = (name) => page.evaluate(async (name) => {
            const ctx = SillyTavern.getContext();
            await ctx.selectCharacterById(ctx.characters.findIndex((character) => character.name === name));
        }, name);
        const first = current.snapshot.text;
        await select(nameB);
        assert.equal((await state()).snapshot, undefined);
        await emit(); assert.notEqual((await state()).snapshot.text, first);
        await select(nameA); assert.equal((await state()).snapshot.text, first);
        results.push('两聊天分别保存，切换恢复各自结果');

        await page.evaluate(() => { document.querySelector('#sir-enabled').checked = false; });
        await click('#sir-save'); await waitSaved();
        await page.waitForFunction(() => !SillyTavern.getContext().chatMetadata.variables.system_information);
        await emit(); assert.equal((await state()).snapshot.text, first);
        await page.evaluate(() => { document.querySelector('#sir-enabled').checked = true; });
        await click('#sir-save'); await waitSaved();
        await page.waitForFunction(() => SillyTavern.getContext().chatMetadata.variables.system_information);
        assert.deepEqual((await state()).macros, Array(5).fill(first));
        results.push('停用清理注入变量，重新启用恢复快照');

        await page.evaluate(async () => {
            const script = await import('/script.js');
            const { kai_settings } = await import('/scripts/kai-settings.js');
            document.querySelector('#main_api').value = 'kobold';
            document.querySelector('#main_api').dispatchEvent(new Event('change', { bubbles: true }));
            kai_settings.streaming_kobold = false;
            kai_settings.preset_settings = 'gui';
            kai_settings.api_server = 'http://127.0.0.1:1';
            script.setOnlineStatus('synthetic-test');
            document.querySelector('#send_textarea').value = 'Verify random metadata';
            await SillyTavern.getContext().generate();
        });
        assert.equal(requests.length, 1, '实际生成应到达模拟模型请求');
        current = await state();
        assert.ok(requests[0].prompt.includes(current.snapshot.text));
        assert.equal(requests[0].prompt.includes('{{getvar::system_information}}'), false);
        results.push('真实Generate构建请求：角色提示词读取的变量与本轮结果完全相同（模型响应本地模拟）');

        await page.evaluate(() => SillyTavern.getContext().saveMetadata());
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#sir-save') && SillyTavern.getContext().characters.length > 0);
        await select(nameA);
        assert.equal((await state()).snapshot.text, current.snapshot.text);
        assert.equal((await state()).settings.variableNames.length, 5);
        assert.equal(await page.locator('#sir-variables input').count(), 5);
        results.push('页面刷新后设置及当前聊天结果恢复');

        await page.locator('#extensions-settings-button > .drawer-toggle').click();
        await page.locator('#sir-panel .inline-drawer-toggle').evaluate((button) => button.click());
        await page.locator('#sir-titles').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'panel-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#sir-titles').scrollIntoViewIfNeeded();
        const overflow = await page.locator('#sir-panel').evaluate((panel) => panel.scrollWidth > panel.clientWidth + 2);
        assert.equal(overflow, false, '手机面板不能横向溢出');
        await page.screenshot({ path: path.join(output, 'panel-mobile.png') });
        results.push('桌面与390px手机面板截图，手机无横向溢出');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(output, 'browser-validation.json'), JSON.stringify({ results, errors, modelRequests: requests.length }, null, 2));
        console.log(JSON.stringify({ results, errors }, null, 2));
    } catch (error) {
        await page.screenshot({ path: path.join(output, 'browser-failure.png') });
        console.error(JSON.stringify({ results, errors, failure: error.message }));
        throw error;
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
