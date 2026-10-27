// 作者：wwj；仅在隔离实例写入1.0合成配置，验证重载迁移。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/horde/text-models', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/horde/status', (route) => route.fulfill({ json: { ok: true } }));
    const ready = () => page.waitForFunction(() => document.querySelector('#sir-save')
        && SillyTavern.getContext().characters.length > 0);
    try {
        await page.goto(process.env.ST_TEST_URL || 'http://127.0.0.1:8912', { waitUntil: 'domcontentloaded' });
        await ready();
        const before = await page.evaluate(async () => {
            const ctx = SillyTavern.getContext();
            const { defaultSettings } = await import('/scripts/extensions/third-party/system-info-randomizer/presets.js');
            const legacy = defaultSettings();
            legacy.schemaVersion = 1; delete legacy.minGroups; delete legacy.maxGroups;
            legacy.variableNames = ['migration_info']; legacy.titles = ['Legacy Title'];
            legacy.groups = legacy.groups.slice(0, 6).map((group) => ({ ...group, chunk: 8 }));
            legacy.groups[0].headers = ['Custom Legacy Version'];
            legacy.groups[0].templates = ['d {{roll 1d999}} l p 1105 3068 6383 8471'];
            ctx.extensionSettings['system-info-randomizer'] = legacy;
            await (await import('/script.js')).saveSettings();
            return legacy;
        });
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
        const migrated = await page.evaluate(() => SillyTavern.getContext().extensionSettings['system-info-randomizer']);
        assert.equal(migrated.schemaVersion, 2); assert.equal(migrated.groups.length, 20);
        assert.deepEqual(migrated.variableNames, before.variableNames);
        assert.deepEqual(migrated.titles, before.titles);
        assert.deepEqual(migrated.groups.slice(0, 6), before.groups.map(({ chunk, ...group }) => group));
        assert.equal(await page.locator('#sir-min-groups').inputValue(), '4');
        assert.equal(await page.locator('#sir-max-groups').inputValue(), '8');
        await page.evaluate(() => SillyTavern.getContext().selectCharacterById(0));
        await page.locator('#sir-min-groups').evaluate((input) => { input.value = '20'; });
        await page.locator('#sir-max-groups').evaluate((input) => { input.value = '20'; });
        await page.locator('#sir-refresh').evaluate((button) => button.click());
        await page.waitForFunction(() => !document.querySelector('#sir-refresh').disabled
            && SillyTavern.getContext().chatMetadata.variables?.migration_info);
        const text = await page.evaluate(() => SillyTavern.getContext().substituteParams('{{getvar::migration_info}}'));
        assert.equal(text.split('\n').length, 21);
        assert.match(text, /Custom Legacy Version: d\d+lp1105306863838471/);
        assert.equal(text.includes('{{'), false);
        for (const line of text.split('\n').slice(1)) assert.doesNotMatch(line.slice(line.indexOf(': ') + 2), /\s/);
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
        assert.equal(await page.locator('#sir-groups .sir-group').count(), 20);
        assert.equal(await page.locator('#sir-min-groups').inputValue(), '20');
        assert.equal(await page.locator('#sir-variables input').inputValue(), 'migration_info');
        assert.deepEqual(errors, []);
        const result = { migratedFrom: 1, migratedTo: 2, groupCount: 20, customConfigurationPreserved: true,
            allGroupsGenerated: true, compactValues: true, persistedAndIdempotent: true, errors };
        await fs.writeFile(path.join(process.env.ST_TEST_OUTPUT || process.cwd(), 'migration-validation.json'), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result, null, 2));
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
