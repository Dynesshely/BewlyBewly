import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/**
 * 页面自检面板的模块内文案（第 24 轮）。
 *
 * 只服务 `contentScripts/diagnostics/**`，不进入 `src/_locales`。
 * 四种模块语言：cmn-CN / cmn-TW / jyut / en。
 */
export interface DiagnosticsMessages {
  title: string
  desc: string
  run: string
  rerun: string
  running: string
  copy: string
  copied: string
  copyFailed: string
  emptyHint: string
  summary: string
  envTitle: string
  pageType: string
  browser: string
  viewport: string
  dark: string
  reducedMotion: string
  bewlyMounted: string
  shortcutCount: string
  yes: string
  no: string
  statusOk: string
  statusDegraded: string
  statusUnavailable: string
  hostMounted: string
  hostNotMounted: string
  selectorsHit: string
  selectorsMiss: string
  reasonOk: string
  reasonNotApplicable: string
  reasonUserDisabled: string
  reasonLoginRequired: string
  reasonSelectorsMiss: string
  reasonNoSelectors: string
  reasonHostMissing: string
  reasonCoveringOverlay: string
  statusCovering: string
  coveringOverlayHint: string
  /** 结果摘要里「覆盖中」的展示文案（含占位符） */
  summaryCovering: string
  /** 报告元信息 */
  version: string
  generatedAt: string
  /** 可执行建议标签 */
  adviceLabel: string
  adviceCoveringOverlay: string
  adviceNotApplicable: string
  adviceEnableVideoPage: string
  adviceEnableVideoComments: string
  adviceEnableListScrollMemory: string
  adviceLogin: string
  adviceSelectorsMiss: string
  adviceNoSelectors: string
  adviceHostMissing: string
  /** 下载 .md */
  download: string
  downloadFailed: string
  /** 页面类型显示名（键与 probe.detectPageKind 的返回值一致） */
  pageKindLabels: Record<string, string>
}

const CMN_CN: DiagnosticsMessages = {
  title: '页面自检',
  desc: '检查当前页面各增强模块是否挂载、关键选择器是否命中，以及降级原因。全部在本地完成，不上报任何数据。',
  run: '运行页面自检',
  rerun: '重新自检',
  running: '正在自检…',
  copy: '复制为 Markdown',
  copied: '已复制',
  copyFailed: '复制失败，请手动选择文本',
  emptyHint: '点击「运行页面自检」查看结果。',
  summary: '正常 {ok} · 降级 {degraded} · 不可用 {unavailable}',
  envTitle: '环境',
  pageType: '页面类型',
  browser: '浏览器',
  viewport: '视口',
  dark: '暗色模式',
  reducedMotion: '减少动态效果',
  bewlyMounted: 'Bewly 主应用挂载',
  shortcutCount: '已登记快捷键数',
  yes: '是',
  no: '否',
  statusOk: '正常',
  statusDegraded: '降级',
  statusUnavailable: '不可用',
  hostMounted: '浮层已挂载',
  hostNotMounted: '浮层未挂载',
  selectorsHit: '命中选择器',
  selectorsMiss: '一个关键选择器都没命中',
  reasonOk: '一切正常',
  reasonNotApplicable: '当前页面不适用（URL / 页面结构未命中）',
  reasonUserDisabled: '用户已在设置中关闭该功能',
  reasonLoginRequired: '需要登录 B 站（未登录时只提示、不发请求）',
  reasonSelectorsMiss: '关键选择器一个都没命中（页面可能未渲染完成或站点已改版）',
  reasonNoSelectors: '没有声明关键选择器',
  reasonHostMissing: '关键选择器命中，但增强浮层没有挂载',
  reasonCoveringOverlay: '设置页覆盖中，无法探测（关闭设置页后重跑更准确）',
  statusCovering: '覆盖中',
  coveringOverlayHint: '当前设置页覆盖了页面内容，部分模块无法探测；关闭设置页后重新运行会更准确。',
  summaryCovering: '覆盖中 {covering}',
  version: '版本',
  generatedAt: '生成时间',
  adviceLabel: '建议',
  adviceCoveringOverlay: '关闭设置页后重新运行自检；若仍显示覆盖中，请刷新页面',
  adviceNotApplicable: '这是当前页面的正常状态；切换到对应页面后重新运行自检即可看到结果',
  adviceEnableVideoPage: '在「设置 → 页面增强 → 视频播放页」中开启影院模式 / 迷你播放器 / 快捷键任一开关',
  adviceEnableVideoComments: '在「设置 → 页面增强 → 视频播放页」中开启「视频页评论区增强」',
  adviceEnableListScrollMemory: '在「设置 → 页面增强 → 列表页」中开启「列表页返回恢复滚动位置」',
  adviceLogin: '登录 B 站账号后重新运行自检；未登录时只提示、不发请求',
  adviceSelectorsMiss: '可能是页面还没加载完或 B 站已改版：稍等片刻重跑；若持续出现，请复制报告提 issue',
  adviceNoSelectors: '这是开发期保护：请联系维护者补充该模块的 probeSelectors',
  adviceHostMissing: '尝试刷新页面；若仍缺失，检查是否有其它扩展 / 浏览器策略拦截了扩展浮层',
  download: '下载 .md',
  downloadFailed: '下载失败，请重试',
  pageKindLabels: {
    home: '首页',
    video: '视频播放页',
    bangumi: '番剧播放页',
    anime: '番剧页',
    list: '列表页',
    search: '搜索结果页',
    moments: '动态页',
    notification: '消息页',
    space: '用户空间',
    article: '文章 / 专栏 / OPUS',
    channel: '分区 / 排行榜',
    live: '直播页',
    unknown: '未知页面',
  },
}

const CMN_TW: DiagnosticsMessages = {
  ...CMN_CN,
  title: '頁面自檢',
  desc: '檢查目前頁面各增強模組是否掛載、關鍵選擇器是否命中，以及降級原因。全部在本機完成，不上報任何資料。',
  run: '執行頁面自檢',
  rerun: '重新自檢',
  running: '正在自檢…',
  copy: '複製為 Markdown',
  copied: '已複製',
  copyFailed: '複製失敗，請手動選取文字',
  emptyHint: '點擊「執行頁面自檢」查看結果。',
  summary: '正常 {ok} · 降級 {degraded} · 不可用 {unavailable}',
  envTitle: '環境',
  pageType: '頁面類型',
  browser: '瀏覽器',
  viewport: '視窗',
  dark: '暗色模式',
  reducedMotion: '減少動態效果',
  bewlyMounted: 'Bewly 主應用掛載',
  shortcutCount: '已登記快速鍵數',
  yes: '是',
  no: '否',
  statusOk: '正常',
  statusDegraded: '降級',
  statusUnavailable: '不可用',
  hostMounted: '浮層已掛載',
  hostNotMounted: '浮層未掛載',
  selectorsHit: '命中選擇器',
  selectorsMiss: '一個關鍵選擇器都沒命中',
  reasonOk: '一切正常',
  reasonNotApplicable: '目前頁面不適用（URL / 頁面結構未命中）',
  reasonUserDisabled: '使用者已在設定中關閉該功能',
  reasonLoginRequired: '需要登入 B 站（未登入時只提示、不發請求）',
  reasonSelectorsMiss: '關鍵選擇器一個都沒命中（頁面可能未渲染完成或站點已改版）',
  reasonNoSelectors: '沒有宣告關鍵選擇器',
  reasonHostMissing: '關鍵選擇器命中，但增強浮層沒有掛載',
  reasonCoveringOverlay: '設定頁覆蓋中，無法偵測（關閉設定頁後重跑更準確）',
  statusCovering: '覆蓋中',
  coveringOverlayHint: '目前設定頁覆蓋了頁面內容，部分模組無法偵測；關閉設定頁後重新執行會更準確。',
  summaryCovering: '覆蓋中 {covering}',
  version: '版本',
  generatedAt: '產生時間',
  adviceLabel: '建議',
  adviceCoveringOverlay: '關閉設定頁後重新執行自檢；若仍顯示覆蓋中，請重新整理頁面',
  adviceNotApplicable: '這是目前頁面的正常狀態；切換到對應頁面後重新執行自檢即可看到結果',
  adviceEnableVideoPage: '在「設定 → 頁面增強 → 影片播放頁」中開啟影院模式 / 迷你播放器 / 快速鍵任一開關',
  adviceEnableVideoComments: '在「設定 → 頁面增強 → 影片播放頁」中開啟「影片頁留言區增強」',
  adviceEnableListScrollMemory: '在「設定 → 頁面增強 → 清單頁」中開啟「清單頁返回恢復捲動位置」',
  adviceLogin: '登入 B 站帳號後重新執行自檢；未登入時只提示、不發請求',
  adviceSelectorsMiss: '可能是頁面還沒載入完或 B 站已改版：稍等片刻再跑；若持續出現，請複製報告提 issue',
  adviceNoSelectors: '這是開發期保護：請聯絡維護者補上該模組的 probeSelectors',
  adviceHostMissing: '嘗試重新整理頁面；若仍缺少，檢查是否有其它擴充功能 / 瀏覽器策略攔截了擴充功能浮層',
  download: '下載 .md',
  downloadFailed: '下載失敗，請重試',
  pageKindLabels: {
    home: '首頁',
    video: '影片播放頁',
    bangumi: '番劇播放頁',
    anime: '番劇頁',
    list: '清單頁',
    search: '搜尋結果頁',
    moments: '動態頁',
    notification: '訊息頁',
    space: '使用者空間',
    article: '文章 / 專欄 / OPUS',
    channel: '分區 / 排行榜',
    live: '直播頁',
    unknown: '未知頁面',
  },
}

const JYUT: DiagnosticsMessages = {
  ...CMN_TW,
  desc: '檢查而家呢頁各增強模組有冇掛載、關鍵選擇器有冇命中，同埋降級原因。全部喺本機做，唔會上報任何資料。',
  run: '行頁面自檢',
  rerun: '再自檢',
  running: '自檢緊…',
  copy: '複製做 Markdown',
  copied: '複製咗',
  copyFailed: '複製唔到，請自己揀字',
  emptyHint: '撳「行頁面自檢」睇結果。',
  viewport: '視窗',
  dark: '深色模式',
  reducedMotion: '減少動態效果',
  bewlyMounted: 'Bewly 主應用掛載',
  yes: '係',
  no: '唔係',
  statusDegraded: '降級',
  hostMounted: '浮層掛咗',
  hostNotMounted: '浮層未掛',
  selectorsHit: '命中選擇器',
  selectorsMiss: '一個關鍵選擇器都冇命中',
  reasonOk: '一切正常',
  reasonNotApplicable: '呢頁唔適用（URL / 頁面結構冇命中）',
  reasonUserDisabled: '你已經喺設定度閂咗呢個功能',
  reasonLoginRequired: '要登入 B 站（未登入淨係提示、唔發請求）',
  reasonSelectorsMiss: '關鍵選擇器一個都冇命中（頁面可能未渲染完或者站點改咗版）',
  reasonNoSelectors: '冇宣告關鍵選擇器',
  reasonHostMissing: '關鍵選擇器命中，但增強浮層未掛',
  reasonCoveringOverlay: '設定頁蓋住咗，探測唔到（閂咗設定頁再行會準啲）',
  statusCovering: '蓋住中',
  coveringOverlayHint: '而家設定頁蓋住咗頁面內容，有啲模組探測唔到；閂咗設定頁再行一次會準啲。',
  summaryCovering: '蓋住中 {covering}',
  version: '版本',
  generatedAt: '產生時間',
  adviceLabel: '建議',
  adviceCoveringOverlay: '閂咗設定頁再行自檢；如果仲係顯示蓋住中，就重新載入頁面',
  adviceNotApplicable: '呢個係目前頁面嘅正常狀態；轉去對應頁面再行自檢就見到結果',
  adviceEnableVideoPage: '喺「設定 → 頁面增強 → 影片播放頁」開返影院模式 / 迷你播放器 / 快速鍵其中一個',
  adviceEnableVideoComments: '喺「設定 → 頁面增強 → 影片播放頁」開返「影片頁留言區增強」',
  adviceEnableListScrollMemory: '喺「設定 → 頁面增強 → 清單頁」開返「清單頁返回恢復捲動位置」',
  adviceLogin: '登入 B 站帳號再行自檢；未登入淨係提示、唔發請求',
  adviceSelectorsMiss: '可能頁面未載入完或者 B 站改咗版：等一陣再行；如果仲係咁，複製報告去開 issue',
  adviceNoSelectors: '呢個係開發期保護：請聯絡維護者補返該模組嘅 probeSelectors',
  adviceHostMissing: '試下重新載入頁面；如果仲係冇，睇下有冇其他擴充 / 瀏覽器策略擋咗擴充浮層',
  download: '下載 .md',
  downloadFailed: '下載唔到，再試一次',
  pageKindLabels: {
    home: '主頁',
    video: '影片播放頁',
    bangumi: '番劇播放頁',
    anime: '番劇頁',
    list: '清單頁',
    search: '搜尋結果頁',
    moments: '動態頁',
    notification: '訊息頁',
    space: '用戶空間',
    article: '文章 / 專欄 / OPUS',
    channel: '分區 / 排行榜',
    live: '直播頁',
    unknown: '未知頁面',
  },
}

const EN: DiagnosticsMessages = {
  ...CMN_CN,
  title: 'Diagnostics',
  desc: 'Check whether each page enhancement is mounted, whether key selectors match, and why something is degraded. Everything runs locally — no data is reported.',
  run: 'Run page self-check',
  rerun: 'Run again',
  running: 'Checking…',
  copy: 'Copy as Markdown',
  copied: 'Copied',
  copyFailed: 'Copy failed — please select the text manually',
  emptyHint: 'Click “Run page self-check” to see results.',
  summary: 'OK {ok} · Degraded {degraded} · Unavailable {unavailable}',
  envTitle: 'Environment',
  pageType: 'Page type',
  browser: 'Browser',
  viewport: 'Viewport',
  dark: 'Dark mode',
  reducedMotion: 'Reduced motion',
  bewlyMounted: 'Bewly app mounted',
  shortcutCount: 'Registered shortcuts',
  yes: 'Yes',
  no: 'No',
  statusOk: 'OK',
  statusDegraded: 'Degraded',
  statusUnavailable: 'Unavailable',
  hostMounted: 'Overlay mounted',
  hostNotMounted: 'Overlay not mounted',
  selectorsHit: 'Matched selectors',
  selectorsMiss: 'No key selector matched',
  reasonOk: 'Everything looks fine',
  reasonNotApplicable: 'Not applicable to this page (URL / structure did not match)',
  reasonUserDisabled: 'Turned off in settings',
  reasonLoginRequired: 'Sign-in required (only prompts, no request)',
  reasonSelectorsMiss: 'No key selector matched (page may still be rendering or the site changed)',
  reasonNoSelectors: 'No key selectors declared',
  reasonHostMissing: 'Key selectors matched, but the overlay is not mounted',
  reasonCoveringOverlay: 'Covered by the Settings overlay — close Settings and run again for an accurate result',
  statusCovering: 'Covered',
  coveringOverlayHint: 'The Settings overlay is covering the page, so some modules cannot be probed. Close Settings and run the self-check again for accurate results.',
  summaryCovering: 'Covered {covering}',
  version: 'Version',
  generatedAt: 'Generated at',
  adviceLabel: 'Advice',
  adviceCoveringOverlay: 'Close Settings and run the self-check again; refresh the page if it still reports “covered”.',
  adviceNotApplicable: 'This is expected on the current page. Switch to the matching page and run the self-check again.',
  adviceEnableVideoPage: 'Enable any of Cinema mode / Mini player / Enhanced shortcuts in Settings → Page enhancements → Video page.',
  adviceEnableVideoComments: 'Enable “Video page comments” in Settings → Page enhancements → Video page.',
  adviceEnableListScrollMemory: 'Enable “Restore scroll position when returning to list pages” in Settings → Page enhancements → List pages.',
  adviceLogin: 'Sign in to Bilibili and run the self-check again. Without signing in it only prompts, no requests are made.',
  adviceSelectorsMiss: 'The page may still be loading or Bilibili changed its markup. Try again in a moment; if it persists, copy the report and open an issue.',
  adviceNoSelectors: 'Developer safeguard: ask the maintainer to add probeSelectors for this module.',
  adviceHostMissing: 'Try refreshing the page; if it is still missing, check whether another extension or browser policy is blocking the overlay.',
  download: 'Download .md',
  downloadFailed: 'Download failed, please try again',
  pageKindLabels: {
    home: 'Home',
    video: 'Video page',
    bangumi: 'Bangumi playback',
    anime: 'Anime page',
    list: 'List page',
    search: 'Search results',
    moments: 'Moments',
    notification: 'Notifications',
    space: 'User space',
    article: 'Article / OPUS',
    channel: 'Channel / Ranking',
    live: 'Live page',
    unknown: 'Unknown page',
  },
}

export const MESSAGES: Record<ModuleLocale, DiagnosticsMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function getDiagnosticsMessages(language?: string): DiagnosticsMessages {
  return getModuleMessages<DiagnosticsMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

export function useDiagnosticsMessages() {
  return computed(() => getDiagnosticsMessages(settings.value.language))
}
