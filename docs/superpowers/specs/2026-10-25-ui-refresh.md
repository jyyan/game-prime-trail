# Prime Trail UI／UX 優化（活潑遊戲風）設計

- 狀態：**定稿**（使用者 2026-10-25 確認範圍、視覺方向、配色、字型、插圖與實作計畫）
- 日期：2026-10-25
- 依據：ui-ux-pro-max 檢查（截圖與清單見 CLAUDE.LOG 2026-10-25 段）、使用者裁定
- 上位文件：`docs/superpowers/specs/2026-10-24-prime-trail-design.md`（下稱「主 spec」）。本文定稿後，主 spec §9 的顏色、§9 的操作列組成與第 14 行「質數格以灰底標示」一併改寫。

## 1. 使用者裁定（2026-10-25）

| # | 項目 | 裁定 |
|---|---|---|
| U1 | 範圍 | A 操作流程 ＋ B 視覺與回饋；C（深色模式、reduced-motion 全面檢查）不在本輪，但新加的動畫一律尊重 `prefers-reduced-motion` |
| U2 | 視覺方向 | 活潑遊戲風（接近 claymorphism：大圓角、柔和雙層陰影、按下回彈），但對比一律 ≥ 4.5:1 |
| U3 | 棋盤配色 | 質數格改柔和色、龍頭格改吉祥物藍；PDF 維持灰階不變 |
| U4 | 字型 | 引入 Fredoka（`@fontsource`，本地打包），只用於數字、計時、英文標題；中文走系統字型 |
| U5 | 插圖 | 以 codex 生成吉祥物「小龍」插圖：首頁 hero、過關、找不到地圖、App icon（候選稿待使用者挑選） |

## 2. 不做的事

- 不改遊戲規則、題庫、存檔格式、路由、PDF 版面。
- 不做深色模式；不重寫 Bootstrap，仍以 Bootstrap 為基底加 token 與覆寫。
- 不改 `data-*` 測試鉤子的語意；需要移除的鉤子（見 §4.2）在同一任務內更新所有引用它的測試。

## 3. 設計 token

全站以 CSS 自訂屬性定義在 `src/styles/main.scss` 的 `:root`，元件只引用 token，不寫死色碼（棋盤 PDF 除外）。

| token | 值 | 用途 |
|---|---|---|
| `--pt-bg` | `#EFF6FF` | 頁面背景 |
| `--pt-surface` | `#FFFFFF` | 卡片、對話框 |
| `--pt-text` | `#1E293B` | 主文字 |
| `--pt-text-muted` | `#475569` | 次要文字（對白底 ≥ 4.5:1） |
| `--pt-primary` | `#2563EB` | 主按鈕、吉祥物藍、龍頭格 |
| `--pt-primary-strong` | `#1D4ED8` | 玩家填入的數字、主按鈕 hover |
| `--pt-accent` | `#F59E0B` | 強調（星星、計時強調） |
| `--pt-pink` | `#EC4899` | 慶祝、徽章 |
| `--pt-success` | `#10B981` | 完成標記 |
| `--pt-danger` | `#B91C1C` | 衝突、破壞性動作（比 Bootstrap danger 深，才能在質數格底色上達 4.5:1） |
| `--pt-prime` | `#FDE68A` | 質數格底色（柔和黃） |
| `--pt-radius-card` | `20px` | 卡片、對話框 |
| `--pt-radius-btn` | `14px` | 按鈕 |
| `--pt-shadow-clay` | `0 6px 0 rgba(30,41,59,.08), 0 10px 24px rgba(37,99,235,.12), inset 0 -3px 0 rgba(30,41,59,.06)` | 卡片與按鈕的黏土感陰影 |
| `--pt-press-scale` | `.96` | 按下回彈 |
| `--pt-dur` | `180ms` | 微互動時長（ease-out） |
| `--pt-font-num` | `'Fredoka', system-ui, sans-serif` | 數字、計時、英文標題 |

- Bootstrap 變數覆寫：`$primary: #2563EB`、`$danger: #B91C1C`、`$border-radius: 14px`、`$border-radius-lg: 20px`、`$body-bg: #EFF6FF`、`$body-color: #1E293B`、`$font-size-base` 不變（16px）。
- 所有成對前景／背景在實作時以腳本驗對比 ≥ 4.5:1（大字 ≥ 3:1），結果寫進 CLAUDE.LOG。
- `@media (prefers-reduced-motion: reduce)`：按下回彈、棋盤 shake、過關插圖動畫一律停用（shake 改成僅閃一次紅框）。

## 4. 操作流程（A）

### 4.1 遊戲頁頂列（新）

棋盤上方加一條頂列：左側「← 首頁」按鈕（`data-action="home"`，回 `/`，進行中的局照常自動存檔）、中間「地圖 #0007・簡單」、右側計時。頂列取代現有 StatusBar 的地圖／難度部分；StatusBar 改為棋盤下方的資訊列（見 4.3）。

### 4.2 操作列分主次、移除重複

- 移除操作列的「改用指定模式」（`data-action="toggleMode"`）：模式切換只保留 InputModeToggle。
- 移除操作列的「清除」（`data-action="clear"`）：接續模式下它等於「復原」，指定模式下等於數字鍵盤的「清除」，兩處重複（backlog R33 一併結案）。
- 主要列（外露）：「復原」「提示」。
- 「更多」選單（`data-action="more"`，點開為小型彈出清單，Esc 或點外面關閉）：「看解答」「匯出 PDF」「重新開始」；重新開始以危險色並與前兩項分隔。原 `data-action="viewSolution"／"exportPdf"／"restart"` 保留在選單項目上。
- 所有按鈕高度 ≥ 44px、間距 ≥ 8px；按下有 `--pt-press-scale` 回彈。

### 4.3 下一個數字提示

接續模式時資訊列顯示「下一個：n」（n = head + 1，跳過 given 時同樣顯示 head + 1；head = 100 時不顯示），以 Fredoka 大字呈現；指定模式時改顯示輸入中的 pending（取代目前沒有標籤的輸入框）。步數與輔助徽章留在資訊列。

### 4.4 首頁空白不報錯（取代主 spec 對 R30 的現狀）

地圖編號欄位為空時「開始」停用，但不顯示紅框與錯誤字；欄位有值且不在 1…count 時才顯示錯誤（輸入後 blur 或按開始時）。backlog R30 結案。

## 5. 視覺與回饋（B）

### 5.1 棋盤

- 龍頭格 `--pt-primary` 底、白字；質數格 `--pt-prime` 底、`--pt-text` 字；白格 `#fff`。
- given 數字 `--pt-text`、600 字重；玩家填入的數字 `--pt-primary-strong`、500 字重（BoardCell 加 `is-filled` class：有值且非 given）。
- 衝突：`--pt-danger` 邊框 ＋ 底線（不只靠顏色，沿用主 spec）。
- 焦點框：只在 `:focus-visible` 時顯示（目前載入即顯示一圈藍框）。
- 棋盤外框帶加 `--pt-radius-card` 圓角與 `--pt-shadow-clay`，像一塊放在桌上的木板。

### 5.2 首頁

- 頂部 hero：吉祥物插圖（`hero.webp`）＋「Prime Trail」Fredoka 標題＋一句副標。
- 規則卡（可收合，預設展開一次後記住收合狀態於 localStorage `prime-trail:v1:ui`）：三條規則（從龍頭 1 出發、上下左右相鄰依序填到 100、質數只能填在黃色格）。
- 難度按鈕：名稱＋一句說明（簡單：顯示所有質數；進階：只顯示部分質數；挑戰：只有龍頭），完成標記改放右側，左側不留空位。
- 「隨機」改為帶骰子圖示的次要按鈕；主 CTA「開始」只有一個。
- 找不到題庫時顯示 `missing.webp` 插圖與說明。

### 5.3 過關視窗

頂部 `win.webp` 插圖（reduced-motion 以外加一次 300ms 彈入）、時間與步數用 Fredoka 大字、新紀錄徽章用 `--pt-pink`。按鈕主次：「下一張」主按鈕，其餘次要。

### 5.4 插圖資產

- 放 `public/illustrations/`：`hero.webp`（≤ 120 KB）、`win.webp`、`missing.webp`（各 ≤ 80 KB）；`public/favicon.png`、`public/apple-touch-icon.png` 由 `icon.png` 縮出。`<img>` 一律給 `width`／`height` 與中文 `alt`（alt 文字放 i18n）。
- 來源：codex 生成，原檔與 prompt 存 `docs/design/illustrations/`（prompt.md ＋ 原始 PNG 不進 dist）。

## 6. 驗收

- DoD 三條全綠；`pnpm test:e2e` 全綠（所有因 §4.2 移動的按鈕，e2e 改為先開「更多」再點）。
- 新 e2e：頂列「首頁」可回首頁且進度保留；「更多」選單可用鍵盤開關（Enter／Esc）且焦點回到觸發鈕；首頁空白欄位無錯誤字；接續模式「下一個：n」隨填格更新。
- 375 px 與 1280 px 截圖（首頁、遊戲中、指定模式、過關）附在 CLAUDE.LOG。
- 對比腳本輸出全部 ≥ 4.5:1（大字 ≥ 3:1）。
