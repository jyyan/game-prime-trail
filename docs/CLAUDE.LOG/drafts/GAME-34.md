## 2026-10-25 GAME-34 遊戲頁接上死路標示與過關連線（spec：docs/superpowers/specs/2026-10-25-demo-playback.md §5.4、§6）

- **起因**：plan Task B2（taskboard GAME-34）。A1 的 `trailOf`／`findDeadEnd` 與 A2 的 GameBoard `marks`／`trail` 已就緒，遊戲頁要把它們接上；同時結 R51（標記與連線的瀏覽器目視確認）。
- **裁定（使用者）**：無（沿用 spec D8–D11）。
- **做法**：PlayView 只加 computed，不碰 composable 與元件。`playerTrail = trailOf(grid, puzzle)` 是死路標示與連線共用的來源；`deadEnd` 只在 `difficulty === 'easy'` 且未過關時算，trail 為 null（1…h 本身有衝突）就交給既有衝突標示。`marks`：`noMove` 只標 `rejected` 為 reject；其他 kind 標 head 格 reject、`cells` 為 trap。head 取 `trailOf` 的最後一格，所以當玩家剛填的那一步讓 h 自動延伸過 given（例如 42 接上 given 43）時，✕ 落在 given 格上，這是 plan「head 格」的字面結果。說明行放在棋盤下方、StatusBar 之前，`aria-live="polite"`、`data-dead-end`，無死路時 `v-if` 不渲染（版面不留白）；文字 far 帶 `{v}{dist}{steps}`、noMove 帶 `{n}=h+1`。標示完全由盤面推導，undo、退回、清除、重新開始後自動消失，不設 `assisted`、不寫 storage。
  連線的條件取「`trailOf` 回傳長度 100」而非字面的 `status === 'won'`：過關必然滿足它（`isSolved` ⊂ 合法完整 trail），而 spec §5.4 要求「重新整理恢復已過關的局也要畫」，但 `useGame` 恢復存檔時一律是 `playing`（過關會刪存檔，且 composable 屬禁區），只有用盤面判斷才能涵蓋存檔裡已是完整解的情況。線依玩家盤面，不是參考解。
- **守門**：`PlayView.test.ts` 49 → 56 案（+7：trap 標示與說明行位置、undo 消失、`assisted` 不變；far 參數；進階同盤面不顯示；不多寫 storage key；ALT 解過關連線依玩家盤面；重新開始後線消失；恢復完整解存檔有線；未完成無線）。先還原 PlayView 跑一次確認 6 案失敗。新 e2e `e2e/16-dead-end-trail.spec.ts` 3 案（桌機＋行動 5 跑、320px 那案只跑桌機）：死路 ✕ 與說明行、復原消失；過關關掉彈窗後見 100 點折線；320px 無水平捲動。e2e 的死路盤面在測試內由參考解即時找一步 `far` 偏離，不依賴題庫內容寫死。DoD：typecheck、test（642 passed / 1 skipped）、build 全綠。
- **R51 目視結果**：375／1280 截圖存 scratchpad `uiux/`（dead-end-far-*、trail-*，未 commit）。✕ 在格右上角、紅色清楚可辨；trap 的紅色虛線框與淡紅底和實線的 `.is-conflict` 看得出不同；連線在格底色之上、數字之下，數字移到左上角未被線蓋住。375 寬時角落數字約 8px，偏小但可讀。說明行在 375 寬自動換兩行，無溢出。
- **流程**：spec → plan 層 B → implement-layer workflow 的 worktree 分支 `layer-B/B2`。
- **踩坑**：fixture 的參考解單步偏離只會觸發 far 或 twoEnds，要得到 trap 需要偏離數步（沿用 GAME-31 的「前 39 步＋61,60,50」）。
- **遺留**：見 backlog 草稿（過關後龍頭框仍留在 100 上）。
