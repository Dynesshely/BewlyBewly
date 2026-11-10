# 模块内 i18n 多语言补齐（第 12 轮 A）

第 1–11 轮各模块自己维护 `i18n.ts`（不进入 `src/_locales`），多数只有 `cmn-CN` + `en`，
`cmn-TW` / `jyut` 直接回落简中。本轮把 **14 个模块 i18n** 补齐为四种语言，并抽出统一的语言解析。

## 1. 语言解析规则

统一走 `src/utils/moduleI18n.ts`（新建）：

| `settings.language` | 模块语言 `ModuleLocale` | 内容 |
| --- | --- | --- |
| `cmn-CN` | `cmn-CN` | 简体中文 |
| `cmn-TW` | `cmn-TW` | 繁体中文 |
| `jyut` | `jyut` | 繁体中文 + 少量粤语口语词 |
| `en` | `en` | 英文 |
| 空值 / `undefined` | `cmn-CN` | 视为「语言尚未确定」；与各模块原先的缺省行为一致，避免设置加载完成前闪英文 |
| 其它未识别代码 | `en` | 按简报「其它 → 英文」 |

API：

- `resolveModuleLocale(language?)`：上面的映射；
- `getModuleMessages(messages, locale, fallback?)`：整份词典级回退 **精确语言 → cmn-CN → en → fallback**，
  保证任何语言缺整份词典时不会出现空串；
- `MODULE_LOCALES` / `DEFAULT_MODULE_LOCALE` / `hasAllModuleLocales`。

各模块保留自己的 `MESSAGES` 词典与 `useXxxI18n()` / `t()`，只把语言解析换成 helper；
键集合一致由 **TypeScript 类型**兜底（`interface`/`Record<ModuleMessageKey, string>`），
因此本轮的「自检脚本」是第二道保险而不是唯一保障。

## 2. 模块清单（14 个，共 496 个键 × 4 语言）

| 模块 i18n 文件 | 键数 | 备注 |
| --- | ---: | --- |
| `src/components/Settings/Pages/i18n.ts` | 66 | 「页面增强」设置页 |
| `src/components/VideoCardQuickActions/i18n.ts` | 30 | 卡片悬停操作条 |
| `src/contentScripts/articlePage/i18n.ts` | 25 | 文章页阅读模式 |
| `src/contentScripts/channelPage/i18n.ts` | 34 | 分区 / 热门 / 排行榜 |
| `src/contentScripts/livePage/i18n.ts` | 23 | 直播页增强 |
| `src/contentScripts/notificationPage/i18n.ts` | 30 | 消息页增强 |
| `src/contentScripts/searchPage/i18n.ts` | 25 | 原生搜索结果增强 |
| `src/contentScripts/spacePage/i18n.ts` | 34 | 用户空间增强 |
| `src/contentScripts/videoPage/i18n.ts` | 33 | 播放页增强（含播放列表）|
| `src/contentScripts/views/Anime/i18n.ts` | 36 | 番剧时间表 |
| `src/contentScripts/views/Home/i18n.ts` | 7 | 首页密度 / 回到顶部 |
| `src/contentScripts/views/listShared/i18n.ts` | 51 | 列表页共用 |
| `src/contentScripts/views/Moments/i18n.ts` | 71 | 动态页 |
| `src/contentScripts/views/Search/i18n.ts` | 31 | 搜索起始页（含热搜回落词表）|

`jyut` 词典的写法：**以 `cmn-TW` 为基底展开，只覆盖少数口语词**，例如：

```ts
const JYUT: XxxMessages = {
  ...CMN_TW,
  refresh: '重新整理',
  loading: '載入緊…',
  close: '收埋',
}
```

这样既保证键集合与 `cmn-TW` 完全一致（类型 + 展开），也避免整份复制造成后续维护漂移。

## 3. 术语表（模块内统一口径）

| 简体 | 繁体（cmn-TW） | 粤语（jyut） | 说明 |
| --- | --- | --- | --- |
| 视频 | 影片 | 影片 | 与全局 `_locales` 的「視頻」略有差异，模块内统一用台港更常见的「影片」|
| 弹幕 | 彈幕 | 彈幕 | |
| 稍后再看 | 稍後再看 | 稍後再看 | |
| 收藏 / 收藏夹 | 收藏 / 收藏夾 | 收藏 / 收藏夾 | |
| 动态 | 動態 | 動態 | |
| 直播间 | 直播間 | 直播間 | |
| 快捷键 | 快速鍵 | 快速鍵 | |
| 搜索 | 搜尋 | 搜尋 / 搵嘢 | 粤语界面偶用「搵嘢」 |
| 设置 | 設定 | 設定 | |
| 加载 | 載入 | 載入 | |
| 刷新 | 重新整理 | 重新整理 | |
| 复制 | 複製 | 複製 | |
| 筛选 | 篩選 | 篩選 | |
| 视图 / 列表 | 檢視 / 清單 | 檢視 / 清單 | |
| 点赞 | 按讚 | 讚好 | |
| 评论 | 留言 | 留言 | 与「轉發」并列出现在互动条 |
| 转发 | 轉發 | 轉發 | |
| 专栏 | 專欄 | 專欄 | |
| 番剧 | 番劇 | 番劇 | |
| 全屏 / 画中画 | 全螢幕 / 子母畫面 | 全螢幕 / 子母畫面 | |
| 用户 | 使用者 | 使用者 | |
| 加载中 / 处理中 | 載入中… / 處理中… | 載入緊… / 處理緊… | |

粤语虚词只在自然的位置使用：`嘅`（的）、`咗`（了）、`喺`（在）、`唔`（不）、`冇`（没有）、
`睇`（看）、`搵`（找）、`撳`（按）、`收埋`（收起）、`閂`（关）、`啱啱`（刚刚）、
`而家`（现在）、`呢` / `嗰`（这 / 那）、`轉頭`（回头）。不使用生造词或网络烂梗。

## 4. 自检脚本（已运行，脚本已删除）

用途：解析每个 i18n 文件的四个词典常量，比较顶层键集合（`jyut` 用展开时校验覆盖键 ⊆ `cmn-TW`）。
脚本放在工作区 `.meta/dynesshely/bewlybewly/verify-module-i18n.cjs` 临时运行，验证通过后已删除，
内容如下（Node 直接运行，不依赖仓库构建产物）：

```js
// 用法：node verify-module-i18n.cjs（脚本内 repo 指向仓库根目录）
const fs = require('node:fs')
const path = require('node:path')

const repo = 'D:/Projects/Dynesshely/BewlyBewly'
const files = []

function extractObjectKeys(source, fromIndex) {
  // 从 '{' 之后开始，按大括号深度只收集顶层 'key:'，并记录 '...Spread'
  let i = fromIndex
  let depth = 1
  let lineStart = fromIndex
  const keys = new Set()
  const spreads = []
  while (i < source.length && depth > 0) {
    const ch = source[i]
    if (ch === '{') {
      depth++
    }
    else if (ch === '}') {
      depth--
    }
    else if (ch === '\\n' && depth === 1) {
      const line = source.slice(lineStart, i).trim()
      if (line.startsWith('...')) {
        spreads.push(/^\\.\\.\\.([A-Za-z_$][\\w$]*)/.exec(line)[1])
      }
      else {
        const km = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\\w$]*))\\s*:/.exec(line)
        if (km)
          keys.add(km[1] || km[2] || km[3])
      }
      lineStart = i
    }
    i++
  }
  return { keys, spreads }
}

// 对每个文件：
//  - const CMN_CN / CMN_TW / JYUT / EN → 直接抽取；
//  - listShared 把语言内联在 MESSAGES 里 → 解析 MESSAGES 的一级条目后逐个抽取；
//  - 比较 CN↔TW / CN↔EN 完全一致；JYUT 有展开时只校验覆盖键属于 TW；
//  - 同时检查 MESSAGES 里四个语言键齐全。
```

运行结果（本轮）：

```text
OK   src/components/Settings/Pages/i18n.ts  keys=66
OK   src/components/VideoCardQuickActions/i18n.ts  keys=30
OK   src/contentScripts/articlePage/i18n.ts  keys=25
OK   src/contentScripts/channelPage/i18n.ts  keys=34
OK   src/contentScripts/livePage/i18n.ts  keys=23
OK   src/contentScripts/notificationPage/i18n.ts  keys=30
OK   src/contentScripts/searchPage/i18n.ts  keys=25
OK   src/contentScripts/spacePage/i18n.ts  keys=34
OK   src/contentScripts/videoPage/i18n.ts  keys=33
OK   src/contentScripts/views/Anime/i18n.ts  keys=36
OK   src/contentScripts/views/Home/i18n.ts  keys=7
OK   src/contentScripts/views/listShared/i18n.ts  keys=51
OK   src/contentScripts/views/Moments/i18n.ts  keys=71
OK   src/contentScripts/views/Search/i18n.ts  keys=31
---
files=14 totalKeys(CN)=496 failures=0
```

## 5. 自测记录

- `pnpm exec eslint <14 个 i18n + moduleI18n.ts>`：0 error 0 warning；
- `pnpm run typecheck`（`vue-tsc`）：0 error；
- 键集合自检脚本：14/14 通过（496 键/语言）；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。

## 6. 已知限制 / 后续建议

1. **模块内「影片」vs 全局「視頻」**：模块内统一用「影片」，与全局 `_locales/cmn-TW` 的「視頻」不一致；
   若希望全站统一，可后续把两者之一改齐（本轮为避免改动 `_locales` 未处理）。
2. **动态页数字单位**：`views/Moments/utils/format.ts` 的紧凑单位仍是 `亿/万`（简中字形），
   `cmn-TW`/`jyut` 下显示 `1.2万` 而不是 `1.2萬`；该文件不在本轮写入范围，建议后续顺手替换。
3. **`views/Moments/composables/useVirtualListI18n.ts` 不在 14 个清单内**，仍是 cn/en 两种；
   属于第 8 轮新增的小字典，本轮未动，建议下一轮一并补齐。
4. 名称里的 `VideoPage` 英文文案与 `中文` 混排等原有问题保持原样（只做翻译，不改英文）。
5. `videoPage/i18n.ts` 同轮有「播放列表」工作流并发修改：本轮补齐时保留了其新增键
   （`playlistPanel` / `playlistPosition` / `playlistHint` / `autoplay*`），并在三种语言里同步翻译。
6. 语言解析行为有一处**有意变更**：未识别的语言代码从「回落简中」改为「回落英文」
   （按第 12 轮简报 A 节「其它 → 英文」）；空值仍回落简中。

## 7. Lead 需要接线

**无**。14 个模块的 `useXxxI18n()` 对外签名不变（`t` / `locale` / 辅助格式化函数），
调用方无需改动；新增的只有 `src/utils/moduleI18n.ts` 与本文档。