# 例行盤點規範（Routine Audit）

> 目的：以固定週期、固定面向、固定證據來源檢視專案健康度，產出「立即修／下一階段／不動延後」三類清單，
> 並與上一輪紀錄比對數字，避免同一個技術債每輪重新發現、每輪重新討論。
> 本檔只放流程、清單與紅燈定義；判斷與排序寫在當次紀錄 `docs/audits/YYYY-MM-DD.md`，不回寫本檔。

## 週期與觸發

- **例行**：每月一次，或每完成一個大案（新模組、契約變更、基礎設施調整）後加做一次。
- **事件觸發**：上線後使用者回報資料不一致；prod 端依賴出現 high 以上漏洞；跨 repo 契約變更；平台面變更；準備上線或開賣前。

## 執行規則

- 在 repo 根目錄、乾淨的主分支（`git status` 無未追蹤的程式碼）。
- 所有指令的實際輸出數字要抄進紀錄，不憑印象；測試檔數／案數以測試框架的 summary 為準，不用 grep 數 `it(`。
- **盤點是唯讀作業，不在盤點回合裡順手修。** 修正另起工作項，報告與 commit 才能一對一可追溯。
- 若要開 worktree 寫紀錄，先開 worktree 再派 agent。

## 執行步驟

1. **先取基線數字**（同一組指令，方便與上一輪比對）：原始碼行數、測試檔數／案數／時間、近 90 天異動熱點、每月 commit 節奏、漏洞與過期依賴、migration 狀態。指令由本 repo 在「基線指令」段固定。
2. **五軸平行掃描**：主 session 統籌，fan out Explore subagent 各掃一軸；每個 prompt 都要求「每項附 檔案:行號、嚴重度 高／中／低、一句話原因與建議，最後給前 5 名，**不得修改檔案**」；文件債務軸另要求「用 grep 驗證是否其實已做」。
3. **抽查核實**：subagent 回報的每個「高」等級項目，統籌者至少用 grep 或實際指令驗證一次再寫進報告。
4. **與上一輪比對**：逐項標記「已解／仍在／新增」。仍在超過兩輪的項目要寫明「為何還沒做」。
5. **分類產出**：固定三類「立即修／下一階段／不動延後」。
6. **回寫**：先整合 `docs/backlog/drafts/` 殘留的草稿，再把要做的項目回寫 `docs/backlog.md`（新增或更新 R 編號）；`docs/CLAUDE.LOG/YYYYMM.md` 記一段「例行盤點」摘要連到紀錄檔。

## 基線指令

```bash
find src \( -name '*.ts' -o -name '*.vue' \) -not -path '*/node_modules/*' | xargs wc -l | tail -1   # 原始碼行數
npm test 2>&1 | tail -6                                                                     # 測試檔數／案數／時間
npm run build 2>&1 | tail -15                                                               # bundle 大小
npm audit --omit=dev | tail -3
npm outdated
git log --since='90 days ago' --name-only --format= | sort | uniq -c | sort -rn | head -15  # 異動熱點
git log --since='12 months ago' --format=%ad --date=format:%Y-%m | sort | uniq -c            # 每月 commit 節奏
```

無資料庫，不查 migration。

## 盤點面向（固定五軸，缺一軸即不算完整盤點）

每軸一張表，欄位固定「查什麼／怎麼查／紅燈」。

### 1. 文件記錄的債務與遺留

| 查什麼 | 怎麼查 | 紅燈 |
|---|---|---|
| backlog 開放項目 | 讀 `docs/backlog.md`，逐條標「已結／開放」 | 開放項目連續兩次盤點沒動、或沒有決策點 |
| agent 開發規範的矛盾與失效引用 | 執行 `/rules-audit`（讀 `docs/audits/prompt-inventory.md` 與所有規範檔） | 任何「直接矛盾」或「失效引用」未在上一輪裁定後處理 |
| spec 與實作漂移 | 逐份讀 `docs/superpowers/specs/`，用 grep 對照 spec 點名的元件、路由、狀態與設定在 `src/` 是否存在且行為一致 | spec 描述的行為在碼中找不到或相反，且沒有對應 backlog 項 |

### 2. 程式碼健康度

| 查什麼 | 怎麼查 | 紅燈 |
|---|---|---|
| 超大檔 | `wc -l $(git ls-files 'src/*.ts' 'src/*.vue')`，看行數最大的幾個 | 單檔超過 400 行 |
| 遊戲規則寫在元件內 | 讀 `.vue` 的 `<script setup>`，看規則計算是否抽成純 TS 模組 | 核心規則只能透過掛載元件才測得到 |
| 吞錯路徑 | `grep -rnE 'catch *(\([^)]*\))? *\{ *\}' src` | 空 catch，或 catch 只 `console.log` 後繼續 |
| 繞過 Vue 直接操作 DOM | `grep -rn -e 'document.querySelector' -e 'document.getElementById' src` | 元件內直接改 DOM 而非走反應式狀態 |

### 3. 測試缺口

| 查什麼 | 怎麼查 | 紅燈 |
|---|---|---|
| 關鍵模組無測試 | 列出 `src/` 的 `.ts` 模組，比對是否有對應 `*.spec.ts`／`*.test.ts` | 遊戲規則或狀態模組沒有任何測試 |
| 測試只測 happy path | 讀核心模組的測試檔，找邊界值與失敗案例 | 核心模組只有成功路徑案例 |

### 4. 相依與建置

| 查什麼 | 怎麼查 | 紅燈 |
|---|---|---|
| 漏洞與過期依賴 | 套件管理器的 audit／outdated 指令 | prod 端 high 以上漏洞 |
| bundle 大小 | `npm run build` 輸出的 chunk 大小（Bootstrap 是否整包引入） | Vite 出現 chunk size 警告，或總量比上輪增加 20% 以上 |
| Wrangler 設定與版本 | 讀 `wrangler.jsonc` 的 `compatibility_date`，`npx wrangler --version` | `compatibility_date` 落後一年以上 |

### 5. 營運與安全

| 查什麼 | 怎麼查 | 紅燈 |
|---|---|---|
| 秘密進 repo | `git grep -nIiE -e 'api[_-]?key *[:=]' -e 'secret *[:=]' -e 'token *[:=]' -e 'password *[:=]'`；`git ls-files '*.dev.vars' '*.env' '.env.*'` | 命中真實值，或 `.dev.vars`／`.env` 被追蹤 |
| 秘密打包進前端 | `grep -rn 'import.meta.env.VITE_' src` | `VITE_` 變數裝了秘密（會進 bundle） |
| 部署設定漂移 | `npx wrangler deployments list` 對照主分支 commit | 線上版本不是來自主分支，或 dashboard 改過設定未回寫 `wrangler.jsonc` |

## 刻意接受清單

目前無。

## 紀錄格式（`docs/audits/YYYY-MM-DD.md`）

1. 基線數字表（與上輪並列）。
2. 五軸發現（每項：檔案:行號、嚴重度、原因、建議、是否已抽查核實）。
3. 與上次比對（已解／仍在／新增）。
4. 三類清單。
5. 本次盤點的踩坑。
