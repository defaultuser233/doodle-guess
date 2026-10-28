# 评审修复记录

> 对应评审：`docs/REVIEW.md`（2026-10-26）
> 修复日期：2026-10-27
> 验证：`pnpm check`（lint / 43 个单测 / 覆盖率门禁 / build）全部通过

## P0 — 已修复

| 编号 | 处理 |
|---|---|
| P0-1 保存失败仍提示成功 | `saveArtwork` 现在返回 `{ ok, trimmed, reason }`；IndexedDB 写失败不再静默复制到 localStorage（那会变成读不到的数据）。`DrawScreen.persist` 只在真实成功后置位 `saved`，失败时回滚并提示“没存进去，可能是浏览器存储已满”。新增“localStorage 也不可用时返回失败”的单测。 |
| P0-2 docs 未入库 | 已从 `.gitignore` 删除 `docs/`，并补充 `.env` 忽略规则。当前 `docs/` 在工作区为未跟踪状态，需执行一次 `git add docs` 并提交。 |

## P1 — 已修复

| 编号 | 处理 |
|---|---|
| P1-1 嵌套弹窗 Esc 连关两层 | 新增 `lib/dialogStack.ts` + `hooks/useDialogFocus.ts`，统一维护弹窗栈；Esc 只交给栈顶。已在浏览器复现路径验证：详情 → 删除 → Esc 只关确认框，再按 Esc 才关详情。 |
| P1-2 焦点与可访问性 | 同一套 Dialog 逻辑提供 Tab 焦点陷阱、关闭后焦点归还、页面滚动锁；弹窗通过 `DialogPortal` 渲染到 `document.body`，打开时对 `.app__screen` 设置 `inert`。`ConfirmDialog` 默认聚焦“取消/留着”，不再默认聚焦危险按钮。`ResultOverlay` 补齐 Esc。`GuessPanel` 增加 `aria-live` 结果播报；词卡列表改为 `role="group"`。 |
| P1-3 橡皮参与包围盒 | `getInkBounds` 跳过橡皮点；新增 `getVisibleInkBounds`，按渲染后的 alpha 计算可见墨迹边界，`strokesToSketch` 与 `renderArtwork` 共用。浏览器实测：圆外远处擦一大片后再次猜测，Top-3 与擦除前完全一致。笔数统计改为 `penStrokeCount`，橡皮不再计入“已画 X 笔”。 |
| P1-4 分享卡永远“猜中” | 分享卡新增 `status: success / near / miss / free`：只有 success 盖“猜中!”章，near 盖“差一点”，miss/free 不盖章；副标题按状态显示“AI 的把握 / 差一点 / 这次没猜中 / 自由画”。系统分享取消映射为 `cancelled` + “已取消分享”。已实测 miss 作品分享卡，显示“这次没猜中”。 |
| P1-5 计时器漂移 | 改为绝对 deadline + 250ms 刷新，显示、自动猜测、`durationMs` 共用同一时钟；`visibilitychange` 时立即校正。模型未就绪时会等到 ready 再触发一次自动猜测，不再提前消耗机会。 |
| P1-6 画廊计数/裁剪读全图 | `countArtworks` 使用 `store.count()`；上限裁剪使用 `createdAt` 索引的 `openKeyCursor`，只读 key 并删除最旧记录，不再 `getAll()` 读取图片。 |
| P1-7 模型标签无校验 | 加载时校验最后一层输出维度 = labels 数量，且 labels 集合与 `categories.json` id 集合一致；不一致时给出明确错误。新增对应单测。 |
| P1-8 结果无播报 | `GuessPanel` 新增 `role="status"` / `aria-live="polite"` 的视觉隐藏摘要，播报 Top-3、把握度与命中结论。 |
| P1-9 720 放大到 1080 | 下载改为按作品实际尺寸导出（默认 720×720），不再放大。已实测下载 PNG 为 720×720。 |

## P2 — 本轮已处理

| 编号 | 处理 |
|---|---|
| P2-1 strict | `tsconfig.app.json` 开启 `"strict": true`，构建 0 error。 |
| P2-2 字体体积 | 按 UI 实际用字子集化，`zcool-kuaile.woff2` 从 726KB 降到 **55.5KB**；已核对原字体中存在但子集缺失的字形为空。 |
| P2-3 模型首屏预加载 | 改为 `requestIdleCallback`（无此 API 时 1.4s 后）预取；进入画板仍会按需加载。 |
| P2-4 撤销栈死常量 | 删除未使用的 `MAX_HISTORY`，PRD 改为“按笔迹重放，不设固定步数上限”。 |
| P2-5 100vh | 关键布局补 `100dvh`，`index.html` 加 `viewport-fit=cover`。 |
| P2-6 文档漂移 | 更新笔刷 6/16/30、墨量 1.5%、WebP q0.85、字体自托管、裁剪提示、下载尺寸、Node 22.12+、测试数量等。 |
| P2-7 CI / E2E / 覆盖率 | `.github/workflows/ci.yml` 跑 lint → coverage → build；新增 Playwright 冒烟（画 → 猜 → 存 → 画廊 → 嵌套弹窗 Esc；导出 → 清空 → 导入恢复），`pnpm test:e2e` 2 passed；Vitest 核心 lib 行覆盖 94.86%，门槛 60%。E2E 未纳入 CI。 |
| P2-8 裁剪静默 | 保存结果带 `trimmed`，Toast 会提示“已清理最旧的 N 幅”。 |
| P2-9 统计口径 | 首页标签改为“命中率”，并标注“按每次猜测计算”。 |
| P2-10 死代码 | 删除 `getLoadedClassifier`、`getInkRatio`、`onStrokeEnd`、`disabled`、`offTrack`、`MAX_HISTORY`。 |
| P2-11 路由 | 增加 hash 路由：`#gallery` / `#draw` 可直接打开，`pushState` + `popstate` 支持浏览器前进/后退；`#draw` 无会话时自动开一局。已在浏览器验证直达与前进/后退。 |
| P3-1 PWA / 离线 | 接入 `vite-plugin-pwa`，生成 manifest、192/512/maskable 图标与 Service Worker；precache 18 个资源（约 1MB），含 `weights.bin` 和字体。已实测预览构建断网刷新、进入画板并显示 AI 在线。 |
| P3-3 备份 / 恢复 | 画廊新增「导出备份 / 导入备份」：JSON 包含画作、目标词、Top-3 与来源；导入校验 app/版本/字段/图片 data URL，跳过无效记录，最多 200 幅。Playwright 已验证「导出 → 清空 → 导入恢复」。 |
| P3-4 贝塞尔平滑 | 笔迹渲染改为经过中点的二次贝塞尔曲线，低采样率下减少折线；分类器仍使用原始点。渲染测试断言平滑路径被调用。 |
| P3-5 CSP / 安全头 | 生产构建注入严格 CSP meta；主题初始化脚本外置；`public/_headers` 提供 Netlify 风格安全响应头。已在生产构建下验证加载、模型推理、Service Worker 与断网运行。 |

## 尚未处理

- 代码层评审项已全部处理；模型 v2 / golden set 属于后续产品迭代，不在本轮缺陷修复范围。
- Playwright E2E 目前本地运行，未纳入 CI。

## 验证记录

- `pnpm lint`：0 warnings / 0 errors
- `pnpm test`：9 个文件、43 个用例通过；覆盖率行 94.86%
- `pnpm build`：通过；字体 55.91KB，JS gzip 约 94KB
- `pnpm test:e2e`：2 passed（本机 Edge）
- `pnpm check`：lint / coverage / build 全通过
- CSP：生产构建无 console error，Service Worker + 离线模型正常
- PWA：预览构建断网刷新成功，离线后模型仍为「在线」
- 备份：导出 → 清空 → 导入恢复 1 幅作品
- 浏览器：嵌套弹窗 Esc、焦点归还、分享 miss 卡、720 下载、圆外擦除后 Top-3 不变、hash 直达/前进后退
