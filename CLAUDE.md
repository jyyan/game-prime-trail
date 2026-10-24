# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案

game-prime-trail：網頁遊戲，玩法與範疇見 `docs/superpowers/specs/2026-10-24-prime-trail-design.md`（草稿，待使用者確認）。技術棧為 Vue 3 + TypeScript + Vite + Bootstrap 5，測試用 Vitest + `@vue/test-utils`，套件管理器 pnpm；部署在 Cloudflare Workers（以 Workers static assets 發佈 `dist/`，設定檔 `wrangler.jsonc`）。本 repo **已登錄 taskboard**（專案 `game-prime-trail`，任務前綴 `GAME`），凡「已登錄 taskboard 的 repo」條件句一律適用：要做的工作開 taskboard 任務，`docs/backlog.md` 只管技術債與「之後再做」。專案骨架尚未建立（taskboard `GAME-1`，backlog R1），以下指令在骨架建好後生效：

- `pnpm dev`：Vite 開發伺服器
- `pnpm typecheck`：`vue-tsc --noEmit`
- `pnpm test`：`vitest run`；單一檔 `pnpm vitest run <檔案路徑>`，單一案例加 `-t "<名稱>"`
- `pnpm test:slow`：慢測（題庫重量檢查），不屬 DoD
- `pnpm test:e2e`：Playwright，不屬 DoD，合併前人工跑
- `pnpm build`：產出 `dist/`
- `pnpm run deploy`：`pnpm build && wrangler deploy`；**不可寫 `pnpm deploy`**（pnpm 內建指令，會蓋掉同名 script）

## 權威文件（規劃與實作前必讀）

| 文件 | 內容 |
|---|---|
| `docs/backlog.md` | 待辦、技術債與「之後再做」，R 編號；已登錄 taskboard 的 repo 工作項在 taskboard |
| `docs/superpowers/specs/` | 功能設計 spec（brainstorming 產出） |
| `docs/superpowers/plans/` | 實作計畫（writing-plans 產出，含相依層） |
| `docs/CLAUDE.LOG/` | 工作日誌，記「為什麼」 |
| `docs/audits/` | 例行盤點規範與各輪紀錄 |
| `docs/superpowers/repo-governance.md` | 本 repo 的 agent 治理操作指南（角色、補段落方法、日常節奏、`implement-layer`、`/rules-audit`、踩坑） |
| `docs/superpowers/specs/2026-10-24-prime-trail-design.md` | Prime Trail 總體設計 spec（草稿，§15 開放問題待裁定） |

架構決策文件尚未建立。

遇規格衝突以權威文件為準、不自行發明；要改規格就改文件再改碼。狀態為「草稿」的 spec 不覆蓋本檔：兩者衝突時以本檔為準並回報；spec 定稿後依 spec 修改本檔。


## 守門結構

每次合併進主分支前依序過的機械式閘門。agent 的自述不是閘門。

1. **DoD 指令鏈**（見「完成定義」）：任何環境都要過，是最低門檻。
2. **CI**：無 CI，DoD 為唯一閘門。
3. **部署前檢查**：`pnpm run deploy` 前 DoD 須全綠；build 與 `wrangler deploy` 內無額外檢查。
4. **結構性防漂移測試**：無。


## 開發流程規範（設計 → 確認 → 平行實作）

功能開發固定三段，**不可跳過確認直接寫碼**：

1. **設計釐清（主 session）**：主 session 與使用者釐清需求、界定範疇、對照權威文件找衝突，產出 spec 至 `docs/superpowers/specs/YYYY-MM-DD-<主題>.md`（brainstorming 流程），必要時再拆成 `docs/superpowers/plans/` 的實作計畫（plan 必須有相依層表、每個任務的驗收指令與禁區，範本在 `docs/superpowers/plan-template.md`）。設計階段只讀碼、不改碼。
2. **與使用者確認**：spec／計畫寫完先停下，向使用者說明範疇、取捨與拆分方式，**取得明確同意後**才進入實作；使用者若修改範疇，回到步驟 1 更新 spec，不邊做邊猜。
3. **fan out 平行實作（subagent 或 workflow）**：確認後依計畫把彼此獨立的工作拆給 subagent 平行執行，複雜邏輯與跨模組契約改動用較強模型，範圍明確的頁面、測試、文件用較省的模型；主 session 留在原 session 做派工、審查與整合，**不親自實作**。派工 prompt 一律依 `docs/superpowers/dispatch-prompt.md` 的欄位組成，必附 spec 與 plan 章節、可動檔案、禁區、驗收指令與回報格式。

**每個 subagent 各自在獨立 git worktree 內實作**，**禁止**兩個 agent 共用同一個 checkout：多個 agent 在同一工作區改檔會互搶檔案、互相覆蓋未 commit 的變更、typecheck 與測試也會彼此干擾。主 checkout 只做純文件小改與最終合併。worktree 內依本 repo 的套件管理器重新安裝依賴（`pnpm install --frozen-lockfile`）或把 `node_modules` 寫進 `.git/info/exclude`，不要用符號連結（會被 `git add -A` 當檔案 commit）。派工 prompt 第一步必須要求 `git merge --ff-only <基底 commit>` 並回報 `git rev-parse HEAD`，因為工具開的 worktree 基底可能是遠端分支而非本機主分支。每個 agent 在自己的 worktree 內跑完 DoD 再回報，由主 session 逐一審 diff 後合併回主分支；合併衝突由主 session 處理，不讓 agent 互相 rebase。

**同層任務的可動檔案集合必須兩兩不相交**。「只追加、不改既有行」擋不住衝突：兩個分支在同一個檔的同一錨點（路由表尾、import 區、`if`／`v-else-if` 鏈、檔尾）各自追加，git 一律報衝突，第二個合進主分支的就會衝。共用檔若非改不可，改法只有兩種：(a) 放到前一層的殘樁任務一次改完（型別、分支、登錄項先補齊，後層任務只填自己的新檔）；(b) 改成「一功能一檔、集中登錄」的結構（例如用 `import.meta.glob` 掃目錄組登錄表），讓新功能只新增檔案。主 session 合併同層分支時**固定在主 checkout 執行 `git merge --no-ff <任務分支>`、在主 checkout 解衝突**；不要把主分支合進任務分支再合回來，那會改變任務分支頂端，已登錄 taskboard 的 repo 會判定「交付後變動」而要求重驗。

三條鐵則：

1. **不經確認不寫碼**。
2. **不跑完 DoD 不回報**：回報必附實際指令輸出的尾段與「沒做的事」；不得回報未執行過的結果。
3. **主 session 不審 diff 不合併**：agent 不碰主分支、不 push。`.claude/settings.json` 以 `permissions.deny` 擋下 `git push`；要 push 由人在終端機自己執行。


## 完成定義（DoD）

改動完成前在 repo 根目錄依序跑，全綠才算完成；回報時貼每條指令輸出的 summary 行：

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm build`

骨架建立前（backlog R1）三條指令都不存在，只改文件的變更免跑；任何程式碼改動必須先完成 R1。


## 工作日誌與 backlog

重要工作完成後更新 `docs/CLAUDE.LOG/YYYYMM.md`，寫法見 `docs/CLAUDE.LOG/README.md`：以摘要敘述，著重「設計邏輯」與「變更原因」，記錄「為什麼這樣做」比「做了什麼」重要；避免逐行描述程式碼。**分支內不改月檔**（多個分支在檔尾追加必衝突）：在分支上工作的 agent 把日誌段落寫到 `docs/CLAUDE.LOG/drafts/<分支或任務編號>.md`（格式同月檔的一段），由主 session 合併時併入 `docs/CLAUDE.LOG/YYYYMM.md` 並刪除草稿，與合併同一個 commit。

所有「之後再做」的事回寫 `docs/backlog.md` 並給 R 編號；結案時移到已結段並留 commit。**分支內不改 `docs/backlog.md`**（多個分支在同一錨點插入必衝突、各自取號會撞號）：在分支上工作的 agent 把新增項（不給編號，寫 `- 【類別・等級】標題：內文`）與結案項（`- R<n>：結案說明`）寫到 `docs/backlog/drafts/<分支或任務編號>.md`，由主 session 合併時整合進 `docs/backlog.md`（發 R 編號、移已結）並刪除草稿，與合併同一個 commit；R 編號只由主 session 發。已登錄 taskboard 的 repo：要做的工作開在 taskboard 而非 backlog；帶 `backlog_ref` 的任務在草稿的結案段寫對應 R 與任務編號，CLAUDE.LOG 同樣走 `docs/CLAUDE.LOG/drafts/<任務編號>.md`；接口、token、派工 session 與閘門的規則見 `docs/superpowers/repo-governance.md` §7。


## 例行盤點

每月一次或每個大案後，依 `docs/audits/routine-checklist.md` 執行：先跑 `/rules-audit` 審核本檔與其他 agent 規範的矛盾，再唯讀五軸 fan out、高等級項目抽查核實、與上輪比對、三類分類、回寫 backlog 與 CLAUDE.LOG。紀錄存 `docs/audits/YYYY-MM-DD.md`。


## 長任務（workflow）

需要連續數小時的實作，走「spec → plan（相依層）→ 一層一個 workflow → 主 session 合併」：

- plan 的每一層任務彼此獨立、各自有驗收指令。主 session 把一層的任務清單轉成 `.claude/workflows/implement-layer.js` 的 `args`（格式見 `docs/superpowers/plan-template.md` 末段），以 Workflow 工具啟動；啟動前確認 `/config` 的 Dynamic workflow size 允許該層的 agent 數。workflow 內的模型一律以 `args.models` 為準，不套用「開發流程規範」第 3 步依任務難度選模型的規則；需要較強模型時調整整層的 `args.models`。
- workflow 內每個任務：實作（worktree）→ 獨立驗證（重跑驗收與 DoD）→ 三視角對抗式審查 → 最多兩輪修正；只建立分支 `layer-<層>/<任務>`，**不合併、不 push、不碰主分支**。
- workflow 結束後主 session 逐一 `git diff <主分支>..layer-<層>/<任務>` 審查、合併、跑完整 DoD、寫 CLAUDE.LOG，再發下一層。中斷用 `resumeFromRunId` 接續。
