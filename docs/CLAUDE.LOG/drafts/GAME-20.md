## 2026-10-25 GAME-20（E2）部署設定驗證與部署手冊（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §11、§12.3 第 7 項）

- **起因**：plan Task E2。部署前要先確認 `wrangler.jsonc` 能讓 SPA 深層路徑直達，並把部署流程寫成手冊，讓人照著跑 `pnpm run deploy`。
- **裁定（使用者）**：無（照 spec 與 plan）。實際 `wrangler deploy` 與 `wrangler login` 由人執行，不在本任務。
- **做法**：
  - `wrangler deploy --dry-run` 第一次就通過，`wrangler.jsonc` 不改（plan 只允許在 dry-run 報錯時才改）。
  - 新增 `public/_headers`。`/assets/*` 設 `immutable` 一年，因為 Vite 產物檔名含內容 hash，內容變了檔名就會變。`/fonts/*` 只快取一天，因為 PDF 子集字型檔名沒有 hash，重新產生後要能更新。`index.html` 不加規則，維持 Static Assets 預設的 `max-age=0, must-revalidate`，新版部署後才會馬上生效。
  - `docs/deploy.md`：前置、步驟（安裝 → DoD → `pnpm test:slow` → `pnpm run deploy`）、為何不用 `pnpm deploy`、部署後驗證清單、兩種回滾方式。`test:slow` 不屬 DoD，但部署發佈的就是這份題庫，所以列為部署前必跑。CLAUDE.md 守門結構的對應修改在禁區內，寫進 backlog 草稿。
- **守門**：dry-run 讀到 dist 18 個檔案。`wrangler dev --port 8789` 下 `/play/500/challenge` 回 200 且含 `<div id="app"`；`/assets/index-*.js` 回 `Cache-Control: public, max-age=31536000, immutable`，`/fonts/pdf-zh.subset.ttf` 回 `max-age=86400`，`/` 回 `max-age=0, must-revalidate`；`/_headers` 回的是 SPA fallback 的 index.html，檔案本身沒有對外提供。DoD：typecheck 通過，`pnpm test` 48 檔 492 案通過、1 skipped，build 成功。沒有新增自動測試（plan 規定以指令驗收）。
- **流程**：layer E workflow，獨立 worktree、分支 `layer-E/E2`，基底 a1b26be。plan 寫 port 8788，因 E1 平行任務占用 8788 與 4173，改用 8789。
- **遺留**：見 `docs/backlog/drafts/GAME-20.md`。
