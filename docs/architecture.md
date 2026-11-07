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

## content script 拆分（已实现）

### 结构

- `dist/contentScripts/loader.js`：主 content script（极简 IIFE），运行时
  `import(chrome.runtime.getURL('dist/contentScripts/esm/index.js'))` 加载 ESM bundle。
- `dist/contentScripts/esm/index.js`：ESM 主 bundle（约 804 KB，原 IIFE 约 1.03 MB）。
- `dist/contentScripts/esm/chunks/*.js`：冷路径与第三方依赖的按需 chunk
  （如 `Settings-*.js`、`Home-*.js`、`vue.runtime-*.js`、`vuedraggable-*.js`）。
- `dist/contentScripts/esm/style.css`：基础样式（manifest 注入）。

### 构建

- `vite.config.content-esm.ts` 负责 ESM 分包构建（`chunkFileNames: 'chunks/[name]-[hash].js'`）。
- `package.json` 的 `build:js` 指向该配置；`scripts/prepare.ts` 生成 `loader.js`。
- `src/manifest.ts` 的 `content_scripts` 指向 loader，`web_accessible_resources` 暴露
  `dist/contentScripts/esm/*`（chunk 需要被运行时 import 加载）。

### 冷路径拆分原则

- 全局组件注册（`src/components/index.ts`）用 `import.meta.glob` 的负模式
  `!./Settings/**` 排除设置面板；
- 设置面板由 `App.vue` 通过 `defineAsyncComponent(() => import('~/components/Settings/Settings.vue'))`
  按需加载，因此其子组件自动进入独立 chunk。
- 后续可继续把其他低频面板（关于页、更改壁纸等）纳入同样的异步加载策略。

### 注意

- ESM bundle 中的 `import()` 以 entry URL 为基准解析 chunk，因此
  `web_accessible_resources` 必须覆盖 `dist/contentScripts/esm/*`。
- 新增冷路径时保持「动态导入 + 不在全局 glob 中 eager 注册」即可自动分包。

