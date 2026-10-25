## 2026-10-25 SEO／GEO meta 與 OG 形象圖（GAME-30，spec：docs/superpowers/specs/2026-10-25-seo-og.md）

- **起因**：正式站 `index.html` 只有 `<title>`，分享到 LINE／Facebook／X 無預覽，搜尋引擎與 AI 搜尋也拿不到可引用的簡介。
- **裁定（使用者）**：spec 定稿，含規劃者決定（canonical 歸併首頁、sitemap 只列首頁、JPEG、圖不放中文）。
- **做法**：只動靜態資產，不改 Vue。canonical 固定首頁，因為 SPA 只有一份 HTML，`/play/<id>/<難度>` 共 3000 個網址內容相近，歸併可避免稀薄重複頁。OG 圖用 JPEG，因 LINE／舊 Facebook 爬蟲對 WebP 不保險；圖上不放中文，因 AI 產圖的中文易錯字。og:image／canonical／sitemap／robots 一律絕對網址，爬蟲不解析相對路徑。`llms.txt` 只寫主 spec 已有的事實，不編造。
- **守門**：新增 `src/__tests__/index-meta.test.ts`（8 案）：description、canonical、OG、twitter:card、JSON-LD 可解析、既有 meta 保留、三個靜態檔、全文不含 Hidato／Numbrix（反目標）。
- **流程**：單任務，worktree 單 agent，分支 `task/GAME-30`。
- **踩坑**：無。
- **遺留**：部署後人工用 Facebook Sharing Debugger／opengraph.xyz 驗預覽；Search Console 驗證需人操作。
