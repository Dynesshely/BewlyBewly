import type { wallpaperItem } from '~/constants/imgs'
import type { HomeSubPage } from '~/contentScripts/views/Home/types'
import type { AppPage } from '~/enums/appEnums'
import { useStorageLocal } from '~/composables/useStorageLocal'

export const storageDemo = useStorageLocal<string>('webext-demo', 'Storage Demo')
export const accessKey = useStorageLocal<string>('accessKey', '')

export interface Settings {
  touchScreenOptimization: boolean
  enableGridLayoutSwitcher: boolean
  enableHorizontalScrolling: boolean

  language: string
  customizeFont: 'default' | 'recommend' | 'custom'
  fontFamily: string
  overrideDanmakuFont: boolean
  removeTheIndentFromChinesePunctuation: boolean

  disableFrostedGlass: boolean
  reduceFrostedGlassBlur: boolean
  disableShadow: boolean

  enableVideoPreview: boolean

  // Link Opening Behavior
  videoCardLinkOpenMode: 'drawer' | 'newTab' | 'currentTab'
  topBarLinkOpenMode: 'currentTab' | 'currentTabIfNotHomepage' | 'newTab'
  searchBarLinkOpenMode: 'currentTab' | 'currentTabIfNotHomepage' | 'newTab'
  closeDrawerWithoutPressingEscAgain: boolean

  blockAds: boolean
  blockTopSearchPageAds: boolean

  enableVideoCtrlBarOnVideoCard: boolean
  hoverVideoCardDelayed: boolean

  // Desktop & Dock
  useOldTopBar: boolean
  autoHideTopBar: boolean
  showTopBarThemeColorGradient: boolean
  showBewlyOrBiliTopBarSwitcher: boolean
  showBewlyOrBiliPageSwitcher: boolean
  topBarIconBadges: 'number' | 'dot' | 'none'
  openNotificationsPageAsDrawer: boolean

  alwaysUseDock: boolean
  autoHideDock: boolean
  halfHideDock: boolean
  dockPosition: 'left' | 'right' | 'bottom'
  /** @deprecated use dockItemsConfig instead */
  dockItemVisibilityList: { page: AppPage, visible: boolean }[]
  dockItemsConfig: { page: AppPage, visible: boolean, openInNewTab: boolean, useOriginalBiliPage: boolean }[]
  disableDockGlowingEffect: boolean
  disableLightDarkModeSwitcherOnDock: boolean
  backToTopAndRefreshButtonsAreSeparated: boolean

  sidebarPosition: 'left' | 'right'
  autoHideSidebar: boolean

  theme: 'light' | 'dark' | 'auto'
  themeColor: string
  useLinearGradientThemeColorBackground: boolean
  wallpaperMode: 'buildIn' | 'byUrl'
  wallpaper: string
  /** 自动轮换内置壁纸（每天一张） */
  wallpaperAutoSwitch: boolean

  // AI 信息初筛
  /** 是否启用 AI 卡片初筛 */
  aiFilterEnabled: boolean
  /** OpenAI 兼容接口的 base URL（如 https://api.openai.com/v1） */
  aiBaseURL: string
  /** API Key，仅保存在扩展本地存储 */
  aiApiKey: string
  /** 模型名（如 gpt-4o-mini） */
  aiModel: string
  /** 自定义筛选偏好提示词 */
  aiUserPrompt: string
  /** AI 初筛后只保留「推荐」分类的卡片 */
  aiFilterOnlyRecommended: boolean
  enableWallpaperMasking: boolean
  wallpaperMaskOpacity: number
  wallpaperBlurIntensity: number
  locallyUploadedWallpaper: wallpaperItem | null

  customizeCSS: boolean
  customizeCSSContent: string

  searchPageDarkenOnSearchFocus: boolean
  searchPageBlurredOnSearchFocus: boolean
  searchPageLogoColor: 'white' | 'themeColor'
  searchPageLogoGlow: boolean
  searchPageShowLogo: boolean
  searchPageSearchBarFocusCharacter: string
  individuallySetSearchPageWallpaper: boolean
  searchPageWallpaperMode: 'buildIn' | 'byUrl'
  searchPageWallpaper: string
  searchPageEnableWallpaperMasking: boolean
  searchPageWallpaperMaskOpacity: number
  searchPageWallpaperBlurIntensity: number

  recommendationMode: 'web' | 'app'
  /** 滚轮锁定页面并逐张切换卡片；关闭后滚轮正常滚动页面、高亮跟随视口 */
  keyboardNavLockScroll: boolean
  /** 键盘卡片导航总开关；关闭后恢复原版鼠标点选 + 正常滚动 */
  keyboardNavEnabled: boolean
  /** 接管页拦截原版 B 站脚本（提升性能） */
  nativeGuardEnabled: boolean

  // filter setting
  disableFilterForFollowedUser: boolean
  filterOutVerticalVideos: boolean
  enableFilterByViewCount: boolean
  filterByViewCount: number
  enableFilterByDuration: boolean
  filterByDuration: number
  enableFilterByTitle: boolean
  filterByTitle: { keyword: string, remark: string }[]
  enableFilterByUser: boolean
  filterByUser: { keyword: string, remark: string }[]

  followingTabShowLivestreamingVideos: boolean

  homePageTabVisibilityList: { page: HomeSubPage, visible: boolean }[]
  alwaysShowTabsOnHomePage: boolean
  useSearchPageModeOnHomePage: boolean
  searchPageModeWallpaperFixed: boolean

  adaptToOtherPageStyles: boolean
  showTopBar: boolean
  useOriginalBilibiliTopBar: boolean
  useOriginalBilibiliHomepage: boolean
}

export const originalSettings: Settings = {
  touchScreenOptimization: false,
  enableGridLayoutSwitcher: true,
  enableHorizontalScrolling: false,

  language: '',
  customizeFont: 'recommend',
  fontFamily: '',
  overrideDanmakuFont: true,
  removeTheIndentFromChinesePunctuation: false,

  disableFrostedGlass: true,
  reduceFrostedGlassBlur: false,
  disableShadow: false,

  // Link Opening Behavior
  videoCardLinkOpenMode: 'newTab',
  topBarLinkOpenMode: 'currentTabIfNotHomepage',
  searchBarLinkOpenMode: 'currentTabIfNotHomepage',
  closeDrawerWithoutPressingEscAgain: false,

  blockAds: false,
  blockTopSearchPageAds: false,

  enableVideoPreview: true,
  enableVideoCtrlBarOnVideoCard: false,
  hoverVideoCardDelayed: false,

  // Desktop & Dock
  useOldTopBar: false,
  autoHideTopBar: false,
  showTopBarThemeColorGradient: true,
  showBewlyOrBiliTopBarSwitcher: true,
  showBewlyOrBiliPageSwitcher: true,
  topBarIconBadges: 'number',
  openNotificationsPageAsDrawer: true,

  alwaysUseDock: false,
  autoHideDock: false,
  halfHideDock: false,
  dockPosition: 'right',
  /** @deprecated use dockItemsConfig instead */
  dockItemVisibilityList: [],
  dockItemsConfig: [],
  disableDockGlowingEffect: false,
  disableLightDarkModeSwitcherOnDock: false,
  backToTopAndRefreshButtonsAreSeparated: true,

  sidebarPosition: 'right',
  autoHideSidebar: false,

  theme: 'auto',
  themeColor: '#00a1d6',
  useLinearGradientThemeColorBackground: false,
  wallpaperMode: 'buildIn',
  wallpaper: '',
  wallpaperAutoSwitch: false,

  aiFilterEnabled: false,
  aiBaseURL: '',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiUserPrompt: '',
  aiFilterOnlyRecommended: false,
  enableWallpaperMasking: false,
  wallpaperMaskOpacity: 80,
  wallpaperBlurIntensity: 0,
  locallyUploadedWallpaper: null,

  customizeCSS: false,
  customizeCSSContent: '',

  searchPageDarkenOnSearchFocus: true,
  searchPageBlurredOnSearchFocus: false,
  searchPageLogoColor: 'themeColor',
  searchPageLogoGlow: true,
  searchPageShowLogo: true,
  searchPageSearchBarFocusCharacter: '',
  individuallySetSearchPageWallpaper: false,
  searchPageWallpaperMode: 'buildIn',
  searchPageWallpaper: '',
  searchPageEnableWallpaperMasking: false,
  searchPageWallpaperMaskOpacity: 0,
  searchPageWallpaperBlurIntensity: 0,

  recommendationMode: 'web',
  keyboardNavLockScroll: true,
  keyboardNavEnabled: true,
  nativeGuardEnabled: true,

  // filter setting
  disableFilterForFollowedUser: false,
  filterOutVerticalVideos: false,
  enableFilterByViewCount: false,
  filterByViewCount: 10000,
  enableFilterByDuration: false,
  filterByDuration: 3600,
  enableFilterByTitle: false,
  filterByTitle: [],
  enableFilterByUser: false,
  filterByUser: [],

  followingTabShowLivestreamingVideos: false,

  homePageTabVisibilityList: [],
  alwaysShowTabsOnHomePage: false,
  useSearchPageModeOnHomePage: false,
  searchPageModeWallpaperFixed: false,

  adaptToOtherPageStyles: true,
  showTopBar: true,
  useOriginalBilibiliTopBar: false,
  useOriginalBilibiliHomepage: false,
}

export const settings = useStorageLocal<Settings>('settings', ref<Settings>(originalSettings), { mergeDefaults: true })

export type GridLayoutType = 'adaptive' | 'twoColumns' | 'oneColumn'

export interface GridLayout {
  /** 全局默认布局（旧字段，作为未单独设置 Tab 的兜底） */
  home: GridLayoutType
  /** 各首页 Tab 单独记忆的布局 */
  byTab?: Record<string, GridLayoutType>
}

export const gridLayout = useStorageLocal<GridLayout>('gridLayout', ref<GridLayout>({
  home: 'adaptive',
  byTab: {},
}), { mergeDefaults: true })

export const sidePanel = useStorageLocal<{
  home: boolean
}>('sidePanel', ref<{
  home: boolean
}>({
  home: true,
}), { mergeDefaults: true })
