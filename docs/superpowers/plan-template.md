# [功能名稱] 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [一句話]

**Architecture:** [兩三句]

**Tech Stack:** [關鍵技術]

**Spec:** [spec 路徑]

## Global Constraints

[從 spec 逐條抄的全案約束，一行一條]

## Review Focus

[spec 暗示但沒有任務的測試涵蓋、最可能咬到使用者的五種輸入或失敗模式；每條指定由哪個任務補測試]

---

## 工作流與相依

| 層 | 任務 | 相依 |
|---|---|---|
| A | A1、A2 | 無 |
| B | B1、B2 | A |

同層任務彼此獨立、**只動自己清單內的檔案，且各任務的 Files 清單兩兩不相交**（「只追加一行」擋不住衝突：同一錨點兩邊追加，git 一律報衝突）。共用檔若必須改，放到前一層的殘樁任務一次改完（型別、分支、登錄項先補齊），或改成一功能一檔、集中登錄的結構。工作日誌與 backlog 寫各自的 `drafts/<任務編號>.md`，不改月檔與 `backlog.md`。每層最後由主 session 在主 checkout 合併、跑完整 DoD、併入草稿。

---

## 層 A

### Task A1: [名稱]

**Files:**
- Create: `[路徑]`
- Modify: `[路徑:行號]`
- Test: `[路徑]`

**禁區：** `[不得碰的檔案或目錄]`

**Interfaces:**
- Consumes: [用到前面任務的什麼，精確簽章]
- Produces: [後面任務依賴的什麼，精確名稱與型別]

**驗收指令：**
- `[可直接執行、能判斷 pass／fail 的指令]`

**完成證據：** [哪些檔案、哪些測試案例]

- [ ] **Step 1: 寫失敗測試**
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

---

## 轉成 `implement-layer` 的 args

主 session 從本 plan 的某一層轉出，存成 `docs/superpowers/plans/<plan 檔名>.layer-<層>.json` 再傳給 Workflow：

```json
{
  "spec": "docs/superpowers/specs/YYYY-MM-DD-xxx.md",
  "plan": "docs/superpowers/plans/YYYY-MM-DD-xxx.md",
  "layer": "A",
  "base": "<git rev-parse <主分支> 的輸出>",
  "setup": ["pnpm install --frozen-lockfile"],
  "dod": ["pnpm typecheck", "pnpm test", "pnpm build"],
  "tasks": [
    {
      "id": "A1",
      "title": "任務名稱",
      "files": ["src/a.ts", "src/__tests__/a.test.ts"],
      "forbidden": ["migrations/"],
      "acceptance": ["pnpm vitest run src/__tests__/a.test.ts"],
      "planSection": "### Task A1"
    }
  ],
  "models": {"implement": "sonnet", "verify": "haiku", "review": "haiku", "fix": "sonnet"}
}
```

- `dod`：必填、不得為空陣列，逐字照抄 CLAUDE.md「完成定義」的指令鏈；兩邊不一致時以 CLAUDE.md 為準並先修正 args。
- `setup`：選填，新 worktree 的依賴安裝指令；workflow 在實作、驗證、修正三個 agent 切到正確 commit 後各跑一次。不需安裝依賴的 repo 傳 `[]` 或省略。
- `models`：workflow 一律以此為準（未給的角色用預設 implement／fix=sonnet、verify／review=haiku），不分任務難度；同一層若有需要較強模型的任務，把整層的 `implement`／`fix` 調高，或把該任務拆到另一層。
