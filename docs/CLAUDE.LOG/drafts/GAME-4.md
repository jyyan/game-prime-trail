## 2026-10-24 B2 盤面驗證與衝突偵測（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §2.7、§2.8）

- **起因**：實作計畫層 B 的 Task B2（taskboard GAME-4），C 層的 `useGame`、棋盤元件、題庫生成與題庫完整性測試都要用到 `findConflicts`／`isSolved`／`headOf`。
- **裁定（使用者）**：無（照 spec 與 plan 的介面做）。
- **做法**：新增純函式模組 `src/core/validate.ts`，只 import `geometry`、`primes`、`types`。`findConflicts` 先把每格的衝突記成 bit flag 再展開，這樣「同一格多種衝突各回一筆」、同一 (cell, kind) 不會重複，就算數字重複導致 `nonAdjacent` 配對數變多也一樣。`nonAdjacent` 對 n 與 n+1 所在格的每一組配對都檢查，因為有重複時 spec 說「a、b 都標」，只看第一格會漏標。`isSolved` 直接檢查 §2.8 的五條，**不**寫成「`findConflicts` 為空且盤面填滿」：衝突種類裡沒有「1 不在龍頭」和「given 被改」，§2.8 說的等價要靠 UI 鎖住 given 格才成立，核心函式不應假設 UI 有鎖。`cellOfNumber` 直接用 `Uint8Array.indexOf`，重複時自然回最小索引。
- **守門**：測試 8 檔 64 案 → 9 檔 89 案（新增 `validate.test.ts` 25 案）。四種衝突各有正例；§2.8 五條各有反例，另外補了單獨違反某一條的案例：plan 給的條件 2 範例（龍頭改 2、cell 9 改 1）同時也斷了相鄰、違反了 given，所以另用「反轉參考路徑、龍頭不設 given」單獨驗條件 2；條件 3、5 也各有只違反該條的版本。DoD：`pnpm typecheck` 通過、`pnpm test` 9 檔 89 案全過、`pnpm build` 成功。
- **流程**：單一 agent 在 GAME-4 worktree 直接實作（範圍只有一個模組加一個測試檔，沒有拆給 subagent），先寫測試再實作，一個 commit。
- **踩坑**：plan 寫的草稿檔名是 `drafts/B2.md`，taskboard 治理規定用任務編號，這裡以 `drafts/GAME-4.md` 為準。
- **遺留**：backlog 草稿一項（spec §2.8 等價敘述的前提），見 `docs/backlog/drafts/GAME-4.md`。
