# 規範審查 2026-10-24

## 1. 盤點範圍

| 檔案 | 行數 | 備註 |
|---|---|---|
| `CLAUDE.md` | 89 | |
| `.claude/commands/rules-audit.md` | 68 | |
| `.claude/workflows/implement-layer.js` | — | 不在盤點清單，但 `CLAUDE.md:87` 指定為長任務入口，查其閘門 |
| `~/.claude/CLAUDE.md` | — | 不存在 |
| `~/.claude/settings.json` | — | 全域；只讀與本 repo 相關的 autoMode 條目 |
| `.claude/settings*.json`、AGENTS.md、GEMINI.md、Cursor／Copilot／openspec／constitution、CONTRIBUTING.md | — | 皆不存在 |

- 機械盤點：`docs/audits/prompt-inventory.md`（2026-10-24 18:16 重跑）。
- 內建審查：已執行（Claude Code 2.1.310），報告 `docs/audits/prompt-audit-2026-10-24.md`，發現 P1–P3。
- 另查：taskboard `list_projects`（本 repo 已登錄為 `GAME`）、`docs/superpowers/specs/2026-10-24-prime-trail-design.md`（commit `9159ae7`）。

## 2. 規則表

| # | 檔案:行號 | 規則原文（縮寫） | 適用對象 | 種類 |
|---|---|---|---|---|
| 1 | CLAUDE.md:7 | 套件管理器 npm；骨架建好後指令生效 | 全部 | 偏好 |
| 2 | CLAUDE.md:9-13 | dev／typecheck／test／build／deploy 指令 | 全部 | 流程 |
| 3 | CLAUDE.md:26 | 總規格尚未建立，第一份 spec 後加列 | 主 session | 流程 |
| 4 | CLAUDE.md:28 | 規格衝突以權威文件為準；改規格先改文件 | 全部 | 必須 |
| 5 | CLAUDE.md:33 | agent 的自述不是閘門 | 全部 | 必須 |
| 6 | CLAUDE.md:35-38 | 閘門：DoD；無 CI；deploy 前 DoD 全綠；無防漂移測試 | 全部 | 必須 |
| 7 | CLAUDE.md:43,55 | 不經確認不寫碼 | 全部 | 禁止 |
| 8 | CLAUDE.md:45 | spec 存 `docs/superpowers/specs/`；plan 須有相依層、驗收、禁區；設計階段不改碼 | 主 session | 流程 |
| 9 | CLAUDE.md:47 | 主 session 不親自實作；依難度選模型；派工依 dispatch-prompt.md | 主 session | 必須／偏好 |
| 10 | CLAUDE.md:49 | 每個 subagent 獨立 worktree；worktree 內 npm ci；先 `merge --ff-only` 並回報 HEAD；主 checkout 只做純文件小改與合併 | 全部 | 必須 |
| 11 | CLAUDE.md:51 | 同層可動檔案兩兩不相交；主 checkout `merge --no-ff`，不把主分支合進任務分支 | 主 session | 必須 |
| 12 | CLAUDE.md:56 | 不跑完 DoD 不回報；附輸出尾段與沒做的事 | 全部 | 必須 |
| 13 | CLAUDE.md:57,88 | 主 session 不審 diff 不合併；agent 不碰主分支、不 push | 全部 | 禁止 |
| 14 | CLAUDE.md:62-66 | DoD：typecheck → test → build，貼 summary | 全部 | 必須 |
| 15 | CLAUDE.md:68 | R1 前只改文件免跑 DoD；程式碼改動須先完成 R1 | 全部 | 流程 |
| 16 | CLAUDE.md:73 | 重要工作寫 CLAUDE.LOG；分支內寫 drafts | 全部 | 必須 |
| 17 | CLAUDE.md:75 | 之後再做寫 backlog；分支內寫 drafts；R 編號只由主 session 發；已登錄 taskboard 則工作項開 taskboard | 全部 | 必須 |
| 18 | CLAUDE.md:80 | 每月或大案後例行盤點，先跑 /rules-audit | 主 session | 流程 |
| 19 | CLAUDE.md:87-89 | 長任務走 implement-layer；workflow 不合併不 push；中斷用 resumeFromRunId | 主 session | 流程 |
| 20 | rules-audit.md:3 | 預設只讀；使用者指定編號才動檔 | 執行本指令者 | 禁止 |
| 21 | rules-audit.md:17,20 | 內建審查需 Claude Code ≥ 2.1.283 | 執行本指令者 | 流程 |
| 22 | implement-layer.js:15 | args 必含 dod（只檢查非 null） | workflow | 必須 |
| 23 | implement-layer.js:25 | 預設模型 implement/fix=sonnet、verify/review=haiku | workflow | 偏好 |
| 24 | implement-layer.js:66-68 | 以 CLAUDE.md 為準；驗收與 DoD 實跑才可回報 done | workflow 子 agent | 必須 |
| 25 | ~/.claude/settings.json:69 | autoMode Trusted repo = xpt-app-sheet-scope（working directory） | 全域 | 偏好 |
| 26 | spec:§11、§15-13 | 套件管理器 pnpm；部署用 `pnpm run deploy` | 全部（草稿） | 必須 |

## 3. 問題表

| 編號 | 嚴重度 | 類型 | 位置 | 原因 | 建議 |
|---|---|---|---|---|---|
| P1 | 高 | 失效（過時事實） | CLAUDE.md:7 | 寫「玩法待第一份 spec 定義」，但 spec 已在 `9159ae7` 提交 | 套用內建 hunk，改指向 spec |
| P2 | 高 | 失效（過時事實） | CLAUDE.md:17-26 | 權威文件表漏列已存在的 spec | 套用內建 hunk 加列 |
| R1 | 高 | 與權威文件衝突 | CLAUDE.md:7-13,49,64-66；routine-checklist.md 基線指令；backlog.md R1 ↔ spec §11、§15 第 13 條 | 治理文字全用 npm，spec 依使用者指示定為 pnpm，且 `pnpm deploy` 會撞內建指令。agent 依 CLAUDE.md 跑 `npm ci` 會產生 package-lock 與 pnpm-lock 並存 | 現在就把三個檔改成 pnpm（`pnpm typecheck`／`pnpm test`／`pnpm build`／`pnpm run deploy`、`pnpm install --frozen-lockfile`、`pnpm audit --prod`），或維持 spec 的安排，在階段 A 改 |
| R2 | 高 | 優先權不明 | CLAUDE.md:19,75 ↔ taskboard | 規則以「已登錄 taskboard」分流，但 CLAUDE.md 沒寫本 repo 已登錄（實際為 `GAME`）；backlog R1「建立骨架」是工作項，依規則應開在 taskboard | 在「專案」段寫明已登錄 taskboard `GAME`；R1 轉成 taskboard 任務並以 `backlog_ref` 互連，或保留在 backlog 並註明理由 |
| R3 | 中 | 優先權不明 | CLAUDE.md:28 ↔ spec 狀態 | spec 狀態為「草稿，待使用者確認」，CLAUDE.md 沒說草稿 spec 算不算權威文件；草稿 spec 與 CLAUDE.md 已有衝突（R1） | 加一句：「草稿 spec 不覆蓋 CLAUDE.md，定稿後依 spec 改 CLAUDE.md」 |
| R4 | 中 | 範圍漏洞 | CLAUDE.md:49 ↔ taskboard `setupCommand=""`、`networkAllowed=false` | taskboard 派工的 worktree 不會安裝依賴，又不能連網，骨架建好後 DoD 必失敗 | 骨架任務完成後把 taskboard `setupCommand` 設成 `pnpm install --frozen-lockfile`，並確認網路／快取策略 |
| R5 | 中 | 範圍漏洞 | implement-layer.js:74-75,95-98 ↔ CLAUDE.md:49 | verify 與 fix 的 prompt 沒要求安裝依賴，新 worktree 缺 node_modules 就跑不動 DoD；只有 dispatch prompt 間接靠「以 CLAUDE.md 為準」帶到 | 在 verify 與 fix prompt 加「先執行安裝指令」，指令由 args 傳入（例如 `args.setup`） |
| R6 | 中 | 範圍漏洞 | implement-layer.js:15 ↔ CLAUDE.md:64-66 | `dod: []` 也能通過檢查，DoD 會被整個略過；DoD 在 CLAUDE.md 與 args 各寫一份，沒有比對 | 檢查 `Array.isArray(a.dod) && a.dod.length > 0`；plan-template 註明 dod 必須逐字照抄 CLAUDE.md |
| R7 | 中 | 範圍漏洞 | CLAUDE.md:57 ↔ CLAUDE.md:33 | 「不 push、不碰主分支」只有文字，沒有 settings deny 或 hook，與「自述不是閘門」矛盾 | 加 `.claude/settings.json` 的 `permissions.deny`：`Bash(git push:*)`；或保留並註明靠 review 把關 |
| R8 | 中 | 範圍漏洞 | CLAUDE.md:47 ↔ implement-layer.js:25 | CLAUDE.md 要求依難度選模型，workflow 預設不分任務難度 | plan-template 的 args 加每個任務的 `model` 覆寫，或在 CLAUDE.md 註明「workflow 以 args.models 為準」 |
| R9 | 低 | 措辭 | CLAUDE.md:68 ↔ CLAUDE.md:56 | 「程式碼改動須先完成 R1」對 R1 本身循環；「只改文件免跑」與無例外的鐵則 2 並存 | 改成「R1 之外的程式碼改動須在 R1 合併後」，鐵則 2 加「見完成定義的例外」 |
| R10 | 低 | 失效引用（預期中） | CLAUDE.md:7-13,64-66 | npm scripts、`package.json`、`wrangler.jsonc` 尚不存在（R1 前的預期狀態）；盤點腳本報的 `@vue/test-utils`、`dist/` 為誤報 | 不動；R1 完成後重跑盤點 |
| R11 | 低 | 失效引用（全域） | ~/.claude/settings.json:69 | autoMode「Trusted repo」寫死另一個 repo 為 working directory，在本 repo 不成立 | 改成通用寫法或列出多個 repo（全域檔，不在本 repo commit） |
| P3 | 低 | 版本寫死 | rules-audit.md:17,20 | 寫死 Claude Code 2.1.283 | 只標記，不改 |

### 內建提案 hunk（P1、P2 原文）

```diff
@@ -7 +7 @@  (P1)
-game-prime-trail：網頁遊戲，玩法與目標玩家待第一份 spec 定義。技術棧為 Vue 3 + TypeScript + Vite + Bootstrap 5，…
+game-prime-trail：網頁遊戲，玩法與範疇見 `docs/superpowers/specs/2026-10-24-prime-trail-design.md`（草稿，待使用者確認）。技術棧為 Vue 3 + TypeScript + Vite + Bootstrap 5，…
@@ -24,3 +24,4 @@  (P2)
 | `docs/superpowers/repo-governance.md` | … |
+| `docs/superpowers/specs/2026-10-24-prime-trail-design.md` | Prime Trail 總體設計 spec（草稿，§15 開放問題待裁定） |
 
-總規格與架構決策文件尚未建立；第一份 spec 產出後在上表加列。
+架構決策文件尚未建立。
```

## 4. 需要使用者裁定

1. **P1、P2**（spec 未被引用）：(a) 照內建 hunk 套用；(b) 套用但不寫「總體」，只當一般功能 spec 列入；(c) 等 spec 定稿再改。
2. **R1**（npm 與 pnpm）：(a) 現在就把 CLAUDE.md、routine-checklist、backlog R1 改成 pnpm；(b) 依 spec 的安排留到階段 A 改，CLAUDE.md 先加一句「套件管理器以 spec 為準，階段 A 會切換」；(c) 改回 npm，並修改 spec。
3. **R2**（taskboard 分流）：(a) CLAUDE.md 寫明已登錄 `GAME`，並把 backlog R1 轉成 taskboard 任務；(b) 寫明已登錄，但 R1 留在 backlog 並註明理由；(c) 從 taskboard 移除本 repo，刪掉條件句。
4. **R3**（草稿 spec 的權威性）：(a) 加「草稿 spec 不覆蓋 CLAUDE.md」；(b) 加「spec 一律優先，CLAUDE.md 隨後追上」；(c) 不改。
5. **R4**（taskboard 不安裝依賴）：(a) 骨架完成後設定 `setupCommand` 並決定網路策略；(b) 現在就設定；(c) 不派工到 taskboard，不改。
6. **R5、R6**（workflow 的依賴安裝與空 DoD）：(a) 都修 `implement-layer.js`（加 setup 參數與非空檢查）；(b) 只修空 DoD 檢查；(c) 不改（這是範本檔，改上游 studio-devops）。
7. **R7**（push 只靠文字）：(a) 加 `.claude/settings.json` 的 deny `Bash(git push:*)`；(b) 加 hook 擋 push 到 main；(c) 保留並註明理由。
8. **R8**（模型選擇）：(a) args 支援每個任務各自覆寫 model；(b) CLAUDE.md 註明 workflow 以 `args.models` 為準；(c) 不改。

## 5. 未能查證

- `CLAUDE.md:87`「`/config` 的 Dynamic workflow size」：headless 環境看不到設定值。
- taskboard 實際如何使用 `setupCommand`、離線時如何取得依賴：只看了專案設定，沒看 taskboard 原始碼。
- 內建審查讀不到 `~/.claude/` 下的 skills／commands（`repo-governance`、`taskboard-project-add`），也沒讀 settings。
- `studio-devops` 腳本路徑在 repo 外，內建審查沒查；本指令實際執行成功。

## 已套用

（尚無）
