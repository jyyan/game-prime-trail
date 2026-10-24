# Backlog

> 待辦、技術債與「之後再做」的清單。盤點、spec、CLAUDE.LOG 提到「之後再做」的事都要回寫到這裡並給編號，不要只留在對話或紀錄裡。
> 若本 repo 已登錄 taskboard：要做的工作項開在 taskboard，本檔只管技術債與「之後再做」；兩邊以任務的 `backlog_ref` ↔ R 編號互連，帶 `backlog_ref` 的任務在任務分支內把對應的 R 移到已結段並寫上任務編號。
> 編號 `R<n>` 遞增、永不重用；結案的項目移到「已結」段並留一行結果與 commit。
> 分支內不改本檔：新增與結案寫 `docs/backlog/drafts/<分支或任務編號>.md`，兩段 `## 新增`（不給編號：`- 【類別・等級】標題：內文`）與 `## 結案`（`- R<n>：結案說明`）；主 session 合併時整合進本檔（發編號、移已結）並刪草稿，R 編號只由主 session 發。

## 開放

- **R1 建立專案骨架與測試骨架**（taskboard `GAME-1`）：技術棧已定為 Vue 3 + TypeScript + Vite + Bootstrap 5、Vitest、pnpm、部署 Cloudflare Workers static assets，但 repo 還沒有任何程式碼，CLAUDE.md 的 DoD 三條指令（`pnpm typecheck`、`pnpm test`、`pnpm build`）與 `pnpm run deploy` 都還不存在。範疇依 spec §13 階段 A。要建立 `package.json` scripts、`vue-tsc`、Vitest + `@vue/test-utils`（至少一個冒煙測試）、`wrangler.jsonc`，並把 `.dev.vars` 寫進 `.gitignore`。前置：先走 brainstorming 產出骨架 spec 並經使用者確認。
- **R2 設定 taskboard 的 setupCommand 與網路策略**：taskboard 專案 `game-prime-trail` 目前 `setupCommand` 為空、`networkAllowed=false`，派工 worktree 沒有 `node_modules`，也無法下載依賴，DoD 必失敗（rules-audit 2026-10-24 R4，裁定 a：骨架完成後再設）。`GAME-1` 合併、lockfile 進 repo 後，把 `setupCommand` 設成 `pnpm install --frozen-lockfile`，並決定網路策略：開 `networkAllowed`，或預先準備 pnpm store 快取。`GAME-1` 本身要新增依賴、必須連網，所以不能走 taskboard 派工，要由主 session 開 worktree 派 subagent 執行。

## 已結

<!-- 範例：- **R0 範本安裝**：2026-10-09 完成，commit abc1234。 -->
