# 架构说明

## 目录结构

- `src/background/`：MV3 service worker。通过 `apiListenerFactory` 把 content script 的
  `runtime.sendMessage({ contentScriptQuery })` 转发到 B 站接口，统一处理后处理链（`AHS`）。
- `src/contentScripts/`：注入 B 站页面的 Vue 应用（`#bewly` Shadow DOM）。
  - `views/App.vue`：顶层布局、页面切换、**主滚动容器**（原生 `div.bewly-scroll-container`）。
  - `views/Home/`：首页各 Tab（ForYou/Following/Trending/Ranking/...）。
  - `styles/`：基础样式与页面级样式（按页注入，见下文）。
- `src/components/`：通用组件（VideoCard、TopBar、Dock、Settings 等）。
- `src/composables/`：复用逻辑（键盘导航、网格布局、列表页行为等）。
- `src/logic/`：设置持久化（`storage.ts`）与全局状态。
- `tests/e2e/`：Playwright 端到端测试与 B 站首页快照。

## 构建产物

- `extension/`：最终加载目录（manifest + dist）。
- `extension/dist/contentScripts/index.global.js`：单个 IIFE 包（含全部组件）。
- `extension/dist/contentScripts/style.css`：基础样式；页面级样式单独输出到
  `extension/dist/styles/pages/*.css`，运行时按 URL 注入。
- `extension.zip`：`pnpm run pack:zip` 产出，供加载未打包扩展使用。

## 样式注入机制

1. `scripts/build-pages-styles.mjs` 用 dart-sass 将页面级 SCSS 编译到
   `dist/styles/pages/`。
2. `src/styles/adaptedStyles/index.ts` 通过 `injectPageStyle('xxx')` 在对应页面
   URL 下动态插入 `<link>`。
3. 效果：主 `style.css` 从约 583 KB 降到约 394 KB，页面样式按需加载。

## 键盘卡片导航

见 `docs/keyboard-navigation.md`。

## 后台消息协议

content script 调用 `api.*` → `browser.runtime.sendMessage({ contentScriptQuery, ...params })`。

- `src/background/messageListeners/api/index.ts` 在启动时注册 `onMessage`。
  **注意**：必须直接注册，不能依赖 `onConnect` 回调（内容脚本的 `sendMessage`
  不会建立端口，否则监听器永远不注册、所有接口返回 `undefined`）。
- 监听器返回 `true` 保持消息通道，异步 `sendResponse` 返回结果；失败时返回 `undefined`。
- content script 侧在 `src/utils/api.ts` 有 3 秒超时与一次重试，失败会
  `console.warn`，便于发现类似"接口静默失败"的问题。

## content script 拆分评估（P2-2）

当前构建为 Vite lib 模式 + IIFE 单入口，**动态 import 会被内联进单文件**
（产物中无 `import(`），因此无法产出按需 chunk。继续拆分需要：

1. 用 tsup/esbuild 多入口生成独立 chunk，并让 content script 通过
   `chrome.runtime.getURL` 动态加载（需同步调整 manifest web_accessible_resources）；或
2. 将冷路径（设置面板、搜索页）改为独立 content script，按页面匹配注入。

两条路径都会改变扩展加载与打包方式，风险较高，**暂缓**；当前单文件 1.03 MB、
gzip 后约 300 KB，首屏影响可接受。

## API 类型化计划（P2-1）

`src/utils/api.ts` 已提供 `APIResult<T>` 类型定义。现状是接口返回仍为 `any`
（大量调用处使用具体 `XxxResult` 类型标注，直接换成 `APIResult` 会因 `ttl` 等
必填字段冲突）。迁移计划：

1. 逐接口把 `XxxResult` 改为 `APIResult<XxxData>`（`data` 泛型化），从高频接口
   （`video.getRecommendVideos`、`ranking.getRanking`）开始；
2. 每次迁移单个接口并更新调用处，避免一次性大改；
3. 最终移除返回类型中的 `any`。
