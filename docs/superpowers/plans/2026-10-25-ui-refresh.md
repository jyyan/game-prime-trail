# Prime Trail UI／UX 優化（活潑遊戲風）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依 `docs/superpowers/specs/2026-10-25-ui-refresh.md` 把首頁、遊戲頁、過關視窗改成活潑遊戲風，並修正操作流程問題（頂列回首頁、操作列分主次、移除重複控制、下一個數字提示、首頁空白不報錯）。

**Architecture:** 層 U-A 一個殘樁任務放好所有共用檔：設計 token 與 Bootstrap 覆寫（`main.scss`）、棋盤配色（`board.scss`、`BoardCell`）、字型依賴、插圖與 favicon。層 U-B 三個任務各自只動自己的頁面／元件與自己的 i18n 命名空間：遊戲頁（含既有 e2e 的修改）、首頁、過關視窗。

**Tech Stack:** Vue 3 + TypeScript + Vite + Bootstrap 5（SCSS）、`@fontsource/fredoka`、Vitest + @vue/test-utils、Playwright。

**Spec:** `docs/superpowers/specs/2026-10-25-ui-refresh.md`（上位：`docs/superpowers/specs/2026-10-24-prime-trail-design.md`）

## Global Constraints

- 只動各任務 Files 清單內的檔案；`src/core/**`、`src/composables/**`（除非任務明列）、`src/data/**`、`src/pdf/**`、`scripts/**`、路由一律不碰。
- 顏色一律引用 spec §3 的 CSS 自訂屬性，不在元件寫死色碼。
- 所有前景／背景成對顏色對比 ≥ 4.5:1（大字 ≥ 3:1），由 U-A1 的對比腳本驗證。
- 新動畫時長 150–300ms、ease-out，`prefers-reduced-motion: reduce` 時停用。
- 觸控目標 ≥ 44×44px、間距 ≥ 8px。
- CJK 字串只能放 `src/i18n/zh-TW/<ns>.ts`（守門測試會擋）；插圖 `alt` 也走 i18n。
- 既有 `data-*` 測試鉤子語意不變；spec §4.2 移除的 `data-action="toggleMode"`、`data-action="clear"`（操作列）由 U-B1 一併更新所有引用。
- 題庫 `src/data/levels*` 已凍結，不得改；遇 `levels.json not found` 先刪 `node_modules/.vitest-cache`（backlog R37）。
- 日誌與 backlog 草稿寫 `docs/CLAUDE.LOG/drafts/GAME-<n>.md`、`docs/backlog/drafts/GAME-<n>.md`。

## Review Focus

1. 「更多」選單的鍵盤與焦點：Enter 開、Esc 關、點外面關、關閉後焦點回觸發鈕、選單開著時棋盤不收鍵盤事件（U-B1 補 e2e）。
2. 頂列「首頁」離開時未存檔的最後一步不能遺失（usePlaySession 的 pagehide/debounce 只在 unload 觸發，路由離開要靠元件卸載時 flush；U-B1 補 e2e：填一格立刻按首頁，再按繼續上次，格子在）。
3. 質數格改黃後衝突紅與玩家藍數字在黃底上的對比（U-A1 對比腳本必含這兩組）。
4. 首頁空白欄位：按開始停用且無錯誤字；輸入非法值 blur 後才出現錯誤（U-B2 補單元測試與 e2e）。
5. 指定模式 pending 從 NumberPad 移到資訊列後，輸入 1→0→0 顯示 `100`、超過 100 的鍵被拒時仍有回饋（U-B1 補測試）。

---

## 工作流與相依

| 層 | 任務 | 相依 |
|---|---|---|
| U-A | U-A1 | 無 |
| U-B | U-B1、U-B2、U-B3 | U-A |

同層任務彼此獨立、**只動自己清單內的檔案，且各任務的 Files 清單兩兩不相交**。每層最後由主 session 在主 checkout 合併、跑完整 DoD 與 `pnpm test:e2e`、併入草稿。

---

## 層 U-A

### Task U-A1: 設計 token、棋盤配色、字型與插圖資產（殘樁）

**Files:**
- Modify: `package.json`、`pnpm-lock.yaml`（新增 `@fontsource/fredoka`）、`src/styles/main.scss`（token、Bootstrap 變數覆寫、Fredoka 匯入、全域按鈕回彈與 reduced-motion）、`src/styles/board.scss`（龍頭藍、質數黃、`is-filled` 藍字、`:focus-visible`、外框黏土陰影、shake 的 reduced-motion）、`src/components/board/BoardCell.vue`（`is-filled` class）、`index.html`（favicon、apple-touch-icon、`theme-color`）
- Create: `public/illustrations/hero.webp`、`public/illustrations/win.webp`、`public/illustrations/missing.webp`、`public/favicon.png`（64px）、`public/apple-touch-icon.png`（180px）、`docs/design/illustrations/`（`prompt.md` 與原始 PNG）、`scripts/check-contrast.ts`（對比檢查腳本，`pnpm exec tsx scripts/check-contrast.ts` 執行）
- Test: `src/components/board/__tests__/BoardCell.test.ts`（補 `is-filled`）

**禁區：** `src/views/**`、`src/components/**`（除 `BoardCell.vue`）、`src/i18n/**`、`src/composables/**`、`src/core/**`、`src/data/**`、`src/pdf/**`、`e2e/**`、`scripts/gen-*`、`scripts/lib/**`

**Interfaces:**
- Produces：spec §3 全部 CSS 自訂屬性（`--pt-bg` … `--pt-font-num`）；`.pt-cell.is-filled`；插圖路徑 `/illustrations/{hero,win,missing}.webp`（固定寬高：hero 1600×1000、win／missing 1000×1000）；`.pt-press` 可選 utility（若全域 `.btn` 已有回彈則不需）。

**驗收指令：**
- `pnpm exec tsx scripts/check-contrast.ts`（列出每組前景／背景與比值，全部 ≥ 4.5:1 或標明大字 ≥ 3:1，非零退出碼表示失敗）
- `ls -la public/illustrations/`（hero ≤ 120 KB、其餘 ≤ 80 KB）
- `pnpm test:e2e`（配色改動不得弄壞既有情境）
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 對比腳本輸出、375 px 與 1280 px 遊戲頁截圖（scratchpad，不 commit），草稿 `drafts/GAME-<n>.md`。

- [ ] Step 1: BoardCell `is-filled` 失敗測試
- [ ] Step 2: 跑測試確認失敗
- [ ] Step 3: token、Bootstrap 覆寫、Fredoka、棋盤配色、插圖壓 webp、favicon、對比腳本
- [ ] Step 4: 跑驗收全部通過
- [ ] Step 5: Commit

---

## 層 U-B

### Task U-B1: 遊戲頁（頂列、操作列分主次與「更多」選單、資訊列下一個數字、pending 移入資訊列）

**Files:**
- Modify: `src/views/PlayView.vue`、`src/components/game/PlayActions.vue`、`src/components/ui/StatusBar.vue`、`src/components/input/NumberPad.vue`、`src/i18n/zh-TW/play.ts`、`src/i18n/zh-TW/status.ts`、`src/i18n/zh-TW/input.ts`、`e2e/helpers.ts`、`e2e/01-main-flow.spec.ts`…`e2e/10-small-screen.spec.ts`（只改受 §4.2 影響的步驟）
- Create: `e2e/11-play-ui.spec.ts`
- Test: `src/views/__tests__/PlayView.test.ts`、`src/components/__tests__/StatusBar.test.ts`、`src/components/__tests__/NumberPad.test.ts`、新增 `src/components/game/__tests__/PlayActions.test.ts`

**禁區：** `src/styles/**`、`src/views/HomeView.vue`、`src/components/picker/**`、`src/components/game/WinModal.vue`、`src/components/board/**`、`src/composables/**`（只 import）、其他 i18n 命名空間、`e2e/12-*`

**Interfaces:**
- Consumes：U-A1 token、`/illustrations/missing.webp`；`usePlaySession` 現有介面（`game.head`、`state.pending`、`onClear`…）。
- Produces：`StatusBar` props 改為 `{ steps: number; assisted: boolean; mode: InputMode; next: number | null; pending: string }`（地圖／難度／計時移到頂列）；`PlayActions` emits `undo/hint/viewSolution/exportPdf/restart`（移除 `clear` 與 `update:inputMode`）；頂列 `data-action="home"`、選單觸發 `data-action="more"`。

**驗收指令：**
- `pnpm vitest run src/views/__tests__/PlayView.test.ts src/components/__tests__/StatusBar.test.ts src/components/__tests__/NumberPad.test.ts src/components/game/__tests__/PlayActions.test.ts`
- `pnpm test:e2e`（含新 11；Review Focus 1、2、5）
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 375／1280 px 遊戲中、指定模式、更多選單展開截圖（scratchpad）；草稿。

### Task U-B2: 首頁（hero、規則卡、難度說明、空白不報錯、找不到題庫插圖）

**Files:**
- Modify: `src/views/HomeView.vue`、`src/components/picker/LevelPicker.vue`、`src/components/picker/DifficultyPicker.vue`、`src/i18n/zh-TW/home.ts`、`src/i18n/zh-TW/picker.ts`
- Create: `e2e/12-home-ui.spec.ts`
- Test: `src/views/__tests__/HomeView.test.ts`、`src/components/__tests__/LevelPicker.test.ts`、`src/components/__tests__/DifficultyPicker.test.ts`

**禁區：** `src/styles/**`、`src/views/PlayView.vue`、`src/components/game/**`、`src/components/ui/**`、`src/components/input/**`、`src/components/board/**`、`src/composables/**`（只 import `storage.ts` 讀寫 `prime-trail:v1:ui`）、其他 i18n 命名空間、`e2e/` 既有檔與 `e2e/11-*`

**Interfaces:**
- Consumes：U-A1 token、`/illustrations/hero.webp`、`/illustrations/missing.webp`。
- Produces：規則卡收合狀態 key `prime-trail:v1:ui` 的 `{ rulesCollapsed: boolean }`；`LevelPicker` 錯誤字只在「有值且非法、且已 blur 或按過開始」時出現（R30 結案）。

**驗收指令：**
- `pnpm vitest run src/views/__tests__/HomeView.test.ts src/components/__tests__/LevelPicker.test.ts src/components/__tests__/DifficultyPicker.test.ts`
- `pnpm test:e2e`（含新 12；Review Focus 4）
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 375／1280 px 首頁截圖（空白、已選、題庫缺檔狀態）；草稿。

### Task U-B3: 過關視窗（插圖、大字成績、按鈕主次）

**Files:**
- Modify: `src/components/game/WinModal.vue`、`src/i18n/zh-TW/win.ts`
- Test: `src/components/__tests__/WinModal.test.ts`

**禁區：** 其他所有 `src/**`、`e2e/**`、其他 i18n 命名空間

**Interfaces:**
- Consumes：U-A1 token、`/illustrations/win.webp`；`WinModal` 既有 props／emits 不變（`data-action`、`data-new-best` 鉤子保留）。

**驗收指令：**
- `pnpm vitest run src/components/__tests__/WinModal.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 375／1280 px 過關視窗截圖；草稿。

---

## 轉成 `implement-layer` 的 args

照 `docs/superpowers/plan-template.md` 末段格式，存 `docs/superpowers/plans/2026-10-25-ui-refresh.layer-U-A.json`、`…layer-U-B.json`。
