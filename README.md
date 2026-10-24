# Prime Trail

單人益智網頁遊戲。棋盤為 10×10，從邊緣的「龍頭」（1）出發，沿上下左右相鄰的格子依序填入 1 到 100，每格恰好走一次。灰底的格子是質數格，也是唯一的推理線索。

純前端、無帳號、無後端，部署在 Cloudflare Workers（Static Assets）。

## 玩法

- **規則**：數字 k 與 k+1 必須上下左右相鄰（斜角不算相鄰）；灰底格放質數，白格放非質數。
- **難度**：三種難度共用同一張地圖與同一條參考路徑，差別只在題面先給出多少數字。

  | 難度 | 題面先給的數字 |
  |---|---|
  | 簡單 | 1 ＋ 全部 25 個質數 |
  | 進階 | 1 ＋ 部分質數 |
  | 挑戰 | 只有 1 |

- **輸入模式**：
  - 接續模式：從目前最後一個數字往相鄰空格點擊或拖曳延伸，也可以用方向鍵操作。
  - 指定模式：選一格，再用數字鍵盤輸入 1–100。
- **錯誤回饋**：填錯會即時標紅，但不阻擋操作。標紅的情況有重複數字、前後數字不相鄰、質數與灰底不符、奇偶不符。
- **過關**：盤面填滿且沒有衝突就自動過關。玩家的解不必與參考解相同，只要合法即可。
- **其他功能**：undo、提示下一步、看解答、計時計步、本機最佳紀錄、中途進度自動恢復、匯出向量 PDF（題目頁，可選附解答頁）。

題庫共 1000 張，編號固定、可重現。題庫離線生成後打包進前端，發佈後即凍結。

完整規則與設計細節見 [設計 spec](docs/superpowers/specs/2026-10-24-prime-trail-design.md)。

## 技術棧

- Vue 3 + TypeScript + Vite + vue-router
- Bootstrap 5（npm 安裝、SCSS 匯入），不使用其他 UI 框架與 Pinia
- jsPDF（匯出 PDF，內嵌 Noto Sans TC 子集字型）
- Vitest + `@vue/test-utils` + fast-check；E2E 用 Playwright
- 套件管理器 pnpm（`engine-strict=true`）
- Cloudflare Workers Static Assets（`wrangler.jsonc`）

## 開始開發

```sh
pnpm install
pnpm dev
```

開發伺服器啟動後，首頁可選地圖編號與難度，遊戲頁路由為 `/play/<編號>/<easy|advanced|challenge>`。

> 題庫檔 `src/data/levels.json` 由生成器產生並 commit 進 git。檔案還沒產生時 app 照樣能 build，但遊戲頁會顯示題庫缺失；產生方式見下方「題庫生成」。

## 常用指令

| 指令 | 用途 |
|---|---|
| `pnpm dev` | Vite 開發伺服器 |
| `pnpm typecheck` | `vue-tsc` 檢查 app、`tsc` 檢查 Node 端設定與腳本 |
| `pnpm test` | Vitest 單元與元件測試；單一檔：`pnpm vitest run <路徑>`，單一案例加 `-t "<名稱>"` |
| `pnpm test:slow` | 慢測（題庫完整檢查），發佈前跑 |
| `pnpm test:e2e` | Playwright E2E；首次需 `pnpm exec playwright install chromium` |
| `pnpm build` | 產出 `dist/` |
| `pnpm run deploy` | `pnpm build && wrangler deploy` |
| `pnpm gen:levels` | 離線生成題庫 |
| `pnpm gen:pdf-font` | 重建 PDF 用的中文子集字型 `public/fonts/pdf-zh.subset.ttf` |

完成定義（DoD）：依序跑 `pnpm typecheck`、`pnpm test`、`pnpm build`，三條全綠才算完成。

## 題庫生成

```sh
pnpm gen:levels [--ids 1-1000] [--workers <n>] [--recompute h,c] [--assemble] [--partial]
```

- 生成器用 backbite 演算法產生隨機 Hamiltonian path，再用 solver 檢查簡單難度唯一解、挑選進階提示子集、計算挑戰難度的解數。參數集中在 `scripts/gen-config.ts`，改任何參數都要一併更新 `generator` 版本字串。
- 每完成一張就立刻追加到 `src/data/levels.meta.jsonl`，所以中斷後重跑會從停下的地方接續。
- 1000 張全部到齊並通過驗證後，才組裝出 `src/data/levels.json`（前端載入）與 `src/data/levels.hash.txt`。
- 全量生成要跑很久，適合在本機以多個 worker 執行。

## 部署

```sh
wrangler login          # 首次
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test && pnpm build
pnpm test:slow
pnpm run deploy
```

**一定要寫 `pnpm run deploy`，不能寫 `pnpm deploy`。** `pnpm deploy` 是 pnpm 的內建指令，會蓋掉同名 script。

`wrangler.jsonc` 設定 `not_found_handling: "single-page-application"`，直接開啟 `/play/12/easy` 這類網址時會回 `index.html`，history 模式的路由才能用。專案沒有 Worker 程式碼。

## 專案結構

```
src/
  core/          純 TypeScript 核心：幾何、質數、PRNG、路徑編碼、驗證、solver、生成器（不依賴 Vue）
  composables/   遊戲狀態、計時、紀錄、進度、設定、題庫載入、PDF 匯出等 composable
  components/    棋盤（board）、輸入（input）、選單（picker）、遊戲對話框（game）、Bootstrap 包裝（ui）
  views/         HomeView、PlayView
  pdf/           PDF 版面與字串
  i18n/          UI 字串表與 useI18n()（目前只有 zh-TW）
  data/          題庫 levels.json 與審計檔 levels.meta.jsonl
  styles/        SCSS
scripts/         題庫生成器與 PDF 字型子集腳本
e2e/             Playwright 測試
public/fonts/    PDF 字型子集（OFL 授權）
docs/            spec、plan、backlog、工作日誌、盤點紀錄
```

UI 文字一律放在 `src/i18n/`；有測試會掃描 `src/` 其餘檔案，出現中文字元就失敗。

## 文件

- 設計 spec：[docs/superpowers/specs/2026-10-24-prime-trail-design.md](docs/superpowers/specs/2026-10-24-prime-trail-design.md)
- 實作計畫：[docs/superpowers/plans/2026-10-24-prime-trail.md](docs/superpowers/plans/2026-10-24-prime-trail.md)
- 技術債與之後再做：[docs/backlog.md](docs/backlog.md)
- 工作日誌：[docs/CLAUDE.LOG/](docs/CLAUDE.LOG/)
- 開發流程與 agent 治理：[CLAUDE.md](CLAUDE.md)、[docs/superpowers/repo-governance.md](docs/superpowers/repo-governance.md)

## 授權

PDF 字型子集取自 Noto Sans TC，依 SIL Open Font License 授權，全文見 [public/fonts/OFL.txt](public/fonts/OFL.txt)。
