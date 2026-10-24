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
- **R8 BsModal 焦點圈限**【a11y・低】：目前只做開啟移入焦點、關閉歸還、Esc 關閉，Tab／Shift+Tab 仍能跳到背後的頁面元素；之後補 focus trap 或替背景加 `inert`。來源 GAME-8。
- **R9 BsModal／BsConfirmHost 疊層焦點細節**【a11y・低】：(a) 較低層 Modal 先關閉時 teardown 仍無條件歸還焦點，會把焦點從頂層對話框移到背景；應只在頂層關閉時還原並處理失效目標。(b) 新 confirm 取代已顯示的請求時 modelValue 持續為 true，不會重新聚焦取消鈕；應依 `pending.id` 變更重新聚焦。兩者皆為 GAME-8 worker 審查建議，主 session 判定不擋合併。來源 GAME-8。
- **R10 spec §10 i18n 檔案佈局與實作不一致**【文件・低】：spec §10 寫單檔 `src/i18n/zh-TW.ts`、命名空間含 `toast`；plan B5 與實作是 `src/i18n/zh-TW/<ns>.ts` 一命名空間一檔（app/common/difficulty/board/conflict/input/status/picker/win/solution/pdf/play/home），toast 文案放 `play.*`。使用者裁定（2026-10-24）：以實作（plan B5 的佈局）為準，暫不改 spec；後續任務讀到 spec §10 的 i18n 佈局時以實作為準。保留為文件債，日後同步 spec 時結案。來源 GAME-7。
- **R11 進階提示數可能全數卡在 ADV_FLOOR=6**【設計・低】：C1 試跑 id 1–3 的 greedy 結果都是 6 個提示（floor 綁住），進階難度張與張之間沒有提示數差異。D4 跑完看 hintCount 分布；若幾乎全是 6，再決定是否接受或調 floor（調參要升 `generator` 版本字串並重跑）。來源 GAME-9。
- **R12 spec §4.4 的 easy 丟棄率估計偏低**【文件・低】：試跑湊 3 個通過 easy 唯一的候選用了 9–22 次 attempt（丟棄率約 65–85%，spec 估 20–50%）。`maxAttemptsPerLevel = 200` 仍有餘裕，spec §4.4／§4.7 的數字應以 D4 實測更新。來源 GAME-9。
- **R13 `src/data/levels.meta.jsonl` 是否 commit 未定**【流程・低】：它是續跑與 `--recompute` 的依據，也記錄每張的候選與耗時；D4 決定 commit 進 repo 或加進 `.gitignore`。來源 GAME-9。
- **R14 `readMeta` 的 `isRow` 未驗完整 MetaRow**【技術債・低】：`scripts/lib/meta.ts` 只驗部分欄位，缺 `candidates`／`nodes`／`attempt` 等欄位但 JSON 合法的行仍會覆蓋同 id 的有效舊行，續跑會遺失完成紀錄、`--recompute` 可能失敗。應完整驗證並補「壞行不覆蓋有效行」測試。GAME-9 worker 審查建議，主 session 判定不擋合併。來源 GAME-9。
- **R15 `gen-levels.ts` 主流程缺整合測試**【測試・低】：目前測試只打 lib，未涵蓋續跑跳過已完成 id、過期 config 重生、多 worker 與分批輸出一致、`levels.json` 存在時 `--recompute` 退出碼 2。D4 正式跑前補上較穩（用暫存輸出路徑與小預算）。GAME-9 worker 審查建議。來源 GAME-9。
- **R16 題庫雜湊與檔案格式兩處定義**【技術債・低】：C7 的 `src/data/__tests__/helpers.ts`（純 TS `sha256Hex`、`parseHashFile`）與 C1 的 `scripts/lib/assemble.ts`（`sha256Hex`、`writeLevelFiles` 兩行格式）各自實作。應補跨邊界測試斷言兩邊雜湊相同、C1 寫出的 hash 檔能被 `parseHashFile` 解析，或共用 `src/` 下的純 TS 版本。來源 GAME-15。
- **R17 慢測生成參數寫成字面值**【技術債・低】：`src/data/__slow__/*.test.ts` 的 backbite 步數、端點上限、easy／advanced 預算、`ADV_FLOOR`、挑戰預算抄自 `scripts/gen-config.ts`。C1 已合併，應改為 import `GEN_CONFIG`。來源 GAME-15。
- **R18 棋盤 aria-label 未帶衝突種類**【UX・低】：BoardCell 介面只有 `conflict: boolean`，螢幕閱讀器聽不到「數字重複」等原因；要補需擴充 BoardCell props（例如 `conflictKinds`）並使用 `conflict.*` 字串。來源 GAME-10。
- **R19 棋盤拖曳只以 mock `elementFromPoint` 驗證**【測試・低】：jsdom 無版面；實際手機拖曳與 `scrollY` 不變留給 E1 Playwright 情境 3，狀態框線疊加也需在真瀏覽器目視。來源 GAME-10。
- **R20 `GameBoard` 的 `pointerdown` 未檢查 `e.button`**【UX・低】：右鍵、中鍵也會 emit `press` 並開始接續拖曳；spec 未要求，D1 接線或 E1 時再決定是否只接受主鍵。layer-C 審查建議。來源 GAME-10。
- **R21 `useProgress.lastPlayed()` 回傳原始值**【介面・低】：對應 progress 被刪時仍可能指向不存在的存檔；spec §7.5 要求首頁以 `has()` 判斷是否顯示「繼續上次」，D2 HomeView 須照做，或改由 `lastPlayed()` 自行過濾。來源 GAME-12。
- **R22 `useLevelStore.randomId()` 在非 ready 時丟錯**【介面・低】：spec §6.6 說隨機在 1–1000 均勻抽；若 LevelPicker 要在題庫載入前就能抽號，需改為固定 1000 為上界或先 `load()`。D2 接線時處理。來源 GAME-12。
- **R23 C4 測試強度不足**【測試・低】：layer-C 審查指出：`useSettings` 第二次寫入的斷言分不出 watcher 有沒有觸發；`useProgress` 的 `lastPlayed` 淘汰案例恆真、guard（`isSavedProgress`／`isLastPlayed`）沒有壞資料案例；`useRecords`／`useProgress` 的注入 `storage` 寫入失敗路徑沒測；`useLevelStore` 預設 loader 兩案依題庫檔存在與否必有一案 skip。不擋合併，之後補測。來源 GAME-12。
- **R24 PDF 字型來源未釘版本**【可重現性・低】：`scripts/gen-pdf-font.ts` 從 google/fonts `main` 下載 `NotoSansTC[wght].ttf`，上游換版後重跑會得到不同子集。改成釘 commit 的 raw URL 並比對 SHA-256（目前 `864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f`）。來源 GAME-13。
- **R25 子集字型 `name` 表仍寫 `Noto Sans TC Thin`**【整潔・低】：可變字型預設 instance 是 wght=100，harfbuzz 釘 400 時只改外框與 `usWeightClass`。jsPDF 以自訂 family 引用、不影響輸出；要乾淨可改寫 name 表或改用靜態 Regular 來源。來源 GAME-13。
- **R26 spec §6.9 與 PDF 實作介面不一致**【文件・低】：spec 寫 `renderPuzzlePdf({ level, difficulty, includeSolution })`、英文 fallback 在 `en.ts`；實作依 plan C5 為 `{ level, difficulty, includeSolution, labels, font }`、英文標籤在 `src/pdf/labels-en.ts`，i18n `pdf` 新增 `docTitle`、`exportFailed`。spec 該段可同步。來源 GAME-13。
- **R27 C5 測試強度不足**【測試・中】：layer-C 審查指出：`usePdfExport` 沒有成功路徑（字型可用、走中文標籤、不跳 fallback toast）的案例；格子灰階斷言會被圖例的 `setFillColor` 滿足；解答頁未驗路徑順序與折線；龍頭三角形只數次數不驗方位；字型嵌入只驗 `%PDF-` 檔頭與大小。D1 接 PDF 前補較穩。來源 GAME-13。

## 已結

- **R1 建立專案骨架與測試骨架**：2026-10-24 由 taskboard GAME-2（plan Task A1）完成，commit 58338e8（合併見同日 merge commit）。DoD 三條指令可執行，測試 5 檔 29 案。
- **R2 設定 taskboard 的 setupCommand 與網路策略**：2026-10-24 GAME-2 合併後設定 `setupCommand=pnpm install --frozen-lockfile`、`networkAllowed=true`（使用者同意開網路，不另備 pnpm store 快取）。
