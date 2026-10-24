## 2026-10-24 GAME-10（C2）棋盤元件與 board.scss

- **事件委派集中在 `.pt-board`**：`BoardCell` 無 emits，`GameBoard` 用 `closest('[data-cell]')` 找格，避免 100 個 listener（§6.2）。拖曳以 `setPointerCapture` 綁在棋盤本身，`pointermove` 改用 `document.elementFromPoint` 找格，因為 capture 後 `e.target` 恆為棋盤。
- **拖曳去重記「上一個回報的格」而非「目前是否在棋盤內」**：指標移出棋盤時不 emit 也不清掉上一格，回到同一格就不會重複 emit（Review Focus 5）。只認發起拖曳的 `pointerId`，多指不互擾。
- **`dragend` 照 plan 契約在每次 `pointerup`／`pointercancel` emit（兩種模式皆然）**：初版只在拖曳中才發，審查指出偏離 plan 而改回。唯一例外：接續模式拖曳進行中，另一個 `pointerId` 放開不結束拖曳也不發 `dragend`，否則第二指離開會讓消費端以為拖曳結束、棋盤卻還在發 `drag`。`readonly` 下所有事件（含 `key`）都不 emit。
- **鍵盤焦點固定在棋盤，Enter 依焦點目標分流**：格子 `tabindex="-1"`，`pointerdown` 時 `preventDefault` 並把焦點拉回 `.pt-board`，讓指定模式「點格 → 打數字 → Enter」的按鍵都從棋盤 `keydown` 發出。spec §6.1「鍵盤 Enter 在格上 → press」照做：`keydown` 的 target 是某格（例如輔助技術把焦點移到格上）時 Enter emit `press(cell)` 並 `preventDefault`（擋掉 button 原生 click），不再發 `key`；焦點在棋盤本身時 Enter 照常走 `key`，由 `useGame`／`PlayView` 當確認。兩者互斥，不會一次 Enter 同時 press 又確認。
- **`shake` 重觸發**：先清 class、`nextTick` 後強制 reflow 再加回，連續兩次 shake 也會重播 150 ms 動畫；計時重新起算。每次呼叫遞增序號，`nextTick` 回呼序號不符（同一 tick 內被下一次 shake 取代）或元件已卸載就不動作，避免兩個回呼各設一個 timer、前一個提早結束後一次的 shake，以及卸載後才排出 `onBeforeUnmount` 清不到的 timer。
- **版面**：12 條軌道（首末為半格外框帶、中間 10 格），寬度合計 11 個 `--cell`；格以 inline `grid-row/column = r+2 / c+2` 定位。龍頭三角形以 `--row`／`--col` 絕對定位在外框帶中線，角落格兩邊各一個（§6.3）。
- **board.scss 由 `GameBoard.vue` 自行 import**：`main.scss` 屬禁區，故不從主樣式匯入。
- i18n 新增 `board.boardLabel`、`board.number`；`conflict.ts` 未改（BoardCell 介面只有 `conflict: boolean`，衝突說明文字留給 D1 圖例／提示使用）。
- **狀態框線疊加而非互蓋**：選取／龍頭／提示／衝突原本各自整條覆寫 `box-shadow`，後寫的蓋掉前者，選取格一旦衝突就失去選取框（違反 §9「不只靠顏色」）。改為每個狀態只設自己的寬度變數（`--pt-w-*`，關閉時 0px），`box-shadow` 由外而內依序疊四圈內陰影，每圈的 spread 為累計寬度，任何組合都同時看得到；衝突另有紅字底線作非顏色線索。
