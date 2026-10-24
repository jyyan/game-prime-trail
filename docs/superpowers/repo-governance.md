# 本 repo 的 agent 治理指南（repo 即公司）

**本檔由 studio-devops 的治理範本管理**（`templates/repo-governance/docs/superpowers/repo-governance.md`）：重跑 `scripts/repo-governance-init.sh <repo>` 就會更新成最新版，所以不要手改，要改就改範本。設計 spec 與反面教材（Paperclip 試驗）在 studio-devops 的 `docs/`，日常不需要讀。

## 1. 模型

| 角色 | 誰 | 做什麼 |
|---|---|---|
| 董事會 | 使用者 | 裁定範疇與取捨（每個功能 2 到 4 題）、合併前最後把關 |
| CTO | 使用者加主 session | 讀碼、寫 spec、寫 plan、派工、審 diff、合併；不親自實作 |
| 工程師 | worktree 裡的拋棄式 subagent 或 workflow agent | 只動自己清單裡的檔案，跑完 DoD 才回報 |

閘門是機械的：DoD 指令鏈、CI（若有）、對抗式審查 agent。審計軌跡是 git、`docs/CLAUDE.LOG/`、`docs/audits/`。不使用自主循環的 agent：沒有組織圖、沒有 agent 自行排程或互派工作，沒有「留評論就算完成」。唯一允許的常駐元件是受控派工器（例如 taskboard 的 worker），且必須**同時**滿足八道閘門：(1) 每個任務在自己的 `task/<identifier>` 分支 worktree 內做；(2) 派工器自己在 worktree 重跑本 repo 的 DoD，不採信 agent 自述；(3) 另開唯讀的對抗式審查 session，阻擋級發現回饋修正，最多兩輪；(4) 合併到主分支、驗收 done、核准 Q2 計畫一律由人；(5) agent 不自行移動任務狀態；(6) 沒有可派工任務時不開任何 session；(7) 每個 run 有預算上限與權限逾時（逾時即拒絕、任務轉 blocked）；(8) 失敗不自動重試，一律 blocked 由人決定。

三條鐵則：不經確認不寫碼；不跑完 DoD 不回報（附輸出尾段與沒做的事，不得宣稱未執行的結果）；主 session 不審 diff 不合併。

## 2. 安裝後第一次要做的事（主 session）

使用者會貼固定提示詞，要求先 `/rules-audit` 再補完 CLAUDE.md 的治理段落。補完時只填 `<!-- 填寫： -->` 標示處，不改通用文字：

| 段落 | 怎麼填 |
|---|---|
| 權威文件 | 讀 `docs/`、README、既有 spec 目錄，把本 repo 的總規格、架構決策、契約定義一列一份登錄；既有的 specs／plans 不搬動，登錄原路徑 |
| 守門結構 | 照實寫：CI workflow 檔與步驟、部署前檢查、防漂移測試；沒有的寫「無」，沒有 CI 就寫「無 CI，DoD 為唯一閘門」 |
| 完成定義（DoD） | 從 package.json scripts、Makefile、CI 步驟抄出可直接執行的指令鏈；沒有測試框架的 repo 先寫語法檢查或 lint，並在 `docs/backlog.md` 開一條「建立測試骨架」 |
| 例行盤點五軸 | 在 `docs/audits/routine-checklist.md` 填「查什麼／怎麼查／紅燈」與基線指令；每軸至少一列 |

填不確定的，列成「需要使用者裁定」問句，不要猜。

## 3. 日常節奏

1. **spec**：`superpowers:brainstorming` → `docs/superpowers/specs/YYYY-MM-DD-<主題>.md`。
2. **裁定**：主 session 停下，列 2 到 4 題，使用者拍板。
3. **plan**：`superpowers:writing-plans`，依 `docs/superpowers/plan-template.md` 補相依層表、每任務驗收指令與禁區。
4. **實作**：小案由主 session 依 `docs/superpowers/dispatch-prompt.md` 派 Agent（`isolation: "worktree"`）；一層五個任務以上用 `implement-layer`（§4）。
5. **合併**：主 session 逐分支 `git diff <主分支>..layer-<層>/<任務>`，在主 checkout `git merge --no-ff`（衝突在主 checkout 解，不把主分支合進任務分支）、跑完整 DoD、併入各分支的 `docs/CLAUDE.LOG/drafts/` 到月檔、回寫 backlog（整合各分支的 `docs/backlog/drafts/`），草稿刪除與合併同一個 commit；已登錄 taskboard 的 repo 見 §7。
6. **盤點**：每月或大案後依 `docs/audits/routine-checklist.md`，第 1 軸固定先跑 `/rules-audit`。

## 4. `implement-layer` workflow

1. 從 plan 的某一層轉出 args JSON（格式在 `docs/superpowers/plan-template.md` 末段），`base` 填 `git rev-parse <主分支>`。
2. 確認 `/config` 的 Dynamic workflow size 允許該層規模：每個任務 5 到 15 個 agent（兩輪修正時達上限；實作 1、驗證 1、審查 3、修正最多 2 輪各再加驗證與審查）。
3. 對主 session 說「use a workflow：implement-layer，args 在 <json 路徑>」。
4. 跑完回傳 `{layer, done, blocked}`；`blocked` 的任務帶分支名與原因，由使用者決定補派或改 plan。
5. 中斷用 `resumeFromRunId` 接續；已完成的 agent 直接回快取。

限制：子 agent 只能指定 Claude 層級，接不到內網 LiteLLM 模型，`.no-cloud` repo 不適用；零測試的 repo 第一個 workflow 應是「補 DoD 與測試骨架」。

## 5. `/rules-audit`

裝在 `.claude/commands/rules-audit.md`。五步：機械盤點（`studio-devops/scripts/repo-governance-init.sh --audit .` 產生 `docs/audits/prompt-inventory.md`）→ 以 headless `claude -p '/doctor prompt-audit'` 取得內建審查報告存到 `docs/audits/` → 本指令只補內建不看的部分 → 合併報告，內建發現編號 `P`、本指令發現編號 `R`，列出待裁定問句 → 使用者回「套用 P1 R3」後才動檔。

## 6. 踩坑

- 工具開的 worktree 基底可能是 `origin/<主分支>` 而非本機主分支，spec 檔在 worktree 裡會不存在；派工 prompt 第一步必須 `git merge --ff-only <base>` 並驗證。
- worktree 初始 `node_modules` 為空時 Vite 會往上層主 checkout 解析而被拒；worktree 內 `npm ci` 即解。不要用符號連結，會被 `git add -A` 當檔案 commit。
- 主 checkout 有另一個 session 未提交的改動時，以「HEAD 加本段」直接寫 index 提交，不夾帶他人內容。
- 盤點時先開 worktree 再派 agent，中途開會讓已派出的 Explore agent 的 Bash 被隔離擋下。
- 重跑或 resume 同一層時，若上次的 `layer-<層>/<id>` 分支仍被殘留的 worktree 佔用，`git checkout -B` 會失敗；先 `git worktree list` 清掉殘留（`git worktree remove`）再跑。
- 指路徑時若工作還在 worktree 分支上，明說「尚未合併」並給 worktree 路徑；主 checkout 沒有的檔不要當成已存在。
- 同層多個任務在同一個共用檔的同一錨點「各自追加一行」，git 三方合併照樣衝突（路由表尾、import 區、`if`／`v-else-if` 鏈、scss 檔尾、月日誌檔尾都中過）。plan 要讓同層可動檔案兩兩不相交，共用檔的改動放到前一層殘樁任務或改成一功能一檔的登錄結構；日誌與 backlog 一律走 `drafts/`。
- 已登錄 taskboard 的 repo：在任務分支上 `git merge main` 解衝突會改變任務分支頂端，worker 判定「交付後變動」並要求重驗。合併一律在主 checkout 做 `git merge --no-ff <任務分支>`。

## 7. taskboard 整合（僅已登錄 taskboard 的 repo）

適用條件：本 repo 在 taskboard 登錄為專案。未登錄的 repo 本章不適用，日常節奏照 §3。

- **接口**：agent 只透過 taskboard 的 MCP 接口（api service 的 `/mcp`，Bearer token）回報，可用的只有 `add_comment` 與 `report_run_result`。agent **不得**自行移動任務狀態；狀態由 worker 依 DoD 與審查結果移動，或由人操作。
- **兩種 token**：agent token 由 worker 於每次 run 簽發，範圍僅限該 run 的任務，run 結束即失效，角色永遠不能核准或驗收。個人 token 依裝置發給人，**絕不**注入派工 session、不寫進任何 repo、不放進 agent 的環境變數或設定檔；在 repo 或 agent 環境裡看到個人 token 就是事故，立刻回報。
- **派工 session**：每個任務一個 task main session（CTO 角色），在 `task/<identifier>` 分支的 worktree 內工作；可依 `docs/superpowers/dispatch-prompt.md` fan out subagent，各自 worktree。subagent 的 worktree 預設從預設分支開，所以派工 prompt 的「基底 commit」填任務分支 HEAD，第一步必須 `git merge --ff-only <任務分支 HEAD>` 並回報 `git rev-parse HEAD`。
- **閘門**（§1 八道的任務視角）：worker 自己在 worktree 重跑本 repo 的 DoD → 另開唯讀的對抗式審查 session，阻擋級發現回饋修正最多兩輪 → push 任務分支 → in_review。合併到主分支、驗收 done、核准 Q2 計畫一律由人。每個 run 有預算上限與權限逾時（逾時即拒絕、任務轉 blocked）；失敗不自動重試，一律 blocked 由人決定。
- **紀錄**：CLAUDE.LOG 與 `docs/backlog.md` 都不在任務分支內改——日誌段落寫 `docs/CLAUDE.LOG/drafts/<任務編號>.md`，backlog 新增與結案寫 `docs/backlog/drafts/<任務編號>.md`（格式見 `docs/backlog.md` 檔頭；帶 `backlog_ref` 的任務在結案段寫對應 R 與任務編號），主 session 在主 checkout 合併時把日誌草稿併入月檔、backlog 草稿整合進 backlog，刪兩種草稿，與合併同一個 commit；R 編號只由主 session 發。
- **人工驗證**：目標平台的人工驗證清單放 `docs/verification-checklist.md`（選用；不存在視為無人工驗證項目），in_review 時由人依它驗收。骨架在 studio-devops 的 `templates/repo-governance/optional/verification-checklist.md`，需要時手動複製，安裝腳本不裝。

