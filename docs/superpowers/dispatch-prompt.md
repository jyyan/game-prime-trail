# 派工 prompt 範本

主 session 手動派 Agent 與 `implement-layer` workflow 都用這六個欄位，順序固定。方括號處替換成實際值。

---

你在獨立的 git worktree 內實作一個任務，只做這個任務，做完回報。

1. **任務**：[任務編號] [標題]
   - spec：[spec 路徑] 的 [章節]
   - plan：[plan 路徑] 的 [章節]
2. **基底**：先執行 `git merge --ff-only [基底 commit]`，再執行 `git rev-parse HEAD` 並把結果寫進回報；若 HEAD 不等於基底，執行 `git checkout --detach [基底 commit]` 後再建分支。在分支 `[分支名]` 上工作。
3. **可動檔案**：[清單]。**禁區**：[清單]，碰到就停下回報。工作日誌寫 `docs/CLAUDE.LOG/drafts/[任務編號].md`、「之後再做」寫 `docs/backlog/drafts/[任務編號].md`；`docs/CLAUDE.LOG/YYYYMM.md` 與 `docs/backlog.md` 不在可動清單內。
4. **本 repo 慣例**（與本任務相關的三到五條，從 CLAUDE.md 摘）：
   - [慣例 1]
   - [慣例 2]
5. **驗收**：逐條執行並貼輸出尾段：
   - 任務驗收：[指令]
   - DoD：[指令鏈]
6. **回報格式**（最後的文字就是回報，不要寒暄）：
   - 分支與 commit hash（commit 後執行 `git checkout --detach` 釋放分支）
   - 改動檔案清單
   - 新增測試案例數與檔名
   - 每條驗收與 DoD 指令的輸出尾段（至少 summary 行）
   - **沒做的事與原因**
   - **不得宣稱未執行的結果**；跑不動就寫跑不動與錯誤訊息
