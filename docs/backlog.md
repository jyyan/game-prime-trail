# Backlog

> 待辦、技術債與「之後再做」的清單。盤點、spec、CLAUDE.LOG 提到「之後再做」的事都要回寫到這裡並給編號，不要只留在對話或紀錄裡。
> 若本 repo 已登錄 taskboard：要做的工作項開在 taskboard，本檔只管技術債與「之後再做」；兩邊以任務的 `backlog_ref` ↔ R 編號互連，帶 `backlog_ref` 的任務在任務分支內把對應的 R 移到已結段並寫上任務編號。
> 編號 `R<n>` 遞增、永不重用；結案的項目移到「已結」段並留一行結果與 commit。
> 分支內不改本檔：新增與結案寫 `docs/backlog/drafts/<分支或任務編號>.md`，兩段 `## 新增`（不給編號：`- 【類別・等級】標題：內文`）與 `## 結案`（`- R<n>：結案說明`）；主 session 合併時整合進本檔（發編號、移已結）並刪草稿，R 編號只由主 session 發。

## 開放

- **R3 Sass `@import` 棄用警告**【技術債・低】：Bootstrap 5.3 的 SCSS 仍用 `@import`，`pnpm build` 會印大量 Sass deprecation 警告。等 Bootstrap 改用 `@use` 後升級，或在 vite 的 `css.preprocessorOptions.scss` 設 `silenceDeprecations: ['import']`（改 A1 的設定檔，需另開任務）。來源 GAME-2。
- **R4 TypeScript 釘在 `~6.0.3`**【技術債・低】：vue-tsc 3.3.13 與 TS 7 不相容（`typescript/lib/tsc` 未匯出）。vue-tsc 支援 TS 7 後升級 TypeScript，改 `package.json` 與 lockfile。來源 GAME-2。
- **R5 `allowBuilds` 的 `core-js` 核准**【流程・中】：只為讓 install 不報錯；若要收緊，改成 `core-js: false` 並確認 `--frozen-lockfile` 仍能通過。來源 GAME-2。
- **R6 generator 版本字串應涵蓋 solver 剪枝行為**【文件・低】：節點數取決於剪枝強度（B3 已把 §5.4.2 換成較強的排序匹配形式），而 `EASY_BUDGET`／`ADV_BUDGET`／`CHAL_BUDGET` 與挑戰 `c` 值都以節點計，題庫凍結後改 solver 剪枝或候選排序，同一 seed 生成的題面與 `c` 可能改變。spec §4 應補「改 `src/core/solver.ts` 的搜尋行為也要升 generator 版本」，C1 實作 generator 字串時一併處理。來源 GAME-5。
- **R7 spec §2.8 等價敘述漏前提**【文件・低】：「1–5 等價於 findConflicts 為空且盤面填滿」只在 UI 鎖住 given 格（含龍頭）時成立，四種衝突不涵蓋條件 2（`grid[start] = 1`）與條件 5（given 一致）。`isSolved` 已直接檢查五條；spec 應補前提，C3 `useGame` 過關判斷須用 `isSolved`。來源 GAME-4。

## 已結

- **R1 建立專案骨架與測試骨架**：2026-10-24 由 taskboard GAME-2（plan Task A1）完成，commit 58338e8（合併見同日 merge commit）。DoD 三條指令可執行，測試 5 檔 29 案。
- **R2 設定 taskboard 的 setupCommand 與網路策略**：2026-10-24 GAME-2 合併後設定 `setupCommand=pnpm install --frozen-lockfile`、`networkAllowed=true`（使用者同意開網路，不另備 pnpm store 快取）。
