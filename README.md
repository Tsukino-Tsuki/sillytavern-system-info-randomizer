# SillyTavern 随机系统信息

作者：wwj · 版本：1.0.0

一个独立的 SillyTavern 前端扩展。每次回复前，随机选择系统信息标头并生成对应数据，再把整段结果同步写入多个聊天变量。

## 使用

1. 安装后刷新酒馆，在「扩展」中打开「随机系统信息」。
2. 默认已提供 6 个信息组，可直接点击「立即随机并注入」预览。
3. 在预设、世界书或其他需要的位置填入：

```text
{{getvar::system_information}}
```

默认还有 `system_information_2` 和 `system_information_3`，可以增加到 5 个目标变量。这些变量的内容完全相同，通常只需选一个读取宏放入提示词，以免重复注入。支持自定义变量名。

插件仅准备变量；放置读取宏的位置决定内容进入提示词的位置。变量内容是完整展开的普通文本，同一轮多次读取不会再次随机。

## 酒馆前端安装

打开「扩展 → 安装扩展」，粘贴以下仓库地址：

```text
https://github.com/Tsukino-Tsuki/sillytavern-system-info-randomizer
```

安装完成后刷新页面。更新时在扩展管理中更新本插件，再刷新页面。

## 安装源码包

将 ZIP 中的 `sillytavern-system-info-randomizer` 文件夹解压至：

```text
SillyTavern/data/<你的用户目录>/extensions/sillytavern-system-info-randomizer/
```

单用户安装的用户目录通常为 `default-user`。确认该文件夹内直接包含 `manifest.json`、`index.js`，然后刷新页面。也可以放进共享的 `public/scripts/extensions/third-party/` 目录。

酒馆前端的「安装扩展」接受 Git 仓库地址，不接受本地 ZIP。插件运行不需要 Node 构建步骤、Extras 服务、模型 API、服务端插件或修改 `config.yaml`。

## 随机范围

整段标题有 6 个候选，例如 `System Information`、`System Metadata`、`Runtime Information`。每个启用的信息组输出一行，标头与内容分别抽取。

| 默认组 | 标头候选示例 | 默认内容 |
| --- | --- | --- |
| 内部版本 | Internal Version Number / Runtime Version / Core Version | 版本号或混合编号宏模板 |
| 构建信息 | Build Number / Build Revision / Compilation ID | 构建版本或混合编号宏模板 |
| 校验摘要 | Build Fingerprint / Artifact Checksum / Package Digest | JS 生成 64 位十六进制串 |
| 指令集 | Instruction Set / ISA Profile / Execution ISA | 按架构匹配的指令集组合，加随机修订号 |
| 序列标识 | Serial Number / Instance Serial / Module Serial | JS 生成 40 字符，每 8 字符分段 |
| 诊断编号 | Test Run ID / Diagnostic Run ID / Validation Session ID | JS 生成 128 字符，每 8 字符分段 |

每组内置 8 个标头，共 48 个。名称采用版本、构建、摘要、指令集、实例和诊断记录中常见的命名方式；这些是**合成信息**，不读取宿主机数据，也不是实际计算出的文件哈希。

面板可编辑所有标头和候选模板，并可增删、排序、停用信息组，最多 30 组。整段标题留空可省略。每次重新抽样，候选少时允许偶然抽到相同标头；不使用固定于聊天的 `pick` 宏。

## 内容生成方式

- **酒馆宏 / 普通文本模板**：每行一个候选，JS 选中一条后交给酒馆原生宏函数展开。
- **JS 字母数字串**：从 `a–z`、`0–9` 抽取，可设置 1–4096 字符及分段长度。
- **JS 十六进制串**：从 `0–9`、`a–f` 抽取，长度及分段可调。
- **JS UUID v4**：生成标准形状的随机 UUID。

JS 抽样使用浏览器 `crypto.getRandomValues`，采用拒绝采样避免取模偏差。无需填入或执行自定义 JavaScript 代码。

模板示例：

```text
{{random::a::b::c::d}} {{roll::1d9999}} {{roll::1d9999}} {{roll::1d999}}
build-{{roll::1d9}}.{{roll::1d99}}.{{roll::1d9999}}
```

兼容旧写法 `{{random::a,b,c}}`、`{{roll 1d9999}}`。在传给酒馆前会把 roll 规范化成两套宏引擎都支持的形式。每个宏由当前酒馆解析器执行，所有输出在写变量前完成展开。

模板只支持平铺的 `random` 和 `roll`，不支持嵌套宏、`setvar` 等副作用宏或任意代码；普通文字可以直接填写。骰子支持正整数面数、`1d9999`、`3d6+4` 等公式，一次最多 1000 个骰子、单个最多 10 亿面。配置错误会定位到信息组并拒绝保存，保留上一份有效配置。原生宏展开失败时保留当前聊天旧结果并提示。

## 刷新与保存

| 场景 | 行为 |
| --- | --- |
| 发送消息、重新生成、新生成的滑动回复 | 生成前重新随机 |
| 继续生成 | 沿用已有结果；第一次没有结果时准备一份 |
| 翻看已经存在的滑动回复 | 不触发新生成，不重新随机 |
| 群聊 | 每个成员实际请求模型前刷新一次；忽略群聊外层重复事件 |
| quiet 后台请求、dry run、已中止请求 | 不刷新 |
| 关闭「每次生成前刷新」 | 仅手动按钮刷新 |
| 修改变量名或增加变量 | 保存后复制当前快照，不额外随机；旧的插件赋值清理 |
| 切换聊天、刷新后重新打开聊天 | 恢复该聊天自己的快照，不复制其他聊天结果 |
| 关闭插件并保存 | 清除当前聊天中仍等于插件结果的变量赋值，保留快照供重新启用 |

其他聊天在再次打开时执行相同的变量同步或清理。若其他功能已经覆盖某个旧变量值，插件不会删除该外部值。建议给本插件使用专属变量名。

在酒馆的扩展管理器中直接禁用/卸载扩展会停止其代码运行，无法执行清理；如需清空旧变量，先在本插件面板关闭「启用插件」并保存。

配置是酒馆用户级设置，结果存储在各自聊天 metadata。点击保存后，会调用酒馆原生保存函数并读回配置确认；未能确认时提示并保留上一份内存配置。聊天保存失败时，当前内存中的随机结果仍可用于本次请求。设置修改后点击「保存设置」，或点击「立即随机并注入」同时保存并刷新。

## 兼容与验证

实际验证目标：SillyTavern 1.19.0，release `06bde939fb1e9c4c8d8641d810f0a916b5bce127`，2026-10-27 核对远程稳定分支与测试源码一致。兼容当前新版宏引擎及旧解析模式；其他酒馆版本未逐个验证。

不依赖扩展文件夹名称，文件名和相对目录结构应保持完整。运行时为原生 ES modules，无额外前端框架。

```powershell
npm test
```

已通过 26 项单元测试、14 类酒馆集成检查，包含新旧宏引擎、五变量持久化、聊天隔离、真实生成请求构建、群聊及自动群聊。桌面与390px手机布局已目视检查。

浏览器集成测试位于 `tests/browser-integration.cjs`，需要 Playwright 和独立酒馆测试实例。它会创建合成角色、设置和聊天，只应对隔离测试数据运行；默认地址 `http://127.0.0.1:8912`，测试实例中的插件目录名使用 `system-info-randomizer`。先运行它，再运行 `tests/browser-generation.cjs` 验证群聊。模型请求由浏览器拦截并返回模拟响应，没有调用真实付费模型。

官方宏规则参考：`https://docs.sillytavern.app/usage/core-concepts/macros/`。

## 文件结构

`presets.js` 内置候选；`random.js` JS 随机源；`templates.js` 宏校验与展开；`generator.js` 组合文本；`controller.js` 生成生命周期、聊天变量与保存；`persistence.js` 配置保存确认；`ui.js`、`ui-fields.js`、`settings.html`、`style.css` 设置界面。
