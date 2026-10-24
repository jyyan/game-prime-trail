## 2026-10-25 GAME-21 解答視窗棋盤溢出（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §6.1–§6.3、§6.8、§9）

- **起因**：使用者截圖（桌機）顯示解答 BsModal 內的棋盤右側超出 `.modal-content`。`src/styles/board.scss` 的 `--cell` 以 `100vw` 計算，桌機會取上限 48px，棋盤寬 11 × 48 = 528px；但預設 `.modal-dialog` 最寬 500px，body 內容只有約 466px。手機也一樣：modal 的外距加上 body 內距，讓可用寬度比 `100vw - 16px` 窄。修正前實測溢出量：桌機 44px、Pixel 7 16px。
- **裁定（使用者）**：(a) 解答棋盤改依容器寬度算 `--cell`；(b) 解答 modal 用 `size="lg"`。不改 `board.scss`，遊戲頁主棋盤不受影響。
- **做法**：
  - `SolutionView.vue` 的根 `.pt-solution` 設 `container-type: inline-size`，並以 scoped `:deep(.pt-board)` 覆寫 `--cell: clamp(20px, calc(100cqi / 11), 48px)`。棋盤寬度恆為 11 個 `--cell`（10 格加兩條半格外框帶），所以 `100cqi / 11` 剛好等於容器寬。棋盤原本就是 `width: max-content; margin-inline: auto`，所以會置中。這個覆寫只套用在解答視窗內，遊戲頁的主棋盤繼續用 `board.scss` 依視窗寬計算。
  - 下限為什麼從 30px 降到 20px：用 Playwright 量容器（`.pt-solution`）實際寬度，320px 寬時 270px、375px 時 325px、Pixel 7（412px）時約 362px。375px 的手機就已經小於 330px（30 × 11），30px 下限在常見手機寬度會溢出。降到 20px 後，最小 220px 仍可放進 320px 手機的 270px 容器。實際 cell 寬度：320px 約 24.5px，375px 約 29.5px，數字仍然可讀（字級也以 `--cell` 等比縮放）。
  - `PlayView.vue` 的解答 `<BsModal>` 加 `size="lg"`。視窗寬 ≥ 992px 時 dialog 為 800px，body 內容 766px，棋盤以 48px（528px）完整顯示；576–991px 時 dialog 仍是 500px，cell 會縮成約 42px，不溢出。
- **守門**：新增 `e2e/09-solution-layout.spec.ts`，在 desktop 與 mobile project 斷言解答棋盤的左右緣都落在 `.modal-content` 內（容許 1px），在「參考解」與「你的解」兩個視圖都檢查。修正前兩個 project 都失敗（桌機右緣 935 > 891，手機右緣 421 > 405），修正後通過。`pnpm test:e2e` 22 passed、1 skipped（03 在 desktop 依設計跳過）。DoD 三條全綠。
- **流程**：單一 agent 在 worktree 分支 `fix/GAME-21` 實作，基底 c56f45f。
- **遺留**：320px 寬時遊戲頁主棋盤仍是 330px（`board.scss` 下限 30px），比視窗寬，這不在本任務範圍內，寫進 backlog 草稿。
