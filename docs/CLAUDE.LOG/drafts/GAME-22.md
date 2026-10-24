## 2026-10-25 GAME-22 主棋盤 320px 溢出（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §6.1–§6.3、§9）

- **起因**：GAME-21 留下的 R42。`src/styles/board.scss` 的 `--cell: clamp(30px, calc((100vw - 16px) / 11), 48px)` 下限 30px，棋盤寬固定 11 個 `--cell`（10 格加兩條半格外框帶），最小 330px；PlayView 外層 `px-2` 左右各留 8px，320px 視窗只剩 304px。修正前實測棋盤右緣 338px，超出視窗 18px。
- **裁定（使用者）**：比照 GAME-21，降低下限或改依容器寬計算，二擇一。
- **做法**：下限從 30px 降到 26px，公式不變。沒有改成依容器寬計算，原因有兩個：(1) container query 要在棋盤的父層設 `container-type`，父層在 PlayView／GameBoard，不在本任務可動範圍；`.pt-board` 本身用 `width: max-content`，不能當自己的查詢容器。(2) 主棋盤的可用寬度就是 `100vw - 16px`，用視窗寬計算本來就正確，問題只出在下限。26px 的理由：`11 × 26 = 286 ≤ 304`，一直到約 302px 寬的視窗都放得下，比 27px（297px）多一點餘裕。320px 時 clamp 實際取流動值 `(320 − 16) / 11 ≈ 27.6px`，下限要到更窄的視窗才會生效。375px（32.6px）、Pixel 7 412px（36px）以上的格寬和修正前完全相同。
- **320px 實測**（Playwright，320×640、isMobile、hasTouch）：格寬 27.625px，字級 11.6px（`--cell × 0.42`），棋盤左右緣 8.06／311.94px，`scrollWidth` 320 = `innerWidth`。觸控目標約 27.6px，低於 44px 建議值，但 10×10 棋盤在 320px 寬度下物理上最多也只能約 30px；拖曳接續模式靠 `elementFromPoint` 命中格子，格子變小不影響命中邏輯。數字在截圖中仍可讀。
- **SolutionView**：GAME-21 用 `.pt-solution :deep(.pt-board)` 覆寫 `--cell`，選擇器的權重高於 `.pt-board`，所以這次改動不影響解答視窗；`09-solution-layout` 在兩個 project 都通過。
- **守門**：新增 `e2e/10-small-screen.spec.ts`（只在 desktop-chromium 跑，viewport 固定 320×640）：斷言主棋盤左右緣在視窗內（容許 1px）、`scrollWidth ≤ innerWidth`，並用參考解點擊填 3 格。修正前因右緣 338 > 321 失敗，修正後通過。`pnpm test:e2e` 23 passed、2 skipped（03 在 desktop、10 在 mobile，依設計跳過）。DoD 三條全綠。320px 下遊戲頁沒有其他造成水平捲動的元素。
- **流程**：單一 agent 在 worktree 分支 `fix/GAME-22` 實作，基底 894ca9b。
