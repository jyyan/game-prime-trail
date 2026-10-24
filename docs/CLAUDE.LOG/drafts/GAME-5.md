## 2026-10-24 B3 Solver：計數到 n 即停、節點預算（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §5）

- **起因**：plan `docs/superpowers/plans/2026-10-24-prime-trail.md` Task B3（taskboard GAME-5）。題庫生成（C1）的唯一解檢查、進階 greedy 與挑戰計數都靠這支 solver，題庫與測試也用它驗證。
- **裁定（使用者）**：無（照 spec §5 與 plan 走）。
- **做法**：
  - 前處理把 start 當成 1 的 given 一起驗：given 越界、同格兩值、同值兩格、灰底與質數不符、灰底格數 ≠ 25、連續 given 距離超過數字差或奇偶不合，一律直接回 `{count:0, exhausted:true, nodes:0}`。spec 只要求距離檢查；其他幾條也都是「必無解」的必要條件，讓 C1 拿到壞題面時不會白跑預算。
  - 有了連續 given 的靜態檢查，§5.4.1 的 given 可達性只需檢查「下一個 given」（三角不等式蓋過其餘），省下每步掃全部 given。
  - §5.4.2 的質數可達性改成較強但仍必要的形式：未訪灰底格依距離排序後，第 i 近的必須在第 i 個未用質數的步數內（Hall 條件的排序形式）。它同時涵蓋 spec 的兩條（最近灰格趕得上下一質數、每個灰格都有質數趕得上），用 19 格的距離桶計數，O(25)。
  - 度數規則多一條：若 100 是 given，唯一可當終點的 avail=1 格只能是那一格。
  - 節點 = 通過 §5.3 候選過濾後實際放下的次數，預算在放之前檢查，所以 `nodes ≤ maxNodes` 嚴格成立（plan 允許 +4，實作不需要）。初始的 1 不算節點，因此「全部 given」的題面 nodes 恰為 99。
  - 達到 `maxSolutions` 就停並回 `exhausted:false`，即使剛好是最後一解：停下時無法知道後面還有沒有，照 §5.1 語意。`collect` 為真時無解也回空陣列，呼叫端不必判 undefined。
  - 連通性 BFS 照 spec 每步都做，沒有先改成「度數變動才做」：整檔測試 < 2 s，遠低於 plan 的 10 s 門檻，不需要提前最佳化。
  - 刻意不動：`types.ts`、`geometry.ts`、`primes.ts`、fixture；測試不 import 同層的 B1／B2，mask 解碼與解的合法性檢查在測試檔內自寫。
- **守門**：新增 `src/core/__tests__/solver.test.ts` 9 案（easy 唯一、{1,17} 唯一、恰 2 解且對上兩條 fixture 路徑、maxSolutions 早停、節點預算、挑戰找 2 個合法解、距離不可能題面、矛盾 given、全部 given）。`pnpm test` 由 5 檔 29 案增為 6 檔 38 案；DoD 三條全綠。
- **流程**：taskboard 派工單 agent，在 worktree `task/GAME-5` 直接實作，未再 fan out。
- **踩坑**：無。
- **遺留**：backlog 草稿 `docs/backlog/drafts/GAME-5.md` 一項（generator 版本字串要涵蓋 solver 剪枝行為）。
