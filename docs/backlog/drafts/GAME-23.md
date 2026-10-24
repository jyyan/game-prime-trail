## 新增

- 【UI・中】棋盤載入即顯示焦點環：`board.scss` 已只在 `.pt-board:focus-visible` 畫環，但 PlayView 掛載時以程式呼叫 `GameBoard.focus()`（`boardEl.focus()`），Chrome 在無指標互動前把程式焦點視為 focus-visible，載入後仍見藍框（spec 2026-10-25-ui-refresh §5.1）。修法：`GameBoard.vue` 的 `focus()` 與指標處理改用 `focus({ preventScroll: true, focusVisible: false })`（滑鼠或觸控觸發時），鍵盤導覽不受影響。GAME-23 可動檔不含 GameBoard.vue／PlayView.vue，故未修。
- 【UI・低】新紀錄徽章對比：白字在 `--pt-pink`（#EC4899）只有 3.53:1，只合大字標準；U-B3 實作徽章時須用 ≥ 18.66px 粗體，或改用深色徽章底（例如 `--pt-hint` #BE185D，白字 6.04:1）。
- 【UI・低】spec §3 token 表未列 `--pt-hint`（#BE185D，棋盤提示高亮環）：GAME-23 為了讓提示環在黃色質數格上 ≥ 3:1 而新增，下次修 spec 時補進表格。
