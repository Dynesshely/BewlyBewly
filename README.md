# BewlyBewly (Dynesshely Fork)

English | [官话 - 简体中文](README-cmn_CN.md) | [官話 - 繁體中文](README-cmn_TW.md) | [廣東話](README-jyut.md)

<p align="center" style="margin-bottom: 0px !important;">
<img width="300" alt="BewlyBewly icon" src="https://cdn.jsdelivr.net/gh/BewlyBewly/Imgs/logos/bewlybewly-vtuber-logo.png"><br/>
</p>

<p align="center">Just make a few small changes to your Bilibili homepage.</p>

> [!IMPORTANT]
> This is a community fork of the archived upstream project
> [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly). Upstream stopped maintenance at `v0.41.1`
> (2025-02-26); this fork continues maintenance with new features, performance work and stability fixes.
>
> The upstream project focuses on page adjustments; this fork additionally adds keyboard-driven
> navigation and hardens the extension against Bilibili API/DOM changes.

## ✨ Fork highlights

- **Keyboard-first card navigation**
  - Wheel switches cards one by one (page scroll locked by default), arrow keys / Home / End move the highlight
  - `Enter` opens the highlighted video in a new tab, `Space` opens it in the current tab
  - `1`–`6` switch home tabs, `/` focuses the search bar, `?` shows a shortcut help panel, `d` opens the card context menu
  - The page follows the highlighted card; scroll position and highlighted card are restored after returning from a video page
- **Configurable wheel mode** — lock page scroll and switch cards, or scroll the page normally and let the highlight follow the viewport
- **Native page support** — keyboard navigation also works on Bilibili's native cards (e.g. search results)
- **Content features** — recommend reason display, per-tab grid layout memory, daily built-in wallpaper rotation
- **Performance** — page-scoped style injection, font subsetting, ESM code-splitting content script with a lightweight loader
- **Stability** — fixed background message registration, ForYou infinite reload, native scroll container, timer/listener cleanup

## ⬇️ Installation

> [!NOTE]
> This fork is **not** distributed through browser extension stores. Build it locally or download
> `extension.zip` from [Releases](https://github.com/Dynesshely/BewlyBewly/releases).

### Build from source

```bash
# Node.js ^22.12 or >=24, pnpm 9
pnpm install
pnpm build
pnpm run pack:zip   # produces extension.zip
```

### Load unpacked (Edge / Chrome)

> If the store version of BewlyBewly is already installed, disable or remove it first to avoid duplicate injection.

1. Unzip `extension.zip`
2. Open `edge://extensions` (Edge) or `chrome://extensions` (Chrome), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## 🤝 Build & Test

```bash
pnpm lint            # ESLint
pnpm run typecheck   # vue-tsc
pnpm exec vitest run # unit tests
pnpm exec playwright test        # offline e2e (extension mount / keyboard / perf, local only)
E2E_ONLINE=1 pnpm exec playwright test tests/e2e/background.spec.ts  # online API smoke (optional)
```

## 📚 Documentation

- [Architecture](docs/architecture.md) — build outputs, style injection, content script splitting, background message protocol
- [Keyboard navigation](docs/keyboard-navigation.md) — shortcuts, configurable wheel mode, state restore, limitations
- [Upstream divergence](docs/upstream-divergence.md) — differences from the archived upstream
- [Dependency policy](docs/dependency-policy.md) — pinned versions and upgrade checklist
- [Performance](docs/performance.md) — first-paint baseline, optimizations and evaluation notes
- [AI filtering](docs/ai-filter.md) — optional AI screening of cards (OpenAI-compatible API, privacy and fallback)
- [Privacy](PRIVACY.md) — what data the extension reads, stores and sends
- [Changelog](CHANGELOG.md) — performance, features and fixes in this fork

## 🤝 Contribution

See [CONTRIBUTING.md](docs/CONTRIBUTING.md)

## ❤️ Credits

- [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly) — the original project this fork is based on
- [vitesse-webext](https://github.com/antfu/vitesse-webext) — the template used for this project
- [UserScripts/bilibiliHome](https://github.com/indefined/UserScripts/tree/master/bilibiliHome),
  [bilibili-app-recommend](https://github.com/magicdawn/bilibili-app-recommend) — reference sources for the access key
- [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved) — partial implementation of functionalities
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)

## 📄 License

See [LICENSE](LICENSE).