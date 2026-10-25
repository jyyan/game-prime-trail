### GAME-32 棋盤標記、完成連線疊層、i18n 與 token（示範播放 層 A2）

為了讓示範播放（B/C 層）與正式遊戲的死路標示、過關連線共用同一套棋盤呈現，先在 GameBoard 開三個選填入口：`marks`（reject／trap／branch）與 `trail`（1→100 的格序）。兩者不傳時 DOM 與 class 與改動前完全相同，SolutionView 與既有測試不受影響。

連線用單一 `<polyline>` 的 SVG 疊層（`TrailLine.vue`），viewBox 取 11×11，一個單位就是一格，外圈半格帶讓格心落在 (c+1, r+1)，因此不必量測 DOM。層次是格底色之上、數字之下：數字在 `trail` 模式改包一個 `z-index: 2` 的 span，疊層 `z-index: 1`、`pointer-events: none`。這個 span 只在 `trail` 為真時才出現，避免動到平常的 DOM。

標記的形狀刻意與 `.is-conflict` 的實線紅框區分：reject 是淡紅底加右上 ✕（`::after`），trap 是紅色虛線 outline，branch 是藍色虛線 outline，不只靠顏色。新 token（`--pt-trail`、`--pt-dead-bg`、`--pt-dead-line`、`--pt-branch-line`）寫成十六進位字面值，因為 `check-contrast.ts` 只解析 hex，不解析 `var()`；`--pt-dead-line` 與 `--pt-danger` 同值、`--pt-branch-line` 與 `--pt-primary` 同值，對比已登記並通過。

文字進 `demo.ts`（spec §5.3 兩張表）與 `deadEnd.ts`（§6.2 說明行，主詞為玩家）。`dead-end.ts` 核心屬 A1，這裡只備好 kind 對應的字串（far／trap／twoEnds／split／noMove）。
