# 部署手冊

Prime Trail 是純前端 SPA，以 Cloudflare Workers Static Assets 發佈 `dist/`，沒有 Worker 程式碼（`wrangler.jsonc` 不設 `main`）。設定依據：spec `docs/superpowers/specs/2026-10-24-prime-trail-design.md` §11（部署）。

實際 `wrangler deploy` 由人在終端機執行，agent 不執行。

## 設定一覽

| 檔案 | 作用 |
|---|---|
| `wrangler.jsonc` | Worker 名稱 `prime-trail`、`assets.directory: ./dist`、`not_found_handling: single-page-application`。最後一項讓 `/play/500/challenge` 這類深層路徑回傳 `index.html`（200），交給 vue-router 處理 |
| `public/_headers` | Vite 複製到 `dist/_headers`，由 Static Assets 套用。`/assets/*` 檔名含內容 hash，設 `public, max-age=31536000, immutable`；`/fonts/*`（PDF 子集字型，檔名無 hash）設 `max-age=86400`，重新產生字型後一天內生效 |

`_headers` 本身不會被當成靜態檔對外提供。

## 前置（首次）

1. 安裝依賴：`pnpm install --frozen-lockfile`
2. 登入 Cloudflare：`pnpm exec wrangler login`（瀏覽器授權一次；`pnpm exec wrangler whoami` 可確認帳號）

## 步驟

在 repo 根目錄、主分支、工作區乾淨的狀態下依序執行，任一步失敗就停：

1. `pnpm install --frozen-lockfile`
2. DoD 三條：
   1. `pnpm typecheck`
   2. `pnpm test`
   3. `pnpm build`
3. `pnpm test:slow`（題庫唯一性、可重現、解檢查；約 1–2 分鐘。不屬 DoD，但部署前必跑，因為部署發佈的就是這份題庫）
4. （可選）`pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry-run`：只檢查設定與列出 assets，不上傳
5. `pnpm run deploy`（= `pnpm build && wrangler deploy`）

若 vitest 報 `levels.json not found`，刪掉 `node_modules/.vitest-cache` 再跑（backlog R37：vitest 快取對 `import.meta.glob` 新增檔不失效）。

### 為什麼是 `pnpm run deploy` 而不是 `pnpm deploy`

`pnpm deploy` 是 pnpm 的內建指令（把 workspace 套件部署到目錄），會蓋掉 `package.json` 裡同名的 script，執行的不是我們的部署流程。一律寫 `pnpm run deploy`。

## 部署後驗證清單

以 `wrangler deploy` 輸出的網址（`https://prime-trail.<子網域>.workers.dev` 或自訂網域）為 `$URL`：

- [ ] **首頁**：開 `$URL/`，題庫載入後出現關卡選擇與難度選擇
- [ ] **SPA 直達**：直接開 `$URL/play/500/challenge`（不從首頁點進）能進入第 500 關挑戰難度；`curl -s -o /dev/null -w '%{http_code}' $URL/play/500/challenge` 為 `200`
- [ ] **PDF 字型**：任一關匯出 PDF，標籤為中文（字型載入失敗時會退成英文標籤並跳 toast）；DevTools Network 看到 `/fonts/pdf-zh.subset.ttf` 為 200
- [ ] **Cache header**：`curl -sI $URL/assets/<任一檔名>` 含 `cache-control: public, max-age=31536000, immutable`；`curl -sI $URL/` 不含 `immutable`（`index.html` 不可長期快取，否則新版不生效）
- [ ] **主控台**：首頁與遊戲頁 console 無錯誤

本機可先用 `pnpm exec wrangler dev` 驗 SPA fallback 與 header（它以 `dist/` 模擬 Static Assets，須先 `pnpm build`）。

## 回滾

兩種方式擇一：

1. **Cloudflare 版本回滾（最快，不需重 build）**
   1. `pnpm exec wrangler deployments list` 找到上一個正常版本的 Version ID
   2. `pnpm exec wrangler rollback <version-id>`
   3. 照上方驗證清單重驗
2. **重新部署上一個 commit**
   1. `git checkout <上一個正常的 commit>`
   2. `pnpm install --frozen-lockfile`，再跑上面「步驟」的 2–5
   3. 驗證後 `git checkout main`；修正後從主分支重新部署

注意：若回滾前後題庫 `libraryVersion` 不同，localStorage 前綴跟著換（spec §7.5），玩家在另一版題庫下的紀錄與存檔會暫時看不到；資料不會被刪，切回該版即恢復。
