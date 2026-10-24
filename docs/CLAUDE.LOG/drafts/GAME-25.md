## 2026-10-25 GAME-25 首頁改版：hero、規則卡、難度說明、空白不報錯、找不到題庫插圖（spec：docs/superpowers/specs/2026-10-25-ui-refresh.md §4.4、§5.2）

- **起因**：UI refresh plan 層 U-B 的 U-B2。首頁只有標題與選單，新玩家看不到規則；空白欄位一載入就顯示紅字錯誤（backlog R30）；題庫缺檔時只有一行警告。
- **裁定（使用者）**：沿用 spec 定稿：活潑遊戲風、hero 插圖、可收合規則卡記在 `prime-trail:v1:ui`、難度附一句說明、空白只停用不報錯。
- **做法**：
  - 錯誤字的出現條件改為「有值且非法、且已 blur 或按過 Enter」，重新輸入時先收起：使用者還在打字時不該被紅字打斷，但離開欄位或嘗試開始時要說清楚為什麼不能開始。空白不算「有值」，所以 blur 也不報錯。
  - 規則卡預設展開，收合狀態寫入 `prime-trail:v1:ui` 的 `rulesCollapsed`；寫入時保留同 key 的其他欄位，讓之後的 UI 偏好可共用此 key。這個 key 不分題庫版本（偏好不該因換題庫而重置），讀寫只透過 `composables/storage.ts`，壞 JSON 視為未設定。
  - 專案只引入部分 Bootstrap（沒有 card／alert），卡片外觀以 scoped style 引用 `--pt-surface`／`--pt-radius-card`／`--pt-shadow-clay` token，不改全域樣式。
  - 難度按鈕改成左側名稱＋說明、右側完成標記＋最佳紀錄，左側不再為空白的完成標記留位；「隨機」改為帶內嵌 SVG 骰子的 outline-secondary，「開始」為唯一主按鈕（btn-lg）。輸入框、隨機、開始最小高度 44px。
  - 找不到題庫改用 `missing.webp`＋標題＋說明，文字放 `home` 命名空間（原本借用 `play.levelMissing`）。插圖 `<img>` 都給 `width`／`height` 與 i18n alt。
- **守門**：HomeView／LevelPicker／DifficultyPicker 三檔由 30 案增為 41 案（HomeView 新增 hero、規則卡預設展開、收合記憶、壞 JSON、空白不報錯、超界 blur 後報錯；LevelPicker 新增 blur 前不報錯、Enter 報錯、隨機按鈕次要；DifficultyPicker 新增說明文字、完成標記在右）；新增 `e2e/12-home-ui.spec.ts` 4 案 × desktop／mobile。DoD 三條全綠。
- **流程**：workflow 層 U-B，worktree 分支 `layer-U-B/U-B2`；e2e 以 scratchpad 的隔離設定（port 4273）只跑 12 號檔，避免與同層 U-B1 的 4173／8788 互撞。
- **踩坑**：`@vue/test-utils` 的 `isVisible()` 在未 attach 的 mount 上切換 `v-show` 後回報不準，單元測試改讀 inline `display: none`。e2e 截圖要加 `animations: 'disabled'`，否則按鈕 180ms 轉場中途被拍下、顏色半透明。e2e 的缺檔案例只能在 dev server 以動態 import 取同一個 store 單例模擬。
- **遺留**：見 `docs/backlog/drafts/GAME-25.md`（缺檔 e2e 只能在 dev server 跑）。截圖（375／1280 px，空白、已選、題庫缺檔）存在 workflow scratchpad 的 `uiux/`，未 commit。
