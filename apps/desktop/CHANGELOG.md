# Changelog

## [0.3.3](https://github.com/pleahmacaka/eris/compare/0.3.2...0.3.3) (2026-10-02)


### Features

* **calendar:** add tags, sub-events, series edits and a compact view ([d051360](https://github.com/pleahmacaka/eris/commit/d051360512c1fbcd64f1ae5e1cf1f3f7cca7b2b2))
* **dock:** add the gather animation, custom icon and islands ([fa90b1e](https://github.com/pleahmacaka/eris/commit/fa90b1e78a43538dff7caf102d3b2c96d0a78154))
* run files and terminal inside eris ([aecd00c](https://github.com/pleahmacaka/eris/commit/aecd00c44c5dd295315e85103d2d803f8c0a2975))
* **ui:** share the eris theme and card design across apps ([58f3abb](https://github.com/pleahmacaka/eris/commit/58f3abb0994b8034b96dc7836d7f2c32c9c62cdf))

## [0.3.2](https://github.com/pleahmacaka/eris/compare/0.3.1...0.3.2) (2026-10-01)


### Features

* add the eris logo and app icons ([83a8ce3](https://github.com/pleahmacaka/eris/commit/83a8ce31d89f3e45adae28e6020a497dff9e74a5))
* **dock:** make the auto-hide delay configurable ([3fcce41](https://github.com/pleahmacaka/eris/commit/3fcce4127b3ca72f5801216ac659752e71faffb2))
* **settings:** regroup settings into dock, tray, data and about ([921f8cd](https://github.com/pleahmacaka/eris/commit/921f8cdf3f8113b90b701119f900831fa87f2383))


### Bug Fixes

* **dock:** keep the dock up while hovering a window preview ([3e3fcbf](https://github.com/pleahmacaka/eris/commit/3e3fcbf37faee179e953fde6c89a98d6e58b358a))
* **dock:** smooth the hover magnification ([7346c43](https://github.com/pleahmacaka/eris/commit/7346c43db8d2828135a407fad3910bbace228ad5))
* **tray:** keep overflow open for tray menus, close on outside click ([5790a1d](https://github.com/pleahmacaka/eris/commit/5790a1dfdd5b0ceff42e4a2828710058d010d132))

## [0.3.1](https://github.com/pleahmacaka/eris/compare/0.3.0...0.3.1) (2026-09-29)


### Features

* **calendar:** cite note memos, drag-select days, read title times ([b6d16c7](https://github.com/pleahmacaka/eris/commit/b6d16c7824d33e269b1f02d03edbeca1d7cbace7))
* **dock:** anchor notices, follow taskbar pins and cap growth ([0466dc5](https://github.com/pleahmacaka/eris/commit/0466dc5f096de177b3ebeeee9125e2fc89df7e4a))
* **dock:** hide the sync status dot by default ([36145f1](https://github.com/pleahmacaka/eris/commit/36145f144c3b214fdf6648f5a34064d307bff040))
* **studio:** preview every window with mocked ipc ([a5d00eb](https://github.com/pleahmacaka/eris/commit/a5d00eba8bc7e978ba28167264dd77a616b47fa0))
* **sync:** share only calendar events with note ([aaee74a](https://github.com/pleahmacaka/eris/commit/aaee74a052d95ac97fde8738b586804f86ad60d5))
* **theme:** make the flat arix preset the default ([b6fe46a](https://github.com/pleahmacaka/eris/commit/b6fe46aee4d75aa5bdfe4f5e7332b59897874461))
* **updater:** announce new versions at startup ([5f35b7b](https://github.com/pleahmacaka/eris/commit/5f35b7b5917e3b2c7105820635ead86dd30ed43a))


### Bug Fixes

* **dock:** reserve the work area beside the tray host ([c61282d](https://github.com/pleahmacaka/eris/commit/c61282d288392ece135bef321755212a04eb6991))
* harden first run, window placement and settings defaults ([bfb9844](https://github.com/pleahmacaka/eris/commit/bfb9844afc6a39c31a65408e666ac348f6fe170c))

## [0.3.0](https://github.com/pleahmacaka/eris/compare/0.2.2...0.3.0) (2026-09-28)


### ⚠ BREAKING CHANGES

* replace server sync with peer-to-peer sync
* remove the claude chat

### Features

* add terminal picker, redesign calendar, drop uchiwa ([e51a8e8](https://github.com/pleahmacaka/eris/commit/e51a8e8a6d17ec4355c70e3d03bffaa9774f928d))
* remove the claude chat ([a4b8edf](https://github.com/pleahmacaka/eris/commit/a4b8edfd27d4a437b561c32e40c3088249928d6c))
* replace server sync with peer-to-peer sync ([a494848](https://github.com/pleahmacaka/eris/commit/a4948483af405a1200c7a18cbca17196687f9dc8))


### Bug Fixes

* correct launcher, files, and dock popover behavior ([f839347](https://github.com/pleahmacaka/eris/commit/f8393475d94a7215759e358215a5130615629f14))
* **dock:** broadcast menu dismissal across shell windows ([b48e126](https://github.com/pleahmacaka/eris/commit/b48e126ca85ba58e8a4c5daa3cf82b147a457031))
* **dock:** match pins to windows and forward tray menus ([f5e01c9](https://github.com/pleahmacaka/eris/commit/f5e01c9868da325cc4156d66bb1927cb25c1a3a8))
* harden shell integration and system services ([2de248e](https://github.com/pleahmacaka/eris/commit/2de248eaa96fbdfb2215ac26df5da154aea7baa0))

## [0.2.2](https://github.com/pleahmacaka/eris/compare/0.2.1...0.2.2) (2026-09-16)


### Features

* **dock:** compose the dock from widgets and fix focus handling ([6eb4d47](https://github.com/pleahmacaka/eris/commit/6eb4d47efe0cc6b6aa4c363a14c95f1b9d5aa56c))
* **files:** copy and paste entries through the windows clipboard ([d19058a](https://github.com/pleahmacaka/eris/commit/d19058a92de43dd3458d4801fbdeb74581508735))
* **panel:** add a todo pane and a date-only view when calendar is off ([9ed6de0](https://github.com/pleahmacaka/eris/commit/9ed6de06b5a7ab6be1700fe3207ea167c868871d))
* **settings:** reorganize into gated feature pages with row resets ([b4d8378](https://github.com/pleahmacaka/eris/commit/b4d83785c2ed844d74a46e0c63fab1b184d7ee27))

## [0.2.1](https://github.com/pleahmacaka/eris/compare/0.2.0...0.2.1) (2026-09-15)


### Features

* **dock:** add top bar, uchiwa style, and notice window ([9aba87c](https://github.com/pleahmacaka/eris/commit/9aba87c736b2b0d8a05ef246609102dac1d1386a))
* **panel:** rebuild the calendar around a month grid ([c062038](https://github.com/pleahmacaka/eris/commit/c062038d2a54a19844a9650d271c82ae7101f7a7))


### Bug Fixes

* harden http timeouts, menus, and parsing edges ([eebb29d](https://github.com/pleahmacaka/eris/commit/eebb29dc42c6d1c58ed15d848d78a87cbe655bbb))
* **usage:** run the statusline chain hidden and in bash ([6565232](https://github.com/pleahmacaka/eris/commit/65652327f424914a50914412ad31e45a8f62a666))
* **usage:** run the statusline chain hidden and in bash ([854727d](https://github.com/pleahmacaka/eris/commit/854727d5deacf466f210955790938b4b5da238a5))

## [0.2.0](https://github.com/pleahmacaka/eris/compare/0.1.3...0.2.0) (2026-09-09)


### ⚠ BREAKING CHANGES

* split into apps and packages workspaces

### Code Refactoring

* split into apps and packages workspaces ([461a096](https://github.com/pleahmacaka/eris/commit/461a0967651aeaad4c7158cdc795a241e95e5a35))

## [0.1.3](https://github.com/pleahmacaka/eris/compare/0.1.2...0.1.3) (2026-09-09)


### Features

* **chat:** one Claude mode with folder, local /clear /resume /usage ([39411c2](https://github.com/pleahmacaka/eris/commit/39411c2c16418a74cd618760e178f5065cdabc51))
* **chat:** permission modes, history back, interactive previews ([04ab0ff](https://github.com/pleahmacaka/eris/commit/04ab0ff6546424ca311be4017e1dfd7427f39fdd))
* edit mode, tray parity, chat bubbles, i18n, updater ([0d6e4cd](https://github.com/pleahmacaka/eris/commit/0d6e4cd49e89a5e3c1570f0b916e74f05fc86ded))
* feature toggles, snap distance, multi-monitor bubble ([f2bb649](https://github.com/pleahmacaka/eris/commit/f2bb649ce2bbe42323bf079640450b9fcad06974))
* **i18n:** translate settings and launcher surfaces ([cdc07cf](https://github.com/pleahmacaka/eris/commit/cdc07cf7ef5f21c5588c8b0254100775729eb9b2))
* **settings:** tag partial and experimental features ([68bbfe7](https://github.com/pleahmacaka/eris/commit/68bbfe7b56233ca06610ec1c255a860202db3c03))

## [0.1.2](https://github.com/pleahmacaka/eris/compare/0.1.1...0.1.2) (2026-09-08)


### Features

* **chat:** let the bubble float unless near an edge ([6fb93a0](https://github.com/pleahmacaka/eris/commit/6fb93a0580ce1884cb373ac4e7d01b6c972ca0c5))
* **chat:** run Claude Code from the bubble ([58386be](https://github.com/pleahmacaka/eris/commit/58386be35ae98a171b090cf7e7885da370674e58))
* **dock:** pin to desktop and honor the mac width ([875ed1d](https://github.com/pleahmacaka/eris/commit/875ed1d39b0c35cdb8d54ab034a1bf6eae542a45))
* **dock:** tray sheet, live preview, stacked usage ([34a4eaf](https://github.com/pleahmacaka/eris/commit/34a4eaf61274ae1ee1f9e6f618ade610401dea8f))


### Bug Fixes

* **chat:** load slash commands on open and prefer exact matches ([8e078e2](https://github.com/pleahmacaka/eris/commit/8e078e29e69b8579cd3ec8968c8d4ea4b18acefc))
* **chat:** snap to the nearest edge and size in rem ([7468032](https://github.com/pleahmacaka/eris/commit/74680323cfcbd9eb2ef844228bf4099809d8f08d))
