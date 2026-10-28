# 「画个啥」改进状态

> 更新：2026-10-23 · 基于 v1.0 代码基线
>
> 这份文档记录 TODO 的最终处理结果。最新一轮评审修复见 `docs/REVIEW-RESPONSE.md`。原建议中已经过时或技术上不成立的项，也保留说明，避免以后重复返工。

## 一、已完成

### 产品与体验

- [x] 墨量指导：`GuessPanel` 在 AI ready 但墨量不足时显示「已画 X 笔 · 再补几笔，AI 才看得清」。
- [x] 自由画「存为挑战」：新增词卡选择器，可给自由画指定目标词，以挑战作品保存，并标记来源 `origin: 'free'`。
- [x] 首页命中率为 0 时显示「还没有过招，去画一张试试」。
- [x] 清空画布确认文案缩短为「画布会被清空，所有笔迹都将丢失。」

### UI / CSS

- [x] 移除首页桌面端漂浮装饰（`.floaters` / `.floater`），保留水彩纸背景与手绘主体。
- [x] Toast 底部加入 `env(safe-area-inset-bottom)`。
- [x] 画廊卡片 hover 不再把随机旋转归零，保持手账感。
- [x] 印章与进度条动画统一为 `0.5s var(--ease-bounce)`。
- [x] 全项目 `border-radius` 收进 `--radius-*` token；手绘不对称圆角保留为语义化 token。
- [x] 增加 `--tracking-body: 0.02em`，正文显式 `font-weight: 400`，标题继续使用展示型字距。
- [x] 暗色模式：跟随系统偏好，顶栏可手动切换并记忆；深色文件单独放在 `theme-dark.css`，画板保持浅色纸面。
- [x] Error Boundary：`main.tsx` 包裹 App，渲染异常时展示纸张风格兜底与重新加载按钮。
- [x] Toast / 详情 / 词卡选择器在移动端与安全区下可用。

### 代码与性能

- [x] `strokesToSketch` 复用模块级 112×112 / 28×28 canvas，避免每次猜测分配新画布。
- [x] 统一 `SKETCH_ALPHA_CUTOFF = 30`，`strongest` 判断与 `sketchInkRatio` 使用同一语义。
- [x] 新增 `lib/perf.ts`，开发环境记录 `toSketch`、`predict`、`saveArtwork` 耗时；生产构建自动失效。
- [x] 画廊卡片 `React.memo` + `loading="lazy"` + `decoding="async"` + `content-visibility`，100 幅上限下不引入虚拟滚动。
- [x] 分享战绩：Canvas 生成 1080×1350 分享图，依次尝试 Web Share、剪贴板图片、下载。
- [x] 分类器单例与失败重试已有实现，补充了回归测试。
- [x] `makeArtworkId` 保留 `crypto.randomUUID` 不可用时的 fallback（纯 HTTP / 非安全上下文仍可用），补充注释。

### 工程化

- [x] Vitest + fake-indexeddb：drawing / stats / storage / classifier / theme / share，共 43 个用例。
- [x] 脚本：`pnpm test`、`pnpm test:watch`、`pnpm check`。
- [x] README 增加测试、暗色模式、分享、存为挑战、工程结构说明。
- [x] `.gitignore` 增加 `coverage/`。
- [x] `scripts/verify-model.mjs` 已存在，`verify:model` 脚本可正常索引到。

## 二、核实后不采纳 / 无需改动

- **README / .gitignore / verify-model.mjs 缺失**：均已存在，无需重复创建。
- **模型加载无缓存**：`loadClassifier` 已是 promise 单例，失败会重置；不需要再加初始加载 flag。
- **模型错误无兜底**：`GuessPanel` 已有「模型没加载出来 + 重试」状态，本轮只补了全局 Error Boundary。
- **BASE_URL 与 `base: './'` 不一致**：当前为单页应用、无前端路由，`import.meta.env.BASE_URL` + 相对路径在生产与开发下均自洽；用 `pnpm build && pnpm preview` 验证 200，不引入 `VITE_BASE_URL`。
- **TypeScript ~6.0.3 过旧**：不做无依据的版本升降级；以当前 `pnpm build` 类型检查通过为准。
- **完整虚拟滚动**：画廊上限 100 幅，且网格是错落纸张布局；`memo + lazy + content-visibility` 已覆盖主要开销，虚拟化会破坏布局且收益有限，不采纳。
- **`makeArtworkId` 移除 fallback**：`crypto.randomUUID` 需要安全上下文，纯 HTTP 部署会退化；保留 fallback 更稳。
- **`loadClassifier` 重试重复加载**：失败后重试本来就是预期行为，已有单例与重置测试。

## 三、验证

```bash
pnpm lint
pnpm test
pnpm build
pnpm preview
```

- lint：0 error（已有的 effect / purity warning 不作为阻塞项）。
- test：9 个测试文件、43 个用例通过；覆盖率行 94.86%。
- build：TypeScript 与 Vite 构建通过。
- preview：模型两份资源均为 200；暗色模式、自由画存为挑战、详情弹窗、移动端布局手动验收。
- `pnpm verify:model` 依赖外部 QuickDraw 数据，网络允许时执行，不作为 CI 阻塞项。

## 四、后续可选

- [ ] 完整分享卡片模板 / 多尺寸导出。
- [ ] 画廊按来源、词卡筛选。
- [x] 真正的 CI workflow：`.github/workflows/ci.yml`（lint / coverage / build）。
- [x] Playwright 冒烟：画 → 猜 → 存 → 画廊 → 嵌套弹窗 Esc（`pnpm test:e2e`）。
- [x] PWA / 离线：Service Worker 预缓存页面、模型、字体；断网刷新与模型加载已验证。
- [x] 画廊 JSON 备份 / 恢复：导出、清空、导入的 Playwright 流程通过。
- [x] 自由画未猜测时可直接保存（`直接保存这幅`）。
- [x] 画布二次贝塞尔平滑（分类器仍使用原始点）。
- [x] 生产 CSP + `public/_headers` 安全头；CSP 下加载、推理、离线均已验证。
- [x] Vitest 覆盖率门禁：核心 lib 行覆盖 94.86%，阈值 60%。
- [ ] 更细的触控笔压力曲线调校。
