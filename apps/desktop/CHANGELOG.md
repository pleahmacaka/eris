# Changelog

## [0.3.10](https://github.com/pleahmacaka/eris/compare/0.3.9...0.3.10) (2026-10-08)


### Features

* **files:** preview hwp, office documents, folders and archives ([645f519](https://github.com/pleahmacaka/eris/commit/645f5190d905b6ce28c8f6e86defb60afeb9a477))

## [0.3.9](https://github.com/pleahmacaka/eris/compare/0.3.8...0.3.9) (2026-10-08)


### Features

* **calendar:** edit inline, select ranges, group events and write memos live ([fb446d2](https://github.com/pleahmacaka/eris/commit/fb446d2292312f3c252bdcacc30ef5ba1e7ab109))
* **files:** split network places, embed terminal and show drop hints ([6fdafd3](https://github.com/pleahmacaka/eris/commit/6fdafd328470079572388fb6fa6cab31096fd21a))
* **screen-share:** detect active windows capture sessions ([b17905b](https://github.com/pleahmacaka/eris/commit/b17905badc3349ccb4e7e1d31c6e3cb5d8f9627e))
* **terminal:** share tab strip and hand off panes between windows ([9409430](https://github.com/pleahmacaka/eris/commit/9409430cbd8c2fd0f05301f700ff3ad7c6c58685))


### Bug Fixes

* **dock:** refresh cached icons when the file changes ([8ac6183](https://github.com/pleahmacaka/eris/commit/8ac6183fa298504704c9d213ca19cf47dbe881af))


### Performance Improvements

* **desktop:** load holidays, markdown and auth on demand ([f0113e5](https://github.com/pleahmacaka/eris/commit/f0113e585d1ea4c924100ae66df881dfa59f549b))

## [0.3.8](https://github.com/pleahmacaka/eris/compare/0.3.7...0.3.8) (2026-10-07)


### Features

* **calendar:** confirm deletes, drag-order all-day events, detail beside list ([3d92cde](https://github.com/pleahmacaka/eris/commit/3d92cde81724dc74f6234e162c55ec4d96c8829f))
* **calendar:** render notes as markdown with note previews ([f572748](https://github.com/pleahmacaka/eris/commit/f5727484566b7493603f40378b1f4ddf0553c779))
* **calendar:** rework event details and the day list ([d10d936](https://github.com/pleahmacaka/eris/commit/d10d936cac3c90d78135a791d2e6d68309f50f0b))
* **dock:** widen icon and height ranges for high-dpi displays ([8541c1b](https://github.com/pleahmacaka/eris/commit/8541c1bf341609685754332049139c1c20d3a338))
* **edit:** drag dock widgets to reorder and gather panel settings ([8a96cac](https://github.com/pleahmacaka/eris/commit/8a96cacb318d1d4d8576274d753baa89c029ea22))
* **files:** add setup, rebuild settings, collapse toolbar ([68fd6bf](https://github.com/pleahmacaka/eris/commit/68fd6bf20dd90c8df0ff6f610c032843685c806e))
* **terminal:** group merged terminals into named tabs ([57ecc48](https://github.com/pleahmacaka/eris/commit/57ecc481916a6d78943453c01c56a765c11c6209))
* **terminal:** move settings onto the shared window ([dfcd789](https://github.com/pleahmacaka/eris/commit/dfcd7892a5c3cbef6de5d2bd2a6d8d7d1e47be63))
* **ui:** share settings window, setup and theme rows ([8dd8d98](https://github.com/pleahmacaka/eris/commit/8dd8d9867a0ad788c62700c191ea03e656c2ee5a))


### Bug Fixes

* **desktop:** avoid stale proxied assignments ([8af90b9](https://github.com/pleahmacaka/eris/commit/8af90b9125e23dcf344018a7b5a0d784e6b163c8))
* **desktop:** raise windows without injecting the alt key ([a21ffd1](https://github.com/pleahmacaka/eris/commit/a21ffd1e24fa1e0fd43e5f16a491fe59f2c0b5f0))
* **files:** restore splitters and show this pc instantly ([05bcbe9](https://github.com/pleahmacaka/eris/commit/05bcbe904431f5578d1388b4409e157bdd0a58cd))

## [0.3.7](https://github.com/pleahmacaka/eris/compare/0.3.6...0.3.7) (2026-10-06)


### Features

* **appearance:** per-window backgrounds and new glass ([6ce3df1](https://github.com/pleahmacaka/eris/commit/6ce3df147bf54f17c91d6c25370ba613aca4aca8))
* **auth:** keep sessions in the system keychain on linux and macos ([d11ca10](https://github.com/pleahmacaka/eris/commit/d11ca1011b528e1ee3808d461df1d5956889a1a7))
* **calendar:** task events, inline editor and note link ([9b844eb](https://github.com/pleahmacaka/eris/commit/9b844ebb1f99897615b29dde0d7c8c6ab09e9d4e))
* **desktop:** share the eris style with note ([2a4d1d8](https://github.com/pleahmacaka/eris/commit/2a4d1d8dedd4ec2b739e9d6b5b9478428b3de649))
* **dock:** open sound settings from the volume popup ([c3ae8f3](https://github.com/pleahmacaka/eris/commit/c3ae8f315b09da1f6f2072f7cc7e94dc29a7210f))
* **dock:** reveal the hidden dock only at the screen edge ([77d5db7](https://github.com/pleahmacaka/eris/commit/77d5db7edab04b6e5d2935f16eb0eac14723ccb3))
* **files:** browse other devices' files with their approval ([af0c52c](https://github.com/pleahmacaka/eris/commit/af0c52c1e2ea2e3d23c066b80fbe413c032d67a7))
* **files:** build for android ([a8e7d4c](https://github.com/pleahmacaka/eris/commit/a8e7d4c8c770c8ea3265716ae2ce4e568c62f153))
* **files:** let long-standing devices remove newer ones ([099ef82](https://github.com/pleahmacaka/eris/commit/099ef82683e18b5c0cfddd224d87b764b1c43448))
* give files, terminal and studio their own icons ([ee3c33b](https://github.com/pleahmacaka/eris/commit/ee3c33b6d87aa8a584fc9c482ee0fd7b0ffec9d2))
* **launcher:** add power actions to the menu ([cf6c927](https://github.com/pleahmacaka/eris/commit/cf6c927c13a602894d4a91a7d2c314a621df3ec8))
* **note:** redesign the calendar for phones ([1e31c4d](https://github.com/pleahmacaka/eris/commit/1e31c4d54d11bcf5c1697846b3e904cfee501657))
* **note:** remake the settings page ([14e42ad](https://github.com/pleahmacaka/eris/commit/14e42ad3d2dd44e77ef83085a73f97835f3182ce))
* run files and terminal on linux and macos ([ab478e4](https://github.com/pleahmacaka/eris/commit/ab478e4ed259f97f1a57930205727bbe80025f66))
* **studio:** work in release builds and publish themes ([aca4c68](https://github.com/pleahmacaka/eris/commit/aca4c689998aaca1580a2eb7bd35766290765b16))
* **sync:** let long-standing devices remove newer ones ([72364e1](https://github.com/pleahmacaka/eris/commit/72364e1e3f7137c419cd4fabaaf7b3cd5f62daf7))


### Bug Fixes

* **desktop:** use the eris logo as favicon ([e92e2ba](https://github.com/pleahmacaka/eris/commit/e92e2ba1deeae7dc8712b4018d08d76e4b43506a))
* **note:** drop the scrambling titles and make section headers readable ([69312e5](https://github.com/pleahmacaka/eris/commit/69312e5dc9768ae16e7e7887c032bfd25d212caa))
* shorten Note and site copy to plain statements ([545e4b2](https://github.com/pleahmacaka/eris/commit/545e4b23266bf7037d668d3cf945a15138e0a281))
* **terminal:** pass wheel and paste chords to tui apps ([492adb7](https://github.com/pleahmacaka/eris/commit/492adb7533733da65d3a4588e1fc9c83fb2ccafb))

## [0.3.6](https://github.com/pleahmacaka/eris/compare/0.3.5...0.3.6) (2026-10-04)


### Bug Fixes

* **dock:** always show running apps ([2f925d6](https://github.com/pleahmacaka/eris/commit/2f925d65698e16f7c2208948609712f5af36b070))
* **dock:** stay hidden over games and maximized windows ([0a69aa3](https://github.com/pleahmacaka/eris/commit/0a69aa3b2acddd58c85893cbc2cf355f681394bd))
* **files:** unpin quick access folders from their home entry ([b545257](https://github.com/pleahmacaka/eris/commit/b545257c6681cddc0cdc7b3ba7bc79d408b7f72e))
* **terminal:** keep spaces typed in hangul mode ([b87cdc9](https://github.com/pleahmacaka/eris/commit/b87cdc9f3b4ab7b50dbf6c65dc3c4f60c279d838))
* **tray:** send the select notice after a left click ([ea2caa6](https://github.com/pleahmacaka/eris/commit/ea2caa6a92da1808a08a2a0db44c10b212ebb9cf))

## [0.3.5](https://github.com/pleahmacaka/eris/compare/0.3.4...0.3.5) (2026-10-03)


### Bug Fixes

* **terminal:** send alt shortcuts with an escape prefix ([b7f315d](https://github.com/pleahmacaka/eris/commit/b7f315d858d1abdb09c8e3d84c57e99a753815c2))

## [0.3.4](https://github.com/pleahmacaka/eris/compare/0.3.3...0.3.4) (2026-10-03)


### Features

* add archives, accounts and terminal splits ([6ee96b1](https://github.com/pleahmacaka/eris/commit/6ee96b1529100d528d0c17f5f7e2d1ebc13e5289))
* **web:** add dock and screen pickers to the live preview ([53b31b3](https://github.com/pleahmacaka/eris/commit/53b31b381ee34ea4cec31daee5e025a3f0d1b26a))
* **web:** add the theme gallery, editor and live preview ([f1f440c](https://github.com/pleahmacaka/eris/commit/f1f440c51c48f16619967e41be5ec9d07861ac23))


### Reverts

* point release and site links back at eris ([ab7d6c9](https://github.com/pleahmacaka/eris/commit/ab7d6c9f0300d0274676ee8bd62711622b5c4cf6))

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
