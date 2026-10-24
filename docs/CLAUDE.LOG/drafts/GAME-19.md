## 2026-10-25 E1 Playwright E2E 九情境（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §12.3）

- **起因**：GAME-19 / plan Task E1。D 層把 PlayView、HomeView 與 E2E 鉤子接好後，要用真瀏覽器把 spec §12.3 的情境 1–8（含 5b）跑一遍，作為合併前的人工閘門（不屬 DoD）。
- **裁定（使用者）**：無新裁定；沿用 spec §7.3 的「過關即鎖盤」「pending 不因換格或切模式清空」與 §8「還有 n 格有錯的 n 是紅格數」，本任務的情境沒有直接驗這三條。
- **做法**：
  - `playwright.config.ts` 用兩個 webServer：`VITE_E2E=1 pnpm dev --port 4173 --strictPort` 給 desktop／mobile project；`pnpm build && wrangler dev --port 8788` 給新加的 `wrangler` project（`testMatch: 07-*`），驗 production build 的 `not_found_handling`。加 `--strictPort`，port 被占時直接失敗，不會悄悄換 port 打到別人的 server。
  - `e2e/helpers.ts`：`openPlay`、`fillByTrail(page, id, upTo, maxCells)`（照 `solutionOf` 依序點格、跳過 given，每點一格都等格子顯示正確數字再點下一格）、`readRecords`、`readProgress`，以及 `confirmDialog`／`confirmOk`／`dismissToasts`。等待一律用 `ready()`、web-first assertion 與 `expect.poll`，不用固定 sleep。
  - 情境的關卡選擇：02（重複數字）與 03、08 用第 1 關挑戰難度，因為挑戰只有 1 是 given，可以挑格子讓衝突只剩想驗的那一種（02 把 12 填在參考解 12 與 14 的格：都是偶數、非質數、奇偶對，也沒有相鄰數字，所以紅格恰好兩個）。01、04、05、06 用簡單難度，填滿的點擊次數最少。
  - 01 的「時間非 00:00」：最後一格之前先等狀態列離開 `00:00` 再點，不靠填格速度碰運氣。
  - 03 用 CDP `Input.dispatchTouchEvent` 送真的觸控事件（瀏覽器會套用 `touch-action` 與 pointer capture），而不是合成 `pointermove`；每格分四次移動，並在拖曳中途逐格記 `scrollY`。只在 mobile project 跑，desktop 跳過。
  - 08 的非法方向：先往 2 的方向延伸一格，再按反方向（目標是已填的 1 格），驗格數不變且 1 格出現 `.is-shake`、之後消失。
  - 頁面上有三處 `[data-mode]`（棋盤、InputModeToggle、PlayActions），helpers 以 `button[data-mode=...]` 指 InputModeToggle；確認框可能疊在 PDF 對話框上，以「含 `[data-confirm="ok"]` 的 `.modal`」定位。
  - `tsconfig.node.json` 的 lib 沒有 DOM，helpers.ts 以 `/// <reference lib="dom" />` 取得 `page.evaluate` 內 `window` 的型別，並在 helpers 內宣告 `window.__primeTrail`，不改 tsconfig。
- **守門**：`pnpm test:e2e` 21 案：desktop 9 passed（03 依設計 skipped）、mobile 10 passed（含 03）、wrangler 1 passed，合計 20 passed、1 skipped（各含既有的 smoke 1 案）；`--repeat-each=3` 共 63 案（60 passed、3 skipped），沒有 flaky。DoD 三條全綠。
- **flaky 處理**：唯一遇到的失敗不是 flaky，是 06 的 locator 太寬（確認框與 PDF 對話框同時存在，`.modal` 命中兩個），改成 `confirmDialog()` 後穩定。
- **流程**：單一 agent 在 worktree 分支 `layer-E/E1` 實作，一個 commit。
