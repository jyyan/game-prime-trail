## 2026-10-25 D4 正式題庫 v1 凍結（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §4、§12）

- **起因**：GAME-18 / plan Task D4。D1、D2 做好生成腳本與題庫檢查後，需要真正跑出 1000 關並凍結，讓之後的 UI、儲存層、PDF 都以同一份固定題庫為準；已發佈的關卡編號不能再變。
- **裁定（使用者）**：無（照 spec 與 plan）。
- **做法**：題庫由主 session 在本機生成並提交（e3254c9），本任務只收尾，不重新生成。
  - 生成：Apple M4、`pnpm gen:levels --workers 8`，wall time 2027 s，平均每張 16.2 s、最慢 31.0 s。hintCount 6:1000；c 分布 1:217、2–9:611、10–99:128、100–999:2、null:42（4.2%，遠低於 30% 門檻，不需調參）。SHA-256 `397af235fb990c1deb04ed67d377605af9d3414c088da36ec04b9eeb69f4e9b1`，libraryVersion=1，levels.json 150993 bytes。
  - 跨機器可重現：另在 M70t 工作站以相同參數重跑，前段逐張結果（attempt、c、節點數）與本機一致，確認生成只取決於種子與參數、不取決於機器。
  - `levels.meta.jsonl` 依 plan D4 一併 commit，是續跑與 `--recompute` 的依據。
  - 收尾改動：五個題庫測試檔把 `describe.skipIf(skipWithoutLevels())` 改成 `describe`，移除不用的 import。題庫現在是 repo 的一部分，缺檔就該失敗而不是靜默跳過，否則凍結守門形同虛設。
- **守門**：`src/data/__tests__` 3 檔 24 案、無 skipped，integrity 案 37 ms（< 2 s）。`pnpm test:slow`：3 檔 15 案全綠，Duration 89.04 s（含唯一性 1000 張、重現抽樣、解檢查；與 typecheck/test/build 並行跑，CPU 有競爭）。DoD：typecheck 通過、`pnpm test` 44 檔 417 案通過＋1 skipped（useLevelStore 的「levels.json 不存在」案，題庫存在時依設計跳過）、build 成功。
- **流程**：單一 agent 在 worktree `task/GAME-18` 收尾，一個 commit；由主 session 審查後合併。
- **踩坑**：build 產物沒有任何 levels chunk，`dist/assets` 只有 index、HomeView、PlayView 等。原因是目前沒有 view 引用 `useLevelStore`，`import.meta.glob` 的動態載入被 tree-shake 掉，主 bundle 也不含題庫（index JS 97 kB）。這不是題庫進了主 bundle，而是還沒接線。
- **遺留**：接上 UI 後須再確認題庫成為獨立 chunk（約 150 KB）、不進主 bundle。
