## 2026-10-25 GAME-23（U-A1）設計 token、棋盤配色、字型與插圖資產

UI 改版（spec `2026-10-25-ui-refresh.md`）的殘樁層：把所有共用樣式與資產一次放好，讓 U-B 三個任務只動自己的頁面。

- **token 與 Bootstrap 覆寫同源**：spec §3 的 `--pt-*` 全放在 `main.scss` 的 `:root`；Bootstrap 的 `$primary`／`$danger`／`$body-bg`／`$body-color` 用同一組 hex。兩邊無法共用變數（Bootstrap 要編譯期色值），所以對比腳本 `scripts/check-contrast.ts` 直接從 `main.scss` 讀值，並檢查覆寫與 token 一致，避免日後只改一邊。
- **另覆寫 `$secondary` 為 `--pt-text-muted`**：頁面背景改成 `#EFF6FF` 後，Bootstrap 原本的灰 `#6c757d` 只剩 4.3:1，而 `btn-outline-secondary` 是全站最多的按鈕；不改就有十幾顆按鈕不合格。
- **新增 `--pt-hint`（`#BE185D`）**：spec 表外的 token。提示高亮原本是琥珀色，在新的黃色質數格上幾乎看不到；`--pt-accent`、`--pt-pink` 在黃底都低於 3:1，所以選深粉紅，在白、黃兩種格底都有 ≥ 4.8:1。
- **龍頭格上的環改色**：龍頭格改藍底後，原本藍色的選取環與深色的接續頭環在藍底上低於 3:1。改成用 CSS 自訂屬性設定環色，龍頭格上選取環用質數黃、頭環與衝突環用白；龍頭格衝突時字維持白色，靠底線傳達。
- **對比結果**：36 組全過（文字 ≥ 4.5、非文字指示 ≥ 3）。Review Focus 3 的兩組：玩家藍 `#1D4ED8` 在質數黃上 5.38:1，衝突紅 `#B91C1C` 在質數黃上 5.20:1。新紀錄徽章白字在 `--pt-pink` 只有 3.53:1，只能當大字（≥ 18.66px 粗體）用，已在腳本標成 large。`--pt-accent`、`--pt-success` 只作裝飾，不檢查。
- **按鈕回彈**：所有 `.btn`（不含 link、close）按下時縮到 `--pt-press-scale`；實心按鈕加黏土陰影，但加上 `:not(:focus-visible)`，否則選擇器權重會蓋掉 Bootstrap 的焦點環。reduced-motion 時關掉轉場與縮放。
- **插圖**：cwebp 壓縮，保留透明度。win.png 因為彩帶細節多，q80 有 122 KB，改用 `-size` 目標壓到 76 KB；目視檢查沒有明顯色塊。favicon／apple-touch-icon 用 sips 從 icon.png 縮出，沒有新增任何工具依賴。
- **焦點環仍會在載入時出現**：棋盤現在只在 `:focus-visible` 時顯示焦點環，但 PlayView 掛載時以程式呼叫 `focus()`，Chrome 在還沒有指標互動時會把程式焦點算成 focus-visible，所以載入時藍框還在。這只能在 `GameBoard.vue` 或 `PlayView.vue` 改成 `focus({ focusVisible: false })` 才修得掉，不在本任務可動範圍，已寫進 backlog 草稿。
