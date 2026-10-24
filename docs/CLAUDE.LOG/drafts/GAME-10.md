## 2026-10-24 GAME-10（C2）棋盤元件與 board.scss

- **事件委派集中在 `.pt-board`**：`BoardCell` 無 emits，`GameBoard` 用 `closest('[data-cell]')` 找格，避免 100 個 listener（§6.2）。拖曳以 `setPointerCapture` 綁在棋盤本身，`pointermove` 改用 `document.elementFromPoint` 找格，因為 capture 後 `e.target` 恆為棋盤。
- **拖曳去重記「上一個回報的格」而非「目前是否在棋盤內」**：指標移出棋盤時不 emit 也不清掉上一格，回到同一格就不會重複 emit（Review Focus 5）。只認發起拖曳的 `pointerId`，多指不互擾。
- **`dragend` 只在真的有拖曳時 emit**：指定模式的 `pointerup` 不發 `dragend`，消費端不必處理無意義的結束事件。`readonly` 下所有事件（含 `key`）都不 emit。
- **鍵盤焦點固定在棋盤**：格子 `tabindex="-1"`，`pointerdown` 時 `preventDefault` 並把焦點拉回 `.pt-board`，讓指定模式「點格 → 打數字 → Enter」的按鍵都從棋盤 `keydown` 發出；因此沒有實作 spec §6.1 的「鍵盤 Enter 在格上 → press」，Enter 由 `key` 交給 `useGame`／`PlayView` 解讀，避免 Enter 同時觸發 press 與確認。
- **`shake` 重觸發**：先清 class、`nextTick` 後強制 reflow 再加回，連續兩次 shake 也會重播 150 ms 動畫；計時重新起算。
- **版面**：12 條軌道（首末為半格外框帶、中間 10 格），寬度合計 11 個 `--cell`；格以 inline `grid-row/column = r+2 / c+2` 定位。龍頭三角形以 `--row`／`--col` 絕對定位在外框帶中線，角落格兩邊各一個（§6.3）。
- **board.scss 由 `GameBoard.vue` 自行 import**：`main.scss` 屬禁區，故不從主樣式匯入。
- i18n 新增 `board.boardLabel`、`board.number`；`conflict.ts` 未改（BoardCell 介面只有 `conflict: boolean`，衝突說明文字留給 D1 圖例／提示使用）。
