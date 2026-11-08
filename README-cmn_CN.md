# BewlyBewly（Dynesshely Fork）

[English](README.md) | 官话 - 简体中文 | [官話 - 繁體中文](README-cmn_TW.md) | [廣東話](README-jyut.md)

<p align="center" style="margin-bottom: 0px !important;">
<img width="300" alt="BewlyBewly icon" src="https://cdn.jsdelivr.net/gh/BewlyBewly/Imgs/logos/bewlybewly-vtuber-logo.png"><br/>
</p>

<p align="center">对 Bilibili 主页做一些小改动。</p>

> [!IMPORTANT]
> 本仓库是已归档上游项目 [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly) 的社区 Fork。
> 上游已于 `v0.41.1`（2025-02-26）停止维护，本 Fork 继续维护，并加入新特性、性能优化与稳定性修复。
>
> 上游侧重页面外观调整；本 Fork 额外提供键盘驱动的高效浏览交互，并针对 B 站接口/DOM 变更做了加固。

## ✨ Fork 特性

- **键盘卡片导航**
  - 滚轮逐张切换卡片（默认锁定页面滚动），方向键 / Home / End 移动高亮
  - `Enter` 在新标签页打开高亮视频，`Space` 在当前标签页打开
  - `1`–`6` 切换首页标签页，`/` 聚焦搜索框，`?` 显示快捷键帮助面板，`d` 打开卡片右键菜单
  - 页面自动跟随高亮卡片；从播放页返回后恢复滚动位置与高亮卡片
- **滚轮模式可配置**：锁定页面并逐张切换，或正常滚动页面、高亮跟随视口
- **支持原生页面**：搜索页等 B 站原生卡片同样可用键盘导航
- **内容特性**：推荐原因展示、各首页 Tab 独立记忆网格布局、内置壁纸按天轮换
- **性能**：页面样式按页注入、字体子集化、content script 拆分为 ESM 分包 + 轻量 loader
- **稳定性**：修复后台消息注册、ForYou 无限重载、原生滚动容器、定时器/监听清理

## ⬇️ 安装

> [!NOTE]
> 本 Fork **不再通过浏览器扩展商店分发**。请从 [Releases](https://github.com/Dynesshely/BewlyBewly/releases)
> 下载 `extension.zip`，或在本地构建。

### 本地构建

```bash
# 需要 Node.js ^22.12 或 >=24，pnpm 9
pnpm install
pnpm build
pnpm run pack:zip   # 生成 extension.zip
```

### 加载未打包扩展（Edge / Chrome）

> 如果已安装商店版 BewlyBewly，请先禁用或移除，避免重复注入。

1. 解压 `extension.zip`
2. 打开 `edge://extensions`（Edge）或 `chrome://extensions`（Chrome），开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择解压后的文件夹

## 🤝 构建与测试

```bash
pnpm lint            # ESLint
pnpm run typecheck   # vue-tsc
pnpm exec vitest run # 单元测试
pnpm exec playwright test        # 离线 e2e（扩展挂载 / 键盘导航 / 性能基线）
E2E_ONLINE=1 pnpm exec playwright test tests/e2e/background.spec.ts  # 在线接口冒烟（可选）
```

## 📚 文档

- [架构说明](docs/architecture.md) — 构建产物、样式注入、content script 拆分、后台消息协议
- [键盘导航](docs/keyboard-navigation.md) — 快捷键、滚轮模式、状态恢复与已知限制
- [与上游差异](docs/upstream-divergence.md) — 相对归档上游的改动清单
- [依赖策略](docs/dependency-policy.md) — 锁定版本与升级检查清单
- [性能记录](docs/performance.md) — 首屏基线、优化项与评估结论
- [AI 初筛](docs/ai-filter.md) — 可选的卡片初筛（OpenAI 兼容接口、隐私与降级说明）
- [隐私说明](PRIVACY.md) — 扩展读取、存储与发送的数据范围
- [更新日志](CHANGELOG.md) — 本 fork 的性能、功能与修复记录

## 🤝 贡献

见 [CONTRIBUTING.md](docs/CONTRIBUTING.md)

## ❤️ 致谢

- [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly) — 本项目基于的原始项目
- [vitesse-webext](https://github.com/antfu/vitesse-webext) — 开发模板
- [UserScripts/bilibiliHome](https://github.com/indefined/UserScripts/tree/master/bilibiliHome)、
  [bilibili-app-recommend](https://github.com/magicdawn/bilibili-app-recommend) — access key 获取方式参考
- [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved) — 部分功能实现参考
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)

## 📄 许可证

见 [LICENSE](LICENSE)。