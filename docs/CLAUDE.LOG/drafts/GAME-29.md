## 2026-10-25 GAME-29 首次操作提示與頂列「？」操作說明（spec：docs/superpowers/specs/2026-10-25-controls-help.md）

使用者回報第一次玩的人不知道能用方向鍵或拖曳連填：操作都做了，但畫面上沒人說。做法是頂列與棋盤之間放一張只講「這台裝置、這個模式」關鍵操作的提示卡，玩家自己成功填一格就永遠收起；完整說明放到頂列最右的「？」對話框，兩種裝置都列、目前裝置在前。

「玩家自己填一格」不能從 `grid`／`steps` 的 watcher 推（提示、撤回、重新開始、恢復存檔都會動它們），所以在 `usePlaySession` 加 `playerFills` 計數，只在 `trailPress`／`trailStep` 回 `'placed'` 與 `confirmPending()` 成功時 +1；不碰 `src/core/**`、不改任何操作語意。拖曳連填會連續 +1，PlayView 端 `markHintSeen` 先看記憶體旗標，storage 只寫一次。恢復的存檔若已有步數，視為已會操作，直接記為看過，避免功能上線前就在玩的人被打擾。

「看過」與首頁 `rulesCollapsed` 共用 `prime-trail:v1:ui`，所以把 HomeView 內嵌的讀寫抽成 `useUiPrefs`（`readUiPrefs`／`mergeUiPrefs`，一律先讀再合併、非物件或讀不到當 `{}`、寫入失敗吞掉），兩頁不會互蓋欄位。裝置用 `matchMedia('(pointer: coarse)')` 在 ready 時判斷一次，不嗅探 UA；沒有 `matchMedia` 當滑鼠＋鍵盤。鍵名寫在 i18n 字串的 `{arrows}`、`{tab}` 等記號，元件切開後渲染成 `<kbd>`，樣式用 token（`--pt-bg` 底、`--pt-text` 字、`--pt-text-muted` 框），不依賴未匯入的 Bootstrap partial。新增色對已登記 `scripts/check-contrast.ts`（43/43 通過）。頂列欄改成 `auto minmax(0,1fr) auto auto`，320px 寬時標題省略號截斷、「？」與「首頁」維持 44px。

既有 e2e 不逐檔改：`playwright.config.ts` 的 `use.storageState` 對 dev 與 wrangler 兩個 origin 預寫 `controlsHintSeen: true`；新的 `e2e/14-controls-help.spec.ts` 以空 storageState 從乾淨狀態驗桌機鍵盤版、行動拖曳版、「？」鍵盤開關與焦點回歸、320px 無水平捲動。截圖（首次提示 1280／375／320、說明對話框 375／1280）由 `PT_SHOT_DIR` 產出，未 commit。
