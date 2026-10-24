# Backlog

> 待辦、技術債與「之後再做」的清單。盤點、spec、CLAUDE.LOG 提到「之後再做」的事都要回寫到這裡並給編號，不要只留在對話或紀錄裡。
> 若本 repo 已登錄 taskboard：要做的工作項開在 taskboard，本檔只管技術債與「之後再做」；兩邊以任務的 `backlog_ref` ↔ R 編號互連，帶 `backlog_ref` 的任務在任務分支內把對應的 R 移到已結段並寫上任務編號。
> 編號 `R<n>` 遞增、永不重用；結案的項目移到「已結」段並留一行結果與 commit。
> 分支內不改本檔：新增與結案寫 `docs/backlog/drafts/<分支或任務編號>.md`，兩段 `## 新增`（不給編號：`- 【類別・等級】標題：內文`）與 `## 結案`（`- R<n>：結案說明`）；主 session 合併時整合進本檔（發編號、移已結）並刪草稿，R 編號只由主 session 發。

## 開放

- **R1 建立專案骨架與測試骨架**：技術棧已定為 Vue 3 + TypeScript + Vite + Bootstrap 5、Vitest、部署 Cloudflare Workers static assets，但 repo 還沒有任何程式碼，CLAUDE.md 的 DoD 三條指令（`npm run typecheck`、`npm test`、`npm run build`）與 `npm run deploy` 都還不存在。要建立 `package.json` scripts、`vue-tsc`、Vitest + `@vue/test-utils`（至少一個冒煙測試）、`wrangler.jsonc`，並把 `.dev.vars` 寫進 `.gitignore`。前置：先走 brainstorming 產出骨架 spec 並經使用者確認。

## 已結

<!-- 範例：- **R0 範本安裝**：2026-10-09 完成，commit abc1234。 -->
