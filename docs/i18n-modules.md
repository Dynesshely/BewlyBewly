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

---

## 第 13 轮：i18n 补漏与术语统一

本轮沿用第 12 轮的语言规则与术语表，处理「模块内仍硬编码中文」的遗留，并扫描全仓给出清单。

### 1. 本轮修复（写入范围：Moments / listShared）

| 位置 | 原来 | 现在 |
| --- | --- | --- |
| `Moments/utils/format.ts` | 紧凑计数固定用 `亿/万`（繁体界面也显示简体字形） | 按语言选单位：`cmn-CN → 万/亿`、`cmn-TW`/`jyut → 萬/億`、`en → K/M/B`；`formatCount(value, locale)` 签名不变 |
| `Moments/composables/useVirtualListI18n.ts` | 独立小字典，只有 cn/en | **合并进 `Moments/i18n.ts`**：新增 `optimize` / `optimize_on` / `optimize_off` 三个键（四语言），删除该文件；`Moments.vue` 改用主字典 `t(...)` |
| `Moments/utils/normalize.ts` | `badge: pgc.badge?.text ?? '番剧'` 硬编码 | 改为 `?? ''`，由 `MomentMedia.vue` 在缺角标时按语言补 `t('type_pgc')`（繁中/粤语「番劇」、英文「Bangumi」） |

新增/沿用术语：`离屏优化 → 離屏最佳化`、`亿/万 → 億/萬`、`番剧角标 → 番劇`。

`Moments/i18n.ts` 四语言键数：`cmn-CN 74 / cmn-TW 74 / en 74`，`jyut` 以 `...CMN_TW` 展开并覆盖 39 个口语键。

### 2. listShared 的时间文案检查

- `listShared/timeline.ts`：时间分组键（`today`/`yesterday`/`thisWeek`/`earlier`）本身是 key，
  文案由 `listShared/i18n.ts` 的 `group.*` 提供（第 12 轮已补繁/粤），`formatTimeLabel()` 只输出
  `HH:mm` / `MM-DD HH:mm` 数字，无硬编码中文；
- `listShared/utils.ts`、`preferences.ts`、`useListVirtual.ts`、`useListShortcuts.ts` 与 `components/**`：
  扫描无硬编码中文 UI 文案，**本轮未改**；
- 唯一语言相关的硬编码是 `timeline.ts` 标题排序的 `localeCompare(..., 'zh-Hans-CN')`：
  它只影响中文标题的排序规则、不产出文案，且繁简拼音序一致，本轮保留。

### 3. 全仓硬编码中文清单（扫描 2026-11-11，123 行 / 29 个文件）

扫描口径：`src/**/*.{ts,vue}`（排除 `_locales`、模块 `i18n.ts`、测试文件、注释行、`console.*`），
只统计含中文且出现在代码里的行。按性质分四类：

#### A. 本轮已修（Moments）

见第 1 节：`format.ts` 4 行（单位符号，已按语言拆分）、`useVirtualListI18n.ts` 3 行（已合并）、
`normalize.ts` 1 行（角标已本地化）。

#### B. 页面文本匹配 / 数据枚举（**不能** i18n，保持中文）

这些中文用于**匹配 B 站原生页面的中文文本**或映射接口枚举值，翻译了反而失效：

| 文件 | 行数 | 用途 |
| --- | ---: | --- |
| `contentScripts/channelPage/dom.ts` | 10 | 排序 / 榜单 tab 的中文文案匹配 |
| `contentScripts/spacePage/dom.ts` | 10 | 空间页 tab 中英混排匹配 |
| `contentScripts/notificationPage/dom.ts` | 7 | 分类 / 未读 / 全部已读文本匹配 |
| `contentScripts/livePage/dom.ts` | 6 | `aria-label` 含「弹幕」「全屏」的选择器 |
| `contentScripts/articlePage/dom.ts` | 1 | 从 `document.title` 去掉「哔哩哔哩」后缀 |
| `contentScripts/videoPage/dom.ts` | 1 | 同上 |
| `composables/useFilter.ts` | 3 | 过滤「万/萬」后缀、「已关注/已關注」 |
| `composables/useKeyboardCardNavigation.ts` | 10 | 解析「亿/万」「分钟/小时/天」与「推荐」分类 |
| `models/moment/moment.ts` | 9 | 接口枚举（番剧 / 投稿了视频 / 大会员…） |
| `models/moment/topBarMoment.ts` | 2 | 接口枚举 |
| `models/video/appForYou.ts` | 9 | 接口枚举（不感兴趣 / 稍后再看…） |
| `models/video/rankingPgc.ts` | 4 | 接口枚举（会员专享 / 独家…） |
| `models/video/historySearch.ts` | 2 | 接口枚举（共2P…） |
| `models/video/watchLater.ts` | 1 | 接口占位文案 |
| `models/anime/watchList.ts` | 7 | 接口枚举（地区 / 版权标签） |
| `contentScripts/views/Home/components/Following.vue` | 1 | 判断角标是否「投稿视频」 |
| `contentScripts/views/Home/components/ForYou.vue` | 1 | 判断推荐原因是否「已关注」 |
| `contentScripts/views/Anime/Anime.vue` | 1 | `rating.replace('分', '')` 数据清洗 |
| `contentScripts/views/Home/components/Ranking.vue` | 1 | 同上 |
| `utils/dataFormatter.ts` | 8 | 数字单位（已有 cn/tw 两套：万/萬、亿/億） |
| `utils/ai.ts` | 1 | AI 返回分类的默认值「普通」 |
| `constants/imgs.ts` | 5 | 搜索框人物/活动名称（数据） |
| `components/Settings/About/About.vue` | 1 | 作者署名 `雪谋`（专有名词） |
| `background/messageListeners/api/ai.ts` | 10 | 发给模型的系统提示词（中文 prompt，不是 UI 文案） |

#### C. 真实 UI 文案，**需要后续 i18n**（不在本轮写入范围）

| 文件:行 | 现状文案 | 建议 key |
| --- | --- | --- |
| `contentScripts/views/App.vue:62` | `AI 初筛中… (n)` | `app_ai_filtering` |
| `contentScripts/views/App.vue:66` | `AI 初筛完成` | `app_ai_filtered` |
| `contentScripts/views/App.vue:67` | `（保留 n 个）` | `app_ai_filtered_kept` |
| `contentScripts/views/App.vue:69` | `AI 初筛失败` | `app_ai_filter_failed` |
| `contentScripts/videoPage/components/FloatingControls.vue:65` | `…（Esc 关闭）` | `close_hint`（拼到 `t.playlistPanel` 后） |
| `components/VideoCard/VideoCardContextMenu/VideoCardContextMenu.vue:26-27` | `不感兴趣` / `不想看此UP主` | `context_menu_not_interested` / `context_menu_hide_uploader` |
| `components/Settings/BewlyPages/Home/Home.vue:82` | toast `授权成功` | `toast_auth_success` |

> 这 8 行是目前全仓仅剩的「用户可见且未 i18n」的模块外文案，建议下一轮交由
> `settings-pages` / `video-page` 两个工作流按各自文件所有权补齐；补的时候沿用本文术语表，
> 并在对应模块内建 `i18n.ts`（cmn-CN / cmn-TW / jyut / en 四语言键集合一致）。

### 4. 第 13 轮自检

临时脚本（`.meta/dynesshely/bewlybewly/check-moments-i18n.cjs`，运行后已删除）解析 `Moments/i18n.ts`
的四个词典常量并比较键集合，输出：

```text
Moments keys CN=74 TW=74 jyut覆盖=39 EN=74
含 optimize 三键: true
OK 四语言键集合一致
```

另外：

- `pnpm exec eslint`（Moments 5 个改动文件）：0 error 0 warning；
- `pnpm run typecheck`：0 error；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。

### 5. 已知限制

- `formatCount` 的繁体输出只在 `cmn-TW` / `jyut` 生效；`listShared` 等其它模块若自行格式化数字，
  仍是简中单位（本轮未扩散修改）；
- 已删除的 `useVirtualListI18n.ts` 对外无导出（仅 `Moments.vue` 使用），删除不影响其它模块；
- B 节清单里 C 类（8 行模块外 UI 文案）超出本轮写入范围，未改，清单留给后续工作流；
- 全仓扫描是文本启发式：注释里出现的中文、拼接出来的中文可能漏检，
  下次补漏建议配合运行界面走查。

---

## 第 14 轮：C 类清单清零（_locales 四语言补齐）

第 13 轮列出的 8 行「模块外硬编码 UI 文案」本轮全部 i18n 化。按简报特批，`src/_locales/**` 四份语言文件同步新增 key，
key 命名沿用现有命名空间（`ai_filter_status.*` / `settings.*` / `video_card.operation.*`）。

### 1. 已清零的 C 类清单

| 原清单位置 | 原硬编码 | 新 key |
| --- | --- | --- |
| `contentScripts/views/App.vue:62` | `AI 初筛中… (n)` | `ai_filter_status.filtering`（`{total}`） |
| `contentScripts/views/App.vue:66` | `AI 初筛完成` | `ai_filter_status.done` |
| `contentScripts/views/App.vue:67` | `（保留 n 个）` | `ai_filter_status.done_kept`（`{visible}`） |
| `contentScripts/views/App.vue:69` | `AI 初筛失败` | `ai_filter_status.failed` |
| `contentScripts/videoPage/components/FloatingControls.vue:65` | `…（Esc 关闭）` | 复用模块内 i18n 的 `close`，标题改为 `${selectionLabel} · ${t.close}（Esc）` |
| `components/VideoCard/VideoCardContextMenu/VideoCardContextMenu.vue:26` | `不感兴趣` | `video_card.operation.not_interested`（复用已有 key） |
| `components/VideoCard/VideoCardContextMenu/VideoCardContextMenu.vue:27` | `不想看此UP主` | `video_card.operation.hide_uploader`（新增） |
| `components/Settings/BewlyPages/Home/Home.vue:82` | toast `授权成功` | `settings.authorize_success`（新增） |

### 2. 四语言新增 key 一览

| key | cmn-CN | cmn-TW | jyut | en |
| --- | --- | --- | --- | --- |
| `ai_filter_status.filtering` | AI 初筛中…（{total}） | AI 初篩中…（{total}） | AI 初篩緊…（{total}） | AI screening… ({total}) |
| `ai_filter_status.done` | AI 初筛完成 | AI 初篩完成 | AI 初篩完成 | AI screening done |
| `ai_filter_status.done_kept` | （保留 {visible} 个） | （保留 {visible} 個） | （留低 {visible} 個） | ({visible} kept) |
| `ai_filter_status.failed` | AI 初筛失败 | AI 初篩失敗 | AI 初篩失敗 | AI screening failed |
| `settings.authorize_success` | 授权成功 | 授權成功 | 授權成功 | Authorized successfully |
| `video_card.operation.not_interested` | 不感兴趣 | 不感興趣 | 唔鍾意 | Not Interested |
| `video_card.operation.hide_uploader` | 不想看此 UP 主 | 不想看此 UP 主 | 唔想睇呢個 UP 主 | Hide Videos from This Uploader |

术语沿用第 12 轮：`初筛 → 初篩`、`授权 → 授權`、`感兴趣 → 感興趣`；粤语用「唔鍾意 / 唔想睇 / 留低 / 初篩緊」。

### 3. 实现说明

- **App.vue**：只在 `<script setup>` 增加 `useI18n()`，把 4 句状态文案换成 `t(...)` 调用；
  事件监听、计时器、显示/隐藏逻辑与状态变量**完全未改**（按简报要求只动文案）。
- **VideoCardContextMenu.vue**：`videoOptions` 从 `reactive` 常量改为 `computed`，两个选项的 `name` 实时取 `t(...)`，
  语言切换后菜单立即更新；原有 `handleMoreCommand(option.id)` 逻辑不变。
- **Settings/BewlyPages/Home.vue**：脚本里加 `useI18n()`，`toast.success('授权成功')` → `toast.success(t('settings.authorize_success'))`。
- **FloatingControls.vue**：该组件用的是 videoPage **模块内** i18n（不是 `_locales`），因此不改 `_locales`，
  改用模块已有的 `t.close`（简中「关闭」/繁中「關閉」/粤语「關閉」/英文「Close」）拼成
  `${selectionLabel} · ${t.close}（Esc）`，既保持四语言、也不再出现写死的中文。
- 三处 `_locales` 新 key 已四份同步，占位符（`{total}` / `{visible}`）四种语言一致。

### 4. 第 14 轮自检

临时脚本（`.meta/dynesshely/bewlybewly/check-locales.cjs`，运行后已删除）用 `js-yaml` 解析四份语言文件，
校验新增 key 是否齐全、非空、占位符一致，并对比四份文件完整键集合：

```text
OK   ai_filter_status.filtering / done / done_kept / failed
OK   settings.authorize_success
OK   video_card.operation.not_interested / hide_uploader
OK   占位符一致 ai_filter_status.filtering (total)
OK   占位符一致 ai_filter_status.done_kept (visible)
键集合对比 cmn-CN ↔ cmn-TW：缺 0，多 0
键集合对比 cmn-CN ↔ jyut：缺 0，多 0
键集合对比 cmn-CN ↔ en：缺 0，多 0
```

另外：

- `pnpm exec eslint App.vue VideoCardContextMenu.vue Home.vue FloatingControls.vue`：0 error 0 warning；
- `pnpm run typecheck`：0 error；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。

### 5. 说明与遗留

- 第 13 轮 B 类清单（页面文本匹配 / 接口枚举 / AI 提示词等）按设计**保持中文**，不在此轮范围内；
- 至此「模块外硬编码 UI 文案」C 类清零；后续如再新增 UI 文案，请直接写进对应模块 `i18n.ts`
  或 `_locales` 四语言，避免回退；
- `docs/i18n-modules.md` 第 12 轮起维护的 14 个模块内 i18n 与 `src/_locales` 仍分属两套体系，
  模块内文案不放 `_locales`（避免大改动），`_locales` 只承载全局/共享文案。
