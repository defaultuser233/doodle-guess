# 项目评审：画个啥 · DoodleGuess

> 评审日期：2026-10-26  
> 代码基线：`b0eae07` Initial Commit（工作区无跟踪文件改动）  
> 评审范围：`src/`、`training/`、`scripts/`、构建与测试配置、`README.md`、`docs/`  
> 方式：通读代码 → 运行 lint / 单测 / 构建 / 模型复核 → 浏览器实机走查核心玩法  
> 约束：本轮只新增评审文档，不修改任何代码。下文所有建议均未落地。

## 0. 结论

**综合评分：8.0 / 10。作为个人作品或课堂演示可以打 9 分；作为公开产品约 7.5 分。**

这是一个完成度、审美和工程意识都在平均线以上的项目。它不是“套模板的 AI Demo”：模型确实在本地跑，视觉系统有一套自己的语言，核心玩法从抽词、作画、识别、存档到分享是完整闭环，而且我在预览构建里真的走通了。

离“可以放心公开推广”还差一层：**数据可靠性、事实正确性和无障碍细节**。最该先修的不是模型，而是“保存失败却告诉用户已保存”“分享一张没猜中的画却盖着‘猜中!’章”这类会直接伤害信任的问题。

三条判断：

1. **产品形态成立**：90 秒、100 个词、Top-3、可回看，节奏轻，适合移动端碎片时间。
2. **识别准确率是天花板**：Top-1 59.4% 意味着首选答案有约 40.6% 的概率不是目标词；继续加功能之前，应先决定是升级模型，还是用玩法设计兜住这个概率。
3. **代码质量不错，但质量闸门偏松**：`strict` 未开启、`docs/` 被 git 忽略、核心流程没有 E2E，都会让后续迭代慢慢失控。

## 1. 评分明细

| 维度 | 分数 | 判断 |
|---|---:|---|
| 产品完成度 | 9.0 | 抽词、画画、猜测、保存、画廊、分享、统计都齐了，边界状态考虑得比多数同类项目多 |
| 视觉与动效 | 9.0 | 水彩纸、手绘边、胶带、印章、暗色夜桌统一且有辨识度；不是拼贴出来的“风格” |
| 交互与可访问性 | 7.0 | 鼠标/触控细节好，键盘和读屏支持不均；弹窗焦点管理有明确缺口 |
| 识别系统 | 7.0 | 本地推理、体积、训练脚本都合格；准确率和真实端到端评测还不够 |
| 代码结构 | 7.5 | 分层清楚、命名一致；`DrawScreen` 偏重，少数死代码和重复阈值 |
| 测试与可维护性 | 6.5 | 28 个单测扎实，但只覆盖 `lib/`；无 E2E、无 CI、无覆盖率门槛 |
| 性能 | 7.5 | 推理快、首屏可接受；字体约 726KB 是最大单项，模型被无条件预加载 |
| 文档与协作 | 6.5 | PRD/TODO 写得很认真，但和代码有漂移，而且 `docs/` 没进版本库 |
| **综合** | **8.0** | 优秀的小作品，公开发布前需要一轮“可信度 + 移动端 + 无障碍”加固 |

## 2. 做得好的地方

### 2.1 本地识别是真的，不是话术

- 模型和权重随前端打包，运行时只请求同源的 `model/model.json` 与 `weights.bin`，没有任何第三方请求。
- int8 逐输出列量化，`weights.bin` 约 552KB；浏览器端反量化后做纯 JS 矩阵乘，单次推理在毫秒级。
- `loadClassifier` 是 promise 单例，失败会重置并允许重试；`GuessPanel` 有“模型没加载出来 + 重试”的完整状态，不是一句 `console.error`。
- 我复跑了 `pnpm verify:model`：100 张训练未使用的新样本，Top-1 57.0%、Top-5 83.0%，与 README 的 57% / 83% 一致。

### 2.2 视觉系统是“设计过”的

- `styles/tokens.css` 把纸色、墨色、水彩六色、手绘圆角、纸张阴影、缓动都收成了 token；不是散落的 magic number。
- 手绘不对称圆角、胶带、印章、纸纹、水彩晕染、暗色“夜桌”是同一套语言；画板在暗色下仍保留浅色纸面，这个取舍是对的。
- `prefers-reduced-motion` 有全局降级；Toast、弹窗、结果层都考虑了移动端和底部安全区。
- 字体许可、QuickDraw 许可、OFL 文本都随仓库提供，版权意识比很多同类项目好。

### 2.3 核心闭环经得起实际走查

我在 `pnpm preview` 的构建产物上完整走了一次：

1. 首页 → 挑战模式，抽到「鱼」；
2. 画布上画了一条弧线；
3. 倒计时归零，自动触发猜测，返回「月亮 60% / 香蕉 32% / 西瓜 2%」；
4. 保存后进入画廊，作品出现且缩略图正确；
5. 打开详情，Top-3、目标词、用时、来源都正确；
6. 删除确认、取消等交互可操作；Esc 会误关详情层，见 P1-1。

这说明“画 → 猜 → 存 → 看”不是纸面功能。

### 2.4 工程基础扎实

- `pnpm lint` 0 error；`pnpm test` 28/28 通过；`pnpm build` 通过。
- 存储层有 IndexedDB + localStorage 降级，测试用 `fake-indexeddb` 跑真实事务路径。
- 分类器、分享、统计、主题都有单测，测试不是“只测 getter”。
- `ErrorBoundary`、Toast、空状态、低墨量禁用、离开未保存确认、分享三级回退，这些边界处理说明作者真的用过自己的产品。

### 2.5 训练链路可复现

- 只依赖 numpy，不引入 PyTorch/TensorFlow；用 HTTP Range 分块拉取 QuickDraw，缓存到 `.cache/`。
- 固定随机种子 `20261022`，分层切分，数据增强、Adam、cosine、label smoothing 都在脚本里。
- 导出时对权重做 int8、对偏置和 scale 保持 float32，并在导出前做 4 字节对齐；这些细节是对的。
- `verify:model` 用 node 独立实现同一套前向，避免“训练脚本自己验证自己”。

## 3. 问题总览

| 编号 | 级别 | 问题 | 关键证据 | 建议动作 |
|---|---|---|---|---|
| P0-1 | P0 | 存储写入失败仍提示“已收进画廊” | `storage.ts:60-69, 86-112`；`DrawScreen.tsx:158-183` | 让保存返回真实结果，失败时回滚 `saved` 状态并给可重试提示 |
| P0-2 | P0 | `docs/` 被 git 忽略，PRD/TODO 不在版本库 | `.gitignore:17`；`git ls-files docs` 为空 | 从 `.gitignore` 移除 `docs/`，提交文档 |
| P1-1 | P1 | 嵌套弹窗按 Esc 会同时关闭详情和确认框 | `ArtworkModal.tsx:30-38` + `ConfirmDialog.tsx:26-34`，已在浏览器复现 | 统一 Dialog 栈，只让最上层响应 Esc |
| P1-2 | P1 | 弹窗无焦点陷阱、无焦点归还，危险按钮默认聚焦 | `ArtworkModal.tsx:28-38`；`ConfirmDialog.tsx:24-34, 58-65`；`ResultOverlay.tsx` 无 Esc | 抽公共 Dialog，初始焦点放取消，关闭后归还触发元素 |
| P1-3 | P1 | 橡皮笔迹参与墨迹包围盒，影响识别输入与导出构图 | `drawing.ts:185-220, 226, 294` | 用渲染后的 alpha 计算包围盒，橡皮不计入“笔数” |
| P1-4 | P1 | 分享卡永远盖“猜中!”章，未中/自由画也如此 | `share.ts:161-186, 277-286` | 分享卡按 `success`/`mode` 生成标题与印章 |
| P1-5 | P1 | 计时器按 interval 递减，后台标签会漂移；用时口径不一致 | `DrawScreen.tsx:133-139, 174-177` | 改用 deadline 时间戳，显示与 `durationMs` 同源 |
| P1-6 | P1 | 画廊计数/上限裁剪读取全部图片 | `storage.ts:100-107, 144-147`；`App.tsx:62-74` | 用 `count()` + `createdAt` 索引游标，避免 `getAll()` |
| P1-7 | P1 | 模型标签与 `categories.json` 无一致性校验 | `classifier.ts:119-141`；`categories.ts:1-13` | 加载时校验 label 数量与集合；加回归测试 |
| P1-8 | P1 | 结果面板没有 `aria-live`，读屏用户听不到猜测结果 | `GuessPanel.tsx:163-203` | 给结果区加 `aria-live="polite"`，并播报命中/未中 |
| P1-9 | P1 | 画廊下载把 720px 图放大到 1080px | `DrawScreen.tsx:167`；`download.ts:15-40`；`drawing.ts:331-333` | 保存 1080 渲染或明确“放大导出”的预期 |
| P2-1 | P2 | `tsconfig` 未开 `strict`，质量闸门偏松 | `tsconfig.app.json`（无 `strict`） | 开启 `strict`（当前代码 0 error，成本极低） |
| P2-2 | P2 | 中文字体约 726KB，首屏最大资产 | `tokens.css:1-7`；`src/assets/fonts/zcool-kuaile.woff2` 726,052B | 子集化到 UI 实际用字，preload |
| P2-3 | P2 | 模型在 App 挂载时无条件加载，首页也付 552KB | `App.tsx:56-60` | 首屏后 idle 预取，或进入画板再加载 |
| P2-4 | P2 | 撤销栈无上限，`MAX_HISTORY` 是死常量 | `drawing.ts:3`；`CanvasBoard.tsx:210-236` | 按 PRD 限制 60 步，或删掉未用常量 |
| P2-5 | P2 | `100vh` 在移动端浏览器地址栏下会溢出/裁切 | `base.css:79,93`；`draw.css:5,163,269,399,912` | 用 `100dvh`（带 `100vh` 回退），真机验证 |
| P2-6 | P2 | 文档与代码多处漂移 | 见 6.5 节 | 以代码常量为唯一来源，PRD 引用而非复制数值 |
| P2-7 | P2 | 只有 lib 单测，无组件/E2E/CI | `vitest.config.ts:5-7`；仓库无 `.github/` | 加 Playwright 冒烟与 lint/test/build CI |
| P2-8 | P2 | `saveArtwork` 静默裁剪最旧作品，PRD 要求提示 | `storage.ts:100-107`；PRD §6.4 | 返回被裁剪数量并 Toast |
| P2-9 | P2 | 统计按“每次点击”计数，重复猜会拉低猜中率 | `DrawScreen.tsx:283`；`stats.ts:32-44` | 明确口径：按轮次或按尝试；写进文案 |
| P2-10 | P2 | 死代码与未接线的 prop | `offTrack`、`getLoadedClassifier`、`getInkRatio`、`onStrokeEnd`、`disabled` | 删除或接线，减少维护噪音 |
| P2-11 | P2 | 无路由，刷新/后退直接离开应用 | `App.tsx:32-38` | 至少用 hash 保存 screen 状态；可选深链 |
| P3-1 | P3 | 无 PWA/离线缓存 | 无 manifest / service worker | 全静态资源，适合做离线安装 |
| P3-2 | P3 | 自由画必须先让 AI 猜一次才能保存 | `GuessPanel.tsx:209-234` | 增加“直接保存”入口 |
| P3-3 | P3 | 无备份/恢复，清站点数据即全丢 | 画廊页脚已说明 | 增加“导出全部/导入”zip 或 JSON |
| P3-4 | P3 | 线条在低事件率下呈折线 | `CanvasBoard.tsx:168-190` | 渲染层加二次贝塞尔平滑，模型仍用原始点 |
| P3-5 | P3 | 无 CSP / 安全响应头 | 静态部署 | 先上 report-only CSP，再收紧 |

## 4. P0：发布前必须处理

### P0-1 保存失败仍提示成功

**现象**

`persist()` 在 `await saveArtwork(...)` 之前就把 `savedRef.current` 和 `saved` 置为成功状态，之后无论存储层是否真的写入，都执行：

```ts
await measureAsync('storage.saveArtwork', () => saveArtwork(artwork))
onSaved()
showToast(options.message ?? '已收进画廊')
```

而 `saveArtwork` 的 IndexedDB 分支 catch 后会退回 localStorage，`writeFallback` 自己又 catch 掉配额/隐私模式错误：

- `src/lib/storage.ts:60-69`：`writeFallback` 失败时“作品就静默不保存”。
- `src/lib/storage.ts:108-111`：IDB 写失败后仅尝试 fallback，不向上报告。
- `src/screens/DrawScreen.tsx:158-162`：先 `savedRef.current = true; setSaved(true)`。
- `src/screens/DrawScreen.tsx:180-182`：无条件 Toast “已收进画廊”。

**影响**

- 浏览器存储满、隐私模式限制、IndexedDB 被清理时，用户看到“已收进画廊”，刷新后作品消失。
- 猜中后的自动保存也走同一路径，用户甚至不会主动检查。
- 这是会直接摧毁信任的数据丢失问题，优先级高于任何视觉优化。

**建议**

让保存返回结构化结果，并让 UI 只在真实成功后置位：

```ts
export type SaveResult = { ok: true; trimmed: number } | { ok: false; reason: string }
```

- IDB 失败且 fallback 也失败时返回 `ok: false`，不要吞掉。
- `persist` 在 `await` 之后再设置 `savedRef` / `saved`；失败时保持 `saved=false`，Toast 改为“没存进去，可能是浏览器存储已满”，并保留一个“再试一次 / 下载这幅”的入口。
- 猜中自动保存失败时，结果层不要显示“已自动收进画廊”，改成“自动保存失败，点这里重试”。
- 补测试：模拟 `localStorage.setItem` 抛错、`indexedDB.open` 失败、事务 abort，断言 UI 层拿到失败结果。

**验收**

在 DevTools 里把站点存储配额压到很小，保存一幅画：界面必须明确报错，不能出现“已收进画廊”；刷新后画廊可以为空，但用户已经被告知。

### P0-2 `docs/` 没有纳入版本控制

**现象**

`.gitignore:17` 写了 `docs/`，`git check-ignore` 确认 `docs/PRD.md` 被忽略，`git ls-files docs` 为空。README 却把 `docs/PRD.md`、`docs/TODO.md` 当作项目结构的一部分。

**影响**

- 新同事/未来的自己 clone 下来看不到 PRD、TODO 和本评审。
- PRD 与代码已经出现漂移（见 6.5），没有版本历史就更难判断哪边是准的。
- 这是一次性配置错误，不是设计取舍；`coverage/`、`dist/`、`.cache/` 应该忽略，`docs/` 不应该。

**建议**

- 从 `.gitignore` 删除 `docs/`，单独提交 `docs/` 下的 PRD、TODO 与 REVIEW。
- 另外建议把 `.env*` 加入 `.gitignore`（当前没有），避免以后接入配置时误提交。
- 如果担心文档体积，可以把“生成物”放 `docs/generated/` 再忽略，而不是整个 `docs/`。

**验收**

`git status` 能看到 `docs/` 变更；`git ls-files docs` 至少包含 `PRD.md`、`TODO.md`、`REVIEW.md`。

## 5. P1：应在一个迭代内修

### P1-1 嵌套弹窗的 Esc 会关闭两层

**已在预览构建复现**：画廊 → 打开作品详情 → 删除 → 按 Esc。结果详情弹窗关闭，删除确认框仍在，用户取消删除后回到了画廊，而不是原来的作品详情。

根因是两个弹窗都直接监听 `window` 的 `keydown`，且没有“谁是顶层”的概念：

- `src/components/ArtworkModal.tsx:30-38`
- `src/components/ConfirmDialog.tsx:26-34`

**建议**：做一个统一的 Dialog 层/栈，Esc 只交给栈顶；或者用原生 `<dialog>` + `showModal()`，让浏览器管理顶层与焦点。临时补 `event.stopPropagation()` 只能解决这一个组合，后续增加第三个弹窗仍会复发。

**验收**：打开删除确认后按 Esc，只有确认框关闭；再按 Esc，详情关闭；焦点回到作品卡片或删除按钮。

### P1-2 弹窗焦点与可访问性

`ArtworkModal` 打开时聚焦关闭按钮，`CategoryPicker` 聚焦搜索框，`ConfirmDialog` 聚焦确认按钮——但没有焦点陷阱、没有关闭后的焦点归还、背景没有 `inert`。`ResultOverlay` 甚至没有 Esc 处理，而 PRD §9 明确要求“模态框 Esc 关闭”。

另外：

- `ConfirmDialog` 默认聚焦危险操作“删除”，键盘用户一按 Enter 就执行破坏性动作；应默认聚焦“取消/留着”。
- `GuessPanel` 的结果区是动态插入的，但没有 `aria-live`；读屏用户点“让 AI 猜猜”后听不到任何答案。
- `CategoryPicker` 的 `role="list"` 下直接放 `<button>`，没有 `role="listitem"`；`BrushToolbar` 在普通 `<div>` 上加 `aria-label`，部分读屏器会忽略。

**建议**

- 抽一个 `Dialog` 基础组件：`role="dialog"`、`aria-modal`、焦点陷阱、Esc、关闭归还焦点、背景 `inert`/滚动锁。
- 危险确认默认聚焦取消项；`danger` 时按钮顺序与颜色都保持“取消优先”。
- 结果区加 `aria-live="polite"`，播报“我猜是月亮，60%；香蕉，32%；西瓜，2%”以及命中/未中结论。
- 修正 `role="list"` 结构和工具组语义（`role="group"` 或 `fieldset`）。

这几项不改变视觉，但会显著改善键盘和读屏体验。

### P1-3 橡皮参与包围盒，识别输入和导出构图都会被带偏

`getInkBounds` 遍历所有 stroke，不区分 `tool`：

```ts
for (const stroke of strokes) {
  for (const point of stroke.points) { ... }
}
```

而它同时被识别预处理和导出使用：

- `src/lib/drawing.ts:185-220`：包围盒包含橡皮点。
- `src/lib/drawing.ts:226`：`strokesToSketch` 用该包围盒做居中和等比缩放。
- `src/lib/drawing.ts:294`：`renderArtwork` 用同一包围盒导出 720px 图。

**影响**

- 在画面外侧擦一下，包围盒变大，主体被缩小、偏移；同一幅画在擦除前后会给模型不同的 28×28 输入。
- 导出图会重新裁切/居中，和画板上的构图不完全一致（我在画廊里看到弧线被放大居中，这是同一原因）。
- `strokeCount` 把橡皮也算作“笔”，低墨量提示里的“已画 X 笔”会偏大。

**建议**

计算包围盒时不要用原始笔迹点，而是先渲染到 112×112 工作画布，再从 alpha 通道找可见墨迹的 bbox；这样橡皮、线宽、颜色都自然被考虑进去。导出复用同一 bbox，保证“画板所见即导出所得”。如果暂时不想改渲染流程，至少：

- 跳过纯橡皮 stroke 的采样点；
- 用 `tool === 'pen'` 的 stroke 计算笔数；
- 为“橡皮在画面外擦除不改变 Top-3”补一个回归测试（可以在 Node 里用 canvas mock，或在 Playwright 里做真实绘制）。

**验收**：画一个居中的圆，记下 Top-3；在圆外远处擦一大片，再猜一次，Top-3 不应发生明显变化；导出图的主体位置与画板一致。

### P1-4 分享卡永远在说“猜中”

`createShareCard` 把印章、标题、置信度写死了：

- `src/lib/share.ts:161-172`：无条件画“猜中!”章。
- `src/lib/share.ts:180-186`：`confidence === null` 时显示“小猜猜中了”。
- `src/lib/share.ts:277-286`：`shareArtwork` 对画廊里任何作品都调用同一个卡片生成器，不传 `success`。

所以从画廊分享一幅**没猜中**的挑战作品，或一幅自由画，都会得到一张盖着“猜中!”的分享图。这不是边缘情况；未命中的作品同样会被收进画廊，而且用户完全可以分享它。

**建议**

- `ShareCardOptions` 增加 `success: boolean` 或 `result: 'success' | 'near' | 'miss' | 'free'`。
- 只在 `success` 时画印章；未中时改为“我的涂鸦”/“这次没猜中”，自由画改为“自由画”。
- 置信度只在“目标词就是 Top-1”时展示；否则展示 Top-1 的名称或干脆不展示百分比。
- `shareImage` 把用户主动取消（`AbortError`）映射成单独的 `'cancelled'`，文案用“已取消分享”，不要报“失败”。
- 生成分享图期间给按钮加 loading/disabled，避免重复点击。

**验收**：分别分享一幅命中、未中、自由画，三张卡片的印章与文案都符合事实。

### P1-5 计时器会漂移，显示用时和实际用时不是同一个来源

`DrawScreen` 用 `setInterval` 每秒减一：

```ts
const timer = window.setInterval(() => {
  setSecondsLeft((current) => (current > 0 ? current - 1 : 0))
}, 1000)
```

而保存时的 `durationMs` 用的是 `Date.now() - startedAt`：

- `src/screens/DrawScreen.tsx:133-139`
- `src/screens/DrawScreen.tsx:174-177`
- `src/screens/DrawScreen.tsx:310-316`（到 0 后触发自动猜测）

**影响**

- 后台标签页的 interval 会被节流，回来时倒计时可能还停在 60 秒，但真实时间已经过了两分钟。
- 计时显示和保存的用时来自不同时钟，极端情况下结果层显示 90 秒，实际已经画了 2 分钟。
- 结果层打开时 interval 被清掉，倒计时暂停；如果这是有意的“结算缓冲”，需要在 PRD 里说明，并让 `durationMs` 也暂停。

**建议**：用 deadline 而不是累减：

```ts
const deadline = useRef(Date.now() + ROUND_SECONDS * 1000)
const remaining = () => Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
```

`setInterval` 只负责刷新显示；`visibilitychange` 时立即重算；`durationMs` 从同一个 deadline 推导。若需要暂停，记录 `pausedAt` 并在恢复时平移 deadline。补 fake timers 单测。

### P1-6 画廊计数与上限裁剪读取了全部图片

- `countArtworks` 调用 `listArtworks`，后者 `getAll()` 把 100 条记录（含 dataURL）全部读进内存：`storage.ts:144-147`。
- `saveArtwork` 每次写入后也 `listArtworks()` 再裁剪：`storage.ts:100-107`。
- App 在挂载和每次回首页时都会 `countArtworks()`：`App.tsx:62-74`；首屏的 mount effect 与 `screen === 'home'` effect 会各触发一次。

100 幅 720px WebP 加上 base64 膨胀通常是数 MB 级；首屏/回首页做一次全量反序列化没有必要，移动端会有可感知的卡顿和内存峰值。

**建议**

- 计数用 `store.count()`。
- 裁剪用 `createdAt` 索引的游标，只取最旧的超出部分；或 `getAllKeys()`（只读 key，不读 image）再按 `createdAt` 排序。
- 中期把 `image` 从 dataURL 字符串改成 Blob，IndexedDB 原生支持 Blob，能省约 33% 的 base64 膨胀和一次字符串编解码。
- 给作品记录加 `schemaVersion`，为后续迁移留余地。

### P1-7 模型标签与词卡数据没有一致性校验

训练脚本按 `categories.json` 的顺序生成 labels，浏览器端按 `model.json` 的 labels 建索引，再用 `findCategory` 映射中文名。这条链路目前靠“训练时恰好用了同一份文件”维持，运行时没有校验：

- `src/lib/classifier.ts:119-141`
- `src/lib/categories.ts:1-13`
- `src/data/categories.json` 与 `public/model/model.json` 各 100 项

一旦有人改了词表、增删类别、或换了一版权重而忘记重新训练，结果会显示成英文 id 或 `❓`，甚至概率条和名称错位。

**建议**：加载时校验 `labels.length === lastLayer.out`、`labels` 集合与 `CATEGORIES` 的 id 集合相等，并给出明确错误（“模型与词卡版本不一致，请重新训练或更新模型”）。加一个单测，用故意不匹配的 mock metadata 断言报错。

### P1-8 结果区缺少可感知的播报

`GuessPanel` 把结果渲染成 `<ol>`，但没有 live region。视觉用户看到翻牌动画，读屏用户点“让 AI 猜猜”后只会听到按钮变成“再猜一次”，不知道答案。

**建议**：给结果容器加 `aria-live="polite"` 和 `aria-atomic="false"`，并在结果出现时用一句可读的总结（排名、名称、百分比、结论）填充一个视觉隐藏的 live 区域。参考 `Toast` 已有的 `role="status"` 写法。

### P1-9 720px 图片放大到 1080px 导出

`persist` 保存的是 `canvas.exportImage(720)`；`downloadArtwork` 把这个 720px 的 WebP 画到 1080×1080 的 PNG 上。像素不会凭空增加，所谓“1080 导出”只是放大。

**建议**：要么保存时同时生成 1080 的渲染（存储增加约一倍），要么把文案改成“导出 1080（由 720 放大）”，或者从原始 strokes 重新渲染 1080（需要保存 strokes，成本更高）。对当前产品，最实际的是把下载图改为 720 或 900，避免给用户“高清”的错觉。

## 6. P2：工程、性能与文档债务

### 6.1 开启 TypeScript strict

`tsconfig.app.json` 没有 `strict`，`tsc --showConfig` 确认 `strictNullChecks` 等均未开启。好消息是我用 `--strict` 跑了一遍当前代码，**0 error**，说明开启成本几乎为零；不开则后续新增代码没有空值/隐式 any 的兜底。

建议先加 `"strict": true`；`noUncheckedIndexedAccess` 会带来 44 个错误，可以放到下一轮单独处理，不要一次全开。

### 6.2 字体是首屏最大资产

`zcool-kuaile.woff2` 726,052 字节（约 726KB / 709KiB），是 JS（293KB / 92KB gzip）之外最大的单项。对一个 100 个词的小游戏来说偏重，尤其在弱网移动端。

建议用 `pyftsubset`/Fontmin 按“UI 文案 + 100 个中文词 + 常用标点”做子集，通常能压到 100–200KB；保留 `font-display: swap`，并对 woff2 加 `<link rel="preload">`。如果不想维护子集，至少评估系统字体回退方案。

### 6.3 模型无条件预加载

`App` 挂载时就 `loadClassifier()`，首页用户也会下载 552KB 权重。当前设计能保证进入画板时模型已就绪，但代价是首屏流量。

建议在 `requestIdleCallback` / 首次交互后再预取，或在进入画板时加载并利用已有的“热身”状态。若保留预加载，至少给 `weights.bin` 配置长期缓存和带 hash 的文件名，避免更新模型后用户拿到旧权重。

### 6.4 移动端视口

多处 `100vh`，在 iOS Safari / Android Chrome 地址栏收放时会出现底部被裁或画板尺寸跳变。建议改成 `100dvh`（带 `100vh` 回退），并给画板尺寸留一个 `min()` 下限，横屏时避免缩得过小。`index.html` 的 viewport 没有 `viewport-fit=cover`；如果未来做 PWA/全屏，`env(safe-area-inset-*)` 才会真正生效。

### 6.5 文档漂移清单

这些不是“代码错”，而是文档和实现已经不一致，建议以代码常量为准更新 PRD：

| 文档说法 | 代码实际 |
|---|---|
| 笔刷 6 / 14 / 28（PRD §6.2） | 6 / 16 / 30（`drawing.ts:76-80`，测试也断言 16/30） |
| 墨量阈值 < 2%（PRD §6.2） | `MIN_INK_RATIO = 0.015`（`DrawScreen.tsx:33`） |
| 画廊图 WebP q0.82（PRD §8.3） | q0.85（`drawing.ts:332`） |
| 字体 `@fontsource/zcool-kuaile`（PRD §4.3） | 自托管 woff2（`tokens.css:1-7`） |
| 超过 100 幅“删除最旧并提示”（PRD §6.4） | 静默删除（`storage.ts:100-107`），无提示 |
| Node 20+（README） | Vitest 5 要求 `^22.12.0 || ^24.0.0`；Vite 8 要求 `^20.19.0 || >=22.12.0` |
| “项目目前不是 git 仓库”（TODO 第四节） | 实际是 git 仓库，`b0eae07` 为初始提交 |
| 每类 1200 张（README） | 过滤低墨量后训练集 108,000 张（约 1,080/类），验证集 11,994 张 |

建议把笔刷尺寸、阈值、质量等抽成导出常量，PRD 只写“见 `drawing.ts` 的 `BRUSHES`”，避免第三次漂移。

### 6.6 撤销栈与死代码

- `MAX_HISTORY = 60` 在 `drawing.ts:3` 导出，但没有任何地方使用；`CanvasBoard` 的 `strokesRef` 无上限。长时间作画时，点数组会持续增长。
- `offTrack` 在 `GuessPanel` 里有完整 UI 分支（`GuessPanel.tsx:20, 108, 235`），但 `DrawScreen` 从未传入。
- `getLoadedClassifier`、`getInkRatio`、`onStrokeEnd`、`disabled` 均未被调用/传入。

建议删除或接线。尤其是 `MAX_HISTORY`，它给读者“已实现 60 步上限”的错误印象。

### 6.7 测试与 CI

- Vitest 只扫描 `src/**/*.test.ts`，`.tsx` 组件测试不会被收集（`vitest.config.ts:5-7`）。
- 现有 28 个用例只覆盖 `lib/`；核心的“画 → 猜 → 存 → 画廊”没有自动化。
- 没有 `.github/workflows`；TODO 里“真正的 CI workflow”仍待办。
- `pnpm check` 允许 lint warning 通过；目前 `DrawScreen.tsx:315` 有一个 `set-state-in-effect` warning。这个 warning 本身有道理：超时自动猜测可以在 timer 回调里触发，而不是用 effect 监听 `secondsLeft`。

建议：

- 把 `vitest.config.ts` 的 include 改成 `src/**/*.test.{ts,tsx}`。
- 加 Playwright 冒烟：绘制一段路径 → 断言 Top-3 出现 → 保存 → 画廊有 1 幅；再加一个“弹窗 Esc 只关一层”的用例。
- CI：`pnpm install --frozen-lockfile` → `lint` → `test` → `build`；`verify:model` 因依赖外网，作为可选 job 或手动触发。
- 给 `storage` / `drawing` / `stats` 加覆盖率阈值，先从 60% 开始，不追求数字。

### 6.8 统计口径

`recordGuess` 在每次挑战猜测时调用，包括自动猜测和同一幅画的重复猜测。用户猜 5 次命中 1 次，猜中率是 20%。这可能是有意的“按尝试计”，但首页写的是“猜中率”，结果层又按“本轮”给反馈，语义容易混。

建议二选一并在文案/PRD 中写清：

- 按轮次：每幅画只记一次，首次猜测时计分；
- 按尝试：保留现状，但把标签改成“命中率（按尝试）”。

### 6.9 其他可靠性细节

- `App.tsx:78` 用 `Date.now()` 作为 session id，同一毫秒内重开可能碰撞；用自增计数器更稳。
- `DrawScreen.tsx:382,390,398` 用 `inkRatio > MIN_INK_RATIO` 判断未保存，而 `canGuess` 用 `>=`（`109-110`）；统一成一个谓词。
- `saveArtwork` 失败后 `databasePromise` 仍缓存 `null`，本次会话不会重试；可接受，但如果失败是瞬时的，用户只能刷新。
- 分享图的剪贴板竞态：1.8 秒超时后走下载，但剪贴板写入可能随后成功，出现“下载 + 已复制”双结果；可以把超时后的剪贴板 promise 结果忽略，或先探测权限。
- `savedRef` 在任何笔数变化时重置，保存后撤销一笔再保存会产生两幅几乎相同的作品；建议用内容 hash/快照判断是否真的变了。
- 超时自动猜测在模型尚未就绪时会消耗掉唯一一次自动机会：`autoGuessRef` 在调用前就置 true（`DrawScreen.tsx:310-316`），而 `handleGuess` 会因 `modelState !== 'ready'` 直接返回。建议模型就绪后再补一次自动猜测，或让倒计时从模型 ready 开始。
- 置信度展示不一致：`GuessPanel` 对 `<5%` 显示“瞎猜的”（`GuessPanel.tsx:192-196`），`ArtworkModal` 仍显示“2%”（`ArtworkModal.tsx:87-97`）。统一规则，避免同一份数据两种说法。

## 7. 识别系统专项

### 7.1 现状

| 项目 | 数值 |
|---|---|
| 类别 | 100 |
| 结构 | 784 → 512 ReLU → 256 ReLU → 100 softmax |
| 训练样本 | 108,000（过滤后，约 1,080/类） |
| 验证样本 | 11,994 |
| Epoch | 18 |
| 验证 Top-1 / Top-5 | 59.42% / 83.91% |
| 新样本复核（5 类 × 20 张） | 57.0% / 83.0% |
| 权重体积 | 552KB（int8）+ 4.9KB metadata |

这是一个“能玩”的模型，但还不是“猜得准”的模型。Top-1 59% 意味着大约每 5 次有 2 次首选是错的；Top-5 84% 说明大部分时候正确答案在候选里，只是没排第一。

### 7.2 现在的指标不能直接当成产品准确率

1. **没有独立测试集**：`train.py:464-484` 按验证集 Top-1 选最佳 epoch，报告的 59.42% 是在同一验证集上选出来的，偏乐观。
2. **复核样本太小**：`verify-model.mjs` 只用 5 个类别、100 张图，95% 置信区间大约 ±10 个百分点；它证明“导出的权重没坏”，不足以证明“用户画得像时能猜中”。
3. **训练/推理存在分布差**：训练用 QuickDraw 的 28×28 位图，推理用浏览器把矢量笔迹重绘成 28×28。虽然 `strokesToSketch` 努力对齐（居中、等比、固定线宽），但抗锯齿、擦除、笔宽归一化、颜色转黑仍不同。这个 gap 没有被测量。
4. **没有按类别看**：100 类里必然有强弱项，猫/狗、老鼠/兔子、鲸鱼/鱼这类近义/近形类别会互相吸走概率。只报总体 accuracy 会掩盖最差的那几类。

### 7.3 建议的模型升级顺序（按 ROI）

1. **先建 golden set（最高优先级）**
   - 用真实用户在画板上画的 20–50 幅/类，保存 stroke JSON（或截图 + 预处理后的 28×28），在 Node 里用同一套 `strokesToSketch` 重放并评估。
   - 这能直接回答“真实准确率是多少”，也是后续所有模型改动的基线。
2. **加独立测试集**
   - 每类留 200 张完全不参与训练/调参的样本；报告 Top-1/Top-5 和每类召回。
   - 输出混淆矩阵，找出最差的 10 类。
3. **换小 CNN**
   - 28×28 输入，3 个 conv + BN + pool 的轻量 CNN（约 10–30 万参数），int8 后通常仍在 200–400KB。
   - 对 100 类简笔画，CNN 通常能显著优于 784→512→256 的 MLP；具体收益要实测，不要直接写进宣传。
4. **加数据与正则**
   - 每类 3,000–5,000 张；弹性形变、随机擦除/断笔、更强的旋转/缩放；weight decay + early stopping。
   - 现有增强已经不错，但边界处的 `valid` 掩码会把边缘像素清零（`train.py:219`），可以改成边缘复制而不是置零。
5. **词表治理**
   - 按各类召回决定保留/替换/合并。如果某类长期低于 40%，它就在持续制造“AI 好笨”的体验。
   - 100 个词是产品承诺，但“100 个都认得”比“100 个里 30 个靠运气”更重要。

### 7.4 不换模型也能提升体验的做法

如果模型升级排不上期，产品层可以先兜住 59%：

- **Top-3 算赢**：现在 Top-3 只是“差一点”，可以改成“算你赢，但分数低一点”；Top-5 84% 会让体验顺很多。
- **展示 Top-5**：候选里出现目标词的概率更高，用户会觉得“它其实知道”。
- **连续猜测**：像 QuickDraw 一样，边画边让 AI 每 2 秒猜一次，而不是只按一次按钮；过程比结果更有趣。
- **三选一词卡**：一次给 3 个词让用户挑，避开自己不会画的；同时降低“抽到海龟”的挫败感。
- **提示模式**：显示目标词的类别/首字/笔画数，或允许一次“缩小范围”。
- **分数制**：Top-1 3 分、Top-3 1 分、未中 0 分；比二元命中更能反映“接近”。

## 8. 建议的修改路线图

| 阶段 | 时间 | 内容 | 产出 |
|---|---|---|---|
| 0. 决策 | 0.5 天 | 确定统计口径（轮次/尝试）、Top-3 是否算赢、是否保留 90 秒 | 更新 PRD 的“结果判定”和“统计”两节 |
| 1. 可信度 | 1 天 | P0-1 保存结果、P0-2 docs 入库、P1-1 Esc、P1-2 焦点、P1-4 分享卡、P1-7 标签校验 | 一轮可回归的 PR，附 4 个测试 |
| 2. 正确性 | 2–3 天 | P1-3 橡皮包围盒、P1-5 deadline 计时、P1-6 计数/裁剪、P1-9 导出尺寸 | 识别输入稳定，存储不再全量读图 |
| 3. 体验/性能 | 2–3 天 | 字体子集、模型延迟加载、`100dvh`、结果 live region、移动端真机验收 | 首屏更轻，移动端不裁切 |
| 4. 工程化 | 3–5 天 | strict、CI、Playwright 冒烟、覆盖率门槛、路由/hash 状态 | 后续改动有自动兜底 |
| 5. 模型 v2 | 1–2 周 | golden set、独立测试集、CNN、按类召回、词表治理 | 真实 Top-1 目标 ≥ 65%，Top-5 ≥ 90% |
| 6. 可选 | 持续 | PWA/离线、备份/恢复、画廊筛选、连续猜测、分享模板 | 留存与传播增强 |

**如果只有一天**：做阶段 1。它修的是“用户会不会被骗/被卡住”，比任何视觉优化都值。

## 9. 测试与验收清单

### 9.1 建议新增的单测

- `storage`：IDB 写失败 + localStorage 也失败 → 返回失败；100 幅上限裁剪不读取 image；`count` 不调用 `getAll`。
- `drawing`：橡皮-only 笔迹不影响包围盒；画面外擦除不改变 `sketch` 的墨迹范围；`renderArtwork` 与 `strokesToSketch` 使用同一 bbox。
- `DrawScreen`：fake timers 下 90 秒到点只自动猜一次；后台标签恢复后倒计时立即校正；`durationMs` 与显示一致。
- `share`：`success=false` 时卡片不出现“猜中”；取消分享返回 `cancelled`。
- `classifier`：labels 数量与最后一层 `out` 不符时报错；labels 与 `categories.json` 集合不一致时报错。
- `stats`：同一幅画重复猜 5 次，按选定口径只计 1 次（或明确按 5 次）。

### 9.2 建议新增的 E2E

1. 首页 → 开始画画 → 画三笔 → 猜 → 出现 3 条结果 → 保存 → 画廊 1 幅。
2. 画廊 → 打开详情 → 删除 → Esc 只关确认框 → Esc 关详情。
3. 390×844 视口下：首页无横向滚动；画板、工具栏、AI 面板、底部猜测条不重叠。
4. 结果出现后，`aria-live` 区域包含目标词与 Top-1。
5. 分享失败/取消时不出现“已分享”错误提示。

### 9.3 性能与质量预算

- 首屏传输（gzip/brotli 后）：JS ≤ 100KB，CSS ≤ 15KB，字体 ≤ 250KB，模型 ≤ 600KB。
- 移动端 p95 推理 ≤ 30ms；`toSketch` ≤ 20ms。
- 100 幅画廊：回首页不触发全量图片反序列化；内存峰值可控。
- 无障碍：axe 无 critical/serious；键盘可完成除绘画外的所有操作；焦点可见。

## 10. 本轮验证记录

| 命令/动作 | 结果 |
|---|---|
| `pnpm lint` | 0 error，1 warning：`DrawScreen.tsx:315` 的 `set-state-in-effect` |
| `pnpm test` | 6 个文件、28 个用例全部通过 |
| `pnpm build` | 通过；`index.js` 293.19KB（gzip 92.40KB）、`index.css` 44.64KB（gzip 9.80KB）、字体 726.05KB |
| `pnpm verify:model` | 100 张新样本：Top-1 57.0%、Top-5 83.0% |
| `tsc --strict`（仅命令行覆盖） | 0 error，说明开启 strict 成本极低 |
| 浏览器走查 1280×720 | 抽词“鱼” → 画弧 → 超时自动猜 → 保存 → 画廊 1 幅 → 详情显示 90 秒；删除确认中按 Esc，详情层被关闭而确认框残留 |
| 浏览器走查 393×852 | 首页布局正常、无横向滚动；移动端画板交互未做完整真机验收 |

**未验证/无法确认**：真实触控笔的压力曲线、iOS Safari 的动态地址栏表现、实际 3G/4G 首屏时间、不同读屏器的播报效果、分享到各平台的实际落图效果。这些需要真机或专门的设备实验室。

## 11. 不建议做的事

- **不要为了“AI 感”引入云端模型**。本地识别是这个产品最强的差异点；换云会同时失去隐私叙事、离线能力和零成本部署。
- **不要上虚拟滚动**。100 幅上限 + `content-visibility` + `memo` 已经够用，虚拟化会破坏错落纸张布局。
- **不要重写成 Next.js/SSR**。这是一个纯前端单页小游戏，Vite 静态部署是正确选择。
- **不要加全局状态库**。当前 prop drilling 的规模完全可控，抽几个 hook 比引入 Zustand/Redux 更合适。
- **不要先做分享模板/多尺寸导出**。分享卡的事实正确性（P1-4）比模板数量重要。
- **不要为了指标把模型吹成“高准确率”**。59% 就是 59%，把 Top-3/Top-5 的体验设计好，比改文案诚实也有效。

## 12. 一句话总结

**这是一个“已经能玩、也值得被更多人玩到”的项目；下一步的重点不是再加功能，而是让每一条成功提示都真实、每一个弹窗都可预期、每一次猜测都有可解释的准确率。**
