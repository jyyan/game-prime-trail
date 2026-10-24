## 2026-10-25 GAME-26（U-B3）過關視窗：插圖、大字成績、按鈕主次

依 UI refresh spec §5.3 改寫 `WinModal`：頂部放 `win.webp` 吉祥物插圖（140×140，給 `width`／`height` 與 i18n 的中文 alt，reduced-motion 以外加一次 300ms 彈入），時間與步數改成兩塊白底黏土卡片，標籤小字、數值用 Fredoka 大字；新紀錄徽章改用 `--pt-pink`；footer 改為「隨機下一張」整列主按鈕置頂，其餘三顆次要按鈕等寬排在下一列，全部高度 ≥ 44px。props／emits 與 `data-action`、`data-new-best`、`data-time`、`data-steps` 鉤子都不變。

- **新紀錄徽章對比：選「維持 `--pt-pink`、徽章字放大到 19px 粗體」而非改 `--pt-hint` 深底。** 白字在 `#EC4899` 上只有 3.53:1，未達一般文字 4.5:1，但達 WCAG 大字門檻（≥ 18.66px 粗體需 ≥ 3:1）。選這條的原因：spec §5.3 明寫徽章用 `--pt-pink`，`scripts/check-contrast.ts` 也已把這對登記成 large text，維持粉紅不用改 spec 也不用改腳本；過關視窗本來就是慶祝場景，徽章大一點正合適。代價是徽章在 375px 下兩欄卡片內幾乎占滿寬度，因此徽章允許換行（`white-space: normal`），實測 375px 下單行放得下、無水平捲動。日後若徽章文字變長或字級要縮小，改走 `--pt-hint` 深底（白字 6.04:1）。
- **標籤與數值拆成兩個 span，但兩者寫在同一行、中間留一個空白。** Vue 的 whitespace condense 會刪掉含換行的元素間空白，若拆行寫，`[data-steps]` 的 textContent 會變成「步數74」，PlayView 測試與 e2e 依賴「步數 74」這種文字。i18n 因此把 `win.time`／`win.steps`（含佔位符）改成 `win.timeLabel`／`win.stepsLabel`，數值由元件格式化。
- **統計卡片用 `--pt-surface` 底而不是 `--pt-bg`。** Bootstrap 的 modal 底色跟 `$body-bg` 走，對話框本身就是 `--pt-bg` 淡藍，卡片若也用 `--pt-bg` 就看不出來；改白底加 `--pt-shadow-clay`。
- **主按鈕放到 DOM 第一個。** 原本主按鈕在最後；改成第一個讓視覺順序、Tab 順序與 `autofocus` 一致。

截圖（375／1280 px，不 commit）：scratchpad `uiux/win-375.png`、`uiux/win-1280.png`。
