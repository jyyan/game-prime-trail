# Prime Trail v1 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出可部署到 Cloudflare Workers Static Assets 的 Prime Trail v1：10×10 質數路徑益智遊戲，1000 張離線生成的凍結題庫、三難度、兩種輸入模式、即時衝突標示、進度恢復、本機紀錄、PDF 匯出。

**Architecture:** 純前端 SPA。`src/core/` 是不依賴 Vue 的純 TypeScript（幾何、質數、PRNG、路徑編碼、驗證、solver、backbite 生成器），Node 腳本 `scripts/gen-levels.ts` 用同一套 core 離線生成題庫並組裝成 `src/data/levels.json`（動態 import 的獨立 chunk）。Vue 層以 composable 管狀態（`useGame`、`useRecords`、`useProgress`、`useLevelStore`），元件只收 props／發 emits，`PlayView`／`HomeView` 負責接線。Bootstrap 5 只管版面、按鈕、Modal／Toast 樣式（不載入其 JS），棋盤用自寫 CSS Grid。

**Tech Stack:** Vue 3（Composition API、`<script setup>`、TypeScript）、Vite、Bootstrap 5（npm + SCSS）、vue-router、jsPDF、pnpm、Vitest（+ jsdom、@vue/test-utils、fast-check）、Playwright、wrangler（Static Assets）、tsx（腳本）。

**Spec:** `docs/superpowers/specs/2026-10-24-prime-trail-design.md`（以下「§n」皆指此 spec 章節）

## Global Constraints

- 技術棧固定：Vue 3 + TypeScript + Vite + Bootstrap 5（npm、SCSS 匯入，不用 CDN）+ vue-router + jsPDF + pnpm + Vitest + Playwright + wrangler；不引入 Vuetify／Element Plus 等第二套 UI 框架、不引入 Pinia、不引入 vue-i18n、不 import Bootstrap 的 JS（§1.4、§6.10、§10）。
- `src/core/**` 不得 import Vue、DOM API 或任何 `src/` 以外的執行期套件；必須可在 Node 單獨測試（§1.2）。
- 座標：`cell = r*10 + c`，`r, c ∈ [0,9]`；方向 `U=-10, D=+10, L=-1, R=+1` 配邊界檢查；邊緣格 36 格；相鄰 = 曼哈頓距離 1（§2.1、§2.2）。
- `PRIMES` 為 2…97 共 25 個；`primeIndex(2)=0`、`primeIndex(97)=24`（§2.3）。
- 參考路徑 `path[k-1]` 為數字 k 的格；`start = path[0]` 必為邊緣格；`grey = { path[p-1] | p ∈ PRIMES }` 恰 25 格（§2.4）。
- 奇偶引理：`color(cell) = (r+c) mod 2`，`color(path[k-1]) = (color(start)+k-1) mod 2`（§2.5）。
- 難度 `'easy' | 'advanced' | 'challenge'`；easy 顯示 1 + 全部 25 質數，advanced 顯示 1 + bitmask 子集，challenge 只顯示 1；三者灰底皆為全部質數格（§2.6）。
- 衝突種類固定四種：`duplicate`、`nonAdjacent`、`primeMismatch`、`parity`；全部即時標紅、不阻擋（§2.7、§8）。
- 過關 = 盤面填滿且 `findConflicts` 為空且 given 一致；不要求等於參考路徑（§2.8）。
- `LevelRecord = { s, p, h, c, seed }`：`p` 為 99 字元 `/^[UDLR]{99}$/`；`h` 為 25-bit bitmask（`0 ≤ h < 2^25`）；`c` 為 null 或 `[1, 1000]`，`1000` 表示 ≥ CAP（§3.1、§3.2）。
- `LevelFile = { schema: 1, libraryVersion, generator, masterSeed, count: 1000, levels }`；陣列索引 i 對應地圖編號 id = i+1（§3.2）。
- `levels.json` 由 `levels.meta.jsonl` 組裝，只有 1…1000 全齊才寫；發佈後全檔凍結（含 `h`），任何題面變動必升 `libraryVersion`；`--recompute` 只限發佈前（§3.5、§4）。
- 題庫以動態 `import()` 載入成獨立 chunk（§3.4）。
- 生成器：backbite，`N = 100_000` 步，端點到邊緣上限 `10_000` 步；PRNG sfc32，`seed = hash32(masterSeed + ":" + id + ":" + attempt)`；所有預算用節點數、不用時間（§4.2、§4.3）。
- 生成參數：`EASY_BUDGET = 200_000`、`ADV_BUDGET = 2_000_000`、`ADV_FLOOR = 6`、`ADV_RESTARTS = 3`、`K = 3`、`CAP = 1000`、`CHAL_BUDGET = 5_000_000`，全部放 `scripts/gen-config.ts`，改任一參數即改 `generator` 版本字串（§4.3–§4.6）。
- Solver 介面 `solve(puzzle, { maxSolutions, maxNodes, collect? }) → { count, exhausted, nodes, solutions? }`；每次嘗試放一個數字算 1 節點；`exhausted === false` 只因預算用盡或達 `maxSolutions`（§5.1）。
- v1 不在瀏覽器跑 solver；「提示」只用參考路徑並設 `assisted`（§5.6）。
- 路由：`/` 與 `/play/:id(\d+)/:difficulty(easy|advanced|challenge)`，其餘導回 `/`；vue-router history 模式（§6）。
- 棋盤格用 `<button class="pt-cell">`，不套 `.btn`；外層 `.pt-board` 為 11×11 單位 CSS Grid；`--cell = clamp(30px, calc((100vw - 16px) / 11), 48px)`；數字字級 `calc(var(--cell) * 0.42)`；龍頭格 `#9e9e9e`、質數格 `#e0e0e0`、白格 `#fff`、衝突紅 `#dc3545`（§6.1、§9）。
- 接續模式 `.pt-board { touch-action: none }`；指定模式 `touch-action: pan-y`；用 Pointer Events + `setPointerCapture`（§9）。
- 角落龍頭在所屬每條邊各畫一個三角形（§6.3）。
- `steps` = 成功 `place` 次數（含覆寫）；清除與 undo 不計不扣（§7.3）。
- 指定模式 `pending` 最多 3 字元、只允許數值 1–100、拒絕前導 0；必須按確認／Enter 才填入（§7.3）。
- 接續模式鍵盤：方向鍵延伸一格（非法則拒絕 + shake 150 ms）、Backspace/Delete 撤回最後一格、Tab 切模式、Ctrl/Cmd+Z undo（§7.3）。
- `markAssisted()` 冪等；看解答、提示、過關前匯出含解答 PDF 三處共用；assisted 過關只加 `assistedClears`、不更新 best（§7.4）。
- localStorage 前綴 `prime-trail:v1:L<libraryVersion>:`，key：`records`、`progress`（最多 20 筆 LRU）、`lastPlayed`；`settings` 用 `prime-trail:v1:settings`（無題庫版本）；解析錯誤視為無資料（§7.5）。
- 進入 `/play/:id/:difficulty` 有存檔即自動恢復 + Toast「已恢復進度」；「重新開始」需確認；存檔 debounce 300 ms；過關刪存檔並清 `lastPlayed`；不相容存檔丟棄（§7.6）。
- 計時：首次填入才開始，`visibilitychange` 隱藏即暫停，以 `performance.now()` 差值累加（§7.1、§14）。
- UI 字串集中於 `src/i18n/zh-TW/`，元件與非 i18n 的 `.ts` 不得含 CJK 字元；文案避開 Hidato／Numbrix；固定術語「龍頭」「質數格」「接續模式」「指定模式」「參考解」（§10）。
- PDF：jsPDF、A4 直式、mm、棋盤 160 mm 置中、格線 0.3 mm、龍頭 55% 灰、質數格 85% 灰、解答頁路徑折線 0.6 mm；數字用 Helvetica；中文用 `public/fonts/pdf-zh.subset.ttf`（Noto Sans TC 子集）匯出時才載入；檔名 `prime-trail-0123-advanced.pdf`（§6.9）。
- `wrangler.jsonc`：`name: "prime-trail"`、`assets.directory: "./dist"`、`assets.not_found_handling: "single-page-application"`、不設 `main`（§11）。
- `package.json` scripts：`dev`、`typecheck`、`test`、`test:slow`、`test:e2e`、`build`、`deploy`、`gen:levels`、`gen:pdf-font`；部署一律 `pnpm run deploy`（§11）。
- DoD：`pnpm typecheck` → `pnpm test` → `pnpm build`；`pnpm test:slow` 與 `pnpm test:e2e` 不屬 DoD（§12）。
- `pnpm test` 不得依賴 `levels.json` 存在：題庫測試在檔案不存在時 `describe.skipIf` 並 `console.warn`（§12.1）。
- 所有任務禁改：`CLAUDE.md`、`docs/CLAUDE.LOG/YYYYMM.md`、`docs/backlog.md`、`docs/superpowers/specs/**`、本 plan；日誌與 backlog 只寫 `docs/CLAUDE.LOG/drafts/<任務ID>.md`、`docs/backlog/drafts/<任務ID>.md`。
- 同層任務 Files 兩兩不相交；`package.json`／`pnpm-lock.yaml` 只在 A1 改，後層任務不得新增依賴（需要就寫 backlog 草稿回報）。

## Review Focus

spec 暗示但容易漏測、最可能咬到玩家的失敗模式。每條指定補測試的任務，該任務的 TDD 步驟已含對應測試：

1. **接續模式 head 跳過 given 時的斷鏈**：1…7 已填、11 為 given，玩家把 10 放在不與 11 相鄰的格 → `head` 必須變 11（不是卡在 10），且 10 與 11 兩格有 `nonAdjacent`；之後 `trailPress` 要從 11 的格延伸。→ **C3**（`useGame.trail.test.ts`）。
2. **指定模式三字元輸入**：`pending` 依序輸入 `1,0,0` → 可確認填 100；輸入 `1,0,1` 第三鍵被忽略（pending 仍 `10`）；首鍵 `0` 被忽略；`pending = '1'` 時按確認填 1 而非等待第二位。→ **C3**（`useGame.direct.test.ts`）與 **C6**（`NumberPad.test.ts` 顯示 pending）。
3. **存檔與題面不相容**：`progress` 的 `grid` 長度非 100、或 given 格的值與題面不符（例如題庫換版但前綴未變）→ `useProgress.load` 回 `null` 並刪除該筆；`libraryVersion` 不同 → 完全讀不到舊 key。→ **C4**（`useProgress.test.ts`）。
4. **assisted 與非 assisted 過關的紀錄疊加**：先 assisted 過關（`assistedClears=1`、`bestMs=null`、完成狀態 `assisted`），再非 assisted 過關（`clears=1`、`bestMs` 設定、完成狀態 `cleared`）；再一次較慢的非 assisted 過關不覆蓋 best。→ **C4**（`useRecords.test.ts`）、**E1** 情境 4。
5. **拖曳邊界**：拖曳中指標移出棋盤再回來不得重複 emit 同一格；`pointercancel` 必 emit `dragend`；指定模式下 `pointermove` 不 emit `drag`。→ **C2**（`GameBoard.test.ts`）、**E1** 情境 3（`scrollY` 不變）。
6. **計時器恢復語意**：以 `saved.elapsedMs = 61_000` 建構 → `elapsedMs` 為 61_000 且 `running=false`；下一次 `place` 才 `running=true`；`document.hidden` 切換時暫停／續跑。→ **C3**（`useTimer.test.ts`、`useGame.restore.test.ts`）。

---

## 工作流與相依

| 層 | 任務 | 相依 |
|---|---|---|
| A | A1 | 無 |
| B | B1、B2、B3、B4、B5、B6 | A |
| C | C1、C2、C3、C4、C5、C6、C7 | B |
| D | D1、D2、D4 | C |
| E | E1、E2 | D |

同層任務彼此獨立、**只動自己清單內的檔案，且各任務的 Files 清單兩兩不相交**（「只追加一行」擋不住衝突：同一錨點兩邊追加，git 一律報衝突）。共用檔若必須改，放到前一層的殘樁任務一次改完（型別、分支、登錄項先補齊），或改成一功能一檔、集中登錄的結構。工作日誌與 backlog 寫各自的 `drafts/<任務編號>.md`，不改月檔與 `backlog.md`。每層最後由主 session 在主 checkout 合併、跑完整 DoD、併入草稿。

層間說明：

- **A** 一個任務把所有共用檔一次放好：套件與 lockfile、設定檔、`src/core/types.ts` 全部型別、`geometry`／`primes`／`rng`、驗證過的 fixture、router 與空 view、`main.scss`。之後任何層都不碰 `package.json`、`pnpm-lock.yaml`、`src/core/types.ts`、`src/router.ts`。
- **B** 純核心（B1–B4）互不 import；B5 i18n 字串表採「一命名空間一檔」：`src/i18n/zh-TW/<ns>.ts`，`index.ts` 在 B5 一次登錄所有命名空間，之後每個命名空間檔在 C、D 層各只指派給一個任務可改。B6 自寫 Modal／Toast／Confirm 並掛進 `App.vue`（A1 建立、B 層只有 B6 改）。
- **C** 模組層：腳本、棋盤元件、遊戲 composable、儲存 composable、PDF、純 props/emits 元件、題庫測試（帶 skipIf）。
- **D** 接線：D1 `PlayView`（含 SolutionView、PDF 對話框接線、E2E 鉤子）、D2 `HomeView`、D4 正式生成題庫並 commit 產物（長時間，可由人本機跑）。
- **E** 驗證：E1 Playwright 九情境；E2 部署設定驗證（實際 `wrangler deploy` 由人執行）。

模型建議：B3、B4、C1、C3、D1 用較強模型；B5、B6、C6、D2、E2 可用較省模型。

---

## 層 A

### Task A1: 專案骨架、共用型別與驗證過的 fixture

**Files:**
- Create: `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`（若 pnpm 版本需要）、`.npmrc`、`.gitignore`、`index.html`、`vite.config.ts`、`vitest.config.ts`、`vitest.slow.config.ts`、`playwright.config.ts`、`tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`、`wrangler.jsonc`、`env.d.ts`（或 `src/env.d.ts`）
- Create: `src/main.ts`、`src/App.vue`、`src/router.ts`、`src/views/HomeView.vue`（空殼）、`src/views/PlayView.vue`（空殼）、`src/styles/main.scss`
- Create: `src/core/types.ts`、`src/core/geometry.ts`、`src/core/primes.ts`、`src/core/rng.ts`、`src/core/__fixtures__/level-fixture.ts`
- Create: `e2e/smoke.spec.ts`
- Test: `src/core/__tests__/geometry.test.ts`、`src/core/__tests__/primes.test.ts`、`src/core/__tests__/rng.test.ts`、`src/core/__tests__/fixture.test.ts`、`src/__tests__/smoke.test.ts`

**禁區：** `CLAUDE.md`、`docs/**`（除 `docs/CLAUDE.LOG/drafts/A1.md`、`docs/backlog/drafts/A1.md`）、`src/components/**`、`src/composables/**`、`src/i18n/**`、`scripts/**`

**Interfaces:**
- Consumes: 無。
- Produces（之後所有任務依賴，簽章不得再改）：
  - `package.json` scripts：`dev: vite`、`typecheck: vue-tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json`、`test: vitest run`、`test:slow: vitest run -c vitest.slow.config.ts`、`test:e2e: playwright test`、`build: vite build`、`deploy: pnpm build && wrangler deploy`、`gen:levels: tsx scripts/gen-levels.ts`、`gen:pdf-font: tsx scripts/gen-pdf-font.ts`。
  - 依賴一次裝齊：`vue`、`vue-router`、`bootstrap`、`jspdf`；dev：`vite`、`@vitejs/plugin-vue`、`typescript`、`vue-tsc`、`sass-embedded`、`vitest`、`jsdom`、`@vue/test-utils`、`fast-check`、`@playwright/test`、`wrangler`、`tsx`、`subset-font`、`fontkit`、`@types/node`、`@types/fontkit`（若無型別則在 `env.d.ts` 宣告模組）。版本取任務當日最新穩定版並鎖進 lockfile。
  - `vitest.config.ts`：`environment: 'jsdom'`、`include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']`、`exclude: ['src/data/__slow__/**', 'e2e/**', 'node_modules/**']`。`vitest.slow.config.ts`：`include: ['src/data/__slow__/**/*.test.ts']`、`environment: 'node'`、`testTimeout: 600_000`。
  - `playwright.config.ts`：`testDir: 'e2e'`，`webServer: { command: 'VITE_E2E=1 pnpm dev --port 4173', url: 'http://localhost:4173' }`，projects `desktop-chromium` 與 `mobile-chromium`（`devices['Pixel 7']`）。
  - `wrangler.jsonc` 內容照 §11，不設 `main`。
  - `.gitignore`：`node_modules/`、`dist/`、`.wrangler/`、`.dev.vars`、`playwright-report/`、`test-results/`、`src/data/levels.partial.json`、`.cache/`。
  - `src/router.ts`：`createRouter({ history: createWebHistory() })`，routes：`{ path: '/', name: 'home', component: () => import('./views/HomeView.vue') }`、`{ path: '/play/:id(\\d+)/:difficulty(easy|advanced|challenge)', name: 'play', component: () => import('./views/PlayView.vue'), props: true }`、`{ path: '/:pathMatch(.*)*', redirect: '/' }`。
  - `src/App.vue`：`<RouterView />` 包在 `<main class="container-fluid px-2 px-md-3">`；不含 CJK 文字。`src/styles/main.scss`：Bootstrap 變數覆寫 + 只匯入 `functions, variables, variables-dark, maps, mixins, root, reboot, type, containers, grid, buttons, forms, modal, toast, badge, close, utilities, utilities/api`；在 `main.ts` 匯入。
  - `src/core/types.ts`（完整，之後不改）：
    ```ts
    export type Cell = number;
    export type Direction = 'U' | 'D' | 'L' | 'R';
    export type Difficulty = 'easy' | 'advanced' | 'challenge';
    export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'advanced', 'challenge'];
    export const BOARD_SIZE = 10; export const CELL_COUNT = 100;
    export const CHALLENGE_CAP = 1000; export const SCHEMA_VERSION = 1;
    export interface LevelRecord { s: number; p: string; h: number; c: number | null; seed: number }
    export interface LevelFile { schema: 1; libraryVersion: number; generator: string; masterSeed: string; count: number; levels: LevelRecord[] }
    export interface Level { id: number; start: Cell; path: Uint8Array; cellOf: Uint8Array; numberAt: Uint8Array; grey: Uint8Array; advancedHints: ReadonlySet<number> }
    export interface Puzzle { start: Cell; grey: Uint8Array; givens: ReadonlyMap<Cell, number> }
    export type ConflictKind = 'duplicate' | 'nonAdjacent' | 'primeMismatch' | 'parity';
    export interface Conflict { cell: Cell; kind: ConflictKind }
    export interface SolveOptions { maxSolutions: number; maxNodes: number; collect?: boolean }
    export interface SolveResult { count: number; exhausted: boolean; nodes: number; solutions?: Uint8Array[] }
    export type InputMode = 'trail' | 'direct';
    export type GameStatus = 'idle' | 'playing' | 'won';
    export interface Move { cell: Cell; prev: number; next: number }
    export interface SavedProgress { grid: number[]; steps: number; elapsedMs: number; assisted: boolean; inputMode: InputMode; savedAt: string }
    export interface RecordEntry { bestMs: number | null; bestSteps: number | null; clears: number; assistedClears: number; lastClearedAt: string }
    export interface LastPlayed { levelId: number; difficulty: Difficulty; savedAt: string }
    export interface Settings { inputMode: InputMode; locale: 'zh-TW' }
    export type Completion = 'none' | 'assisted' | 'cleared';
    export interface Rng { next(): number; int(n: number): number; pick<T>(arr: readonly T[]): T; shuffle<T>(arr: T[]): T[] }
    ```
  - `src/core/geometry.ts`：`rowOf(cell): number`、`colOf(cell): number`、`cellAt(r, c): Cell`、`isEdge(cell): boolean`、`edgeSides(cell): ReadonlyArray<'top'|'bottom'|'left'|'right'>`、`color(cell): 0 | 1`、`adjacent(a, b): boolean`、`manhattan(a, b): number`、`NEIGHBORS: ReadonlyArray<readonly Cell[]>`（預算 100 筆）、`step(cell, dir: Direction): Cell | -1`、`dirBetween(a, b): Direction | null`、`DIRECTIONS: readonly Direction[] = ['U','D','L','R']`。
  - `src/core/primes.ts`：`PRIMES: readonly number[]`（25 個）、`PRIME_SET: ReadonlySet<number>`、`isPrime(n: number): boolean`（1–100 查表，其他 false）、`primeIndex(p: number): number`（非質數回 -1）。
  - `src/core/rng.ts`：`hash32(s: string): number`（FNV-1a 32-bit，回傳 `>>> 0`）、`createRng(seed: number): Rng`（sfc32；四個狀態由 seed 經 splitmix32 展開，`next()` 回 `[0,1)`、`int(n)` 回 `[0,n)`、`shuffle` 為 Fisher–Yates 原地）、`levelSeed(masterSeed: string, id: number, attempt: number): number = hash32(\`${masterSeed}:${id}:${attempt}\`)`。
  - `src/core/__fixtures__/level-fixture.ts`（規劃者以獨立 solver 驗證過的值，直接照抄）：
    ```ts
    export const FIXTURE_START = 8;
    export const FIXTURE_DIRS = 'RDDDDDLDRDLLDRRDLLLUULLLDRRDLLLLLURRULLUUUUUUURRRDLLDDDDDRRRRRRUURULLDLUUURDRRULULLLDDDLULDDDRURDRR';
    export const FIXTURE_PATH: readonly number[] = [8,9,19,29,39,49,59,58,68,69,79,78,77,87,88,89,99,98,97,96,86,76,75,74,73,83,84,85,95,94,93,92,91,90,80,81,82,72,71,70,60,50,40,30,20,10,0,1,2,3,13,12,11,21,31,41,51,61,62,63,64,65,66,67,57,47,48,38,37,36,46,45,35,25,15,16,26,27,28,18,17,7,6,5,4,14,24,34,33,23,22,32,42,52,53,43,44,54,55,56];
    export const FIXTURE_GREY_CELLS: readonly number[] = [0,6,9,11,19,28,33,35,39,40,44,46,48,59,60,62,64,75,77,79,82,93,95,97,99];
    export const FIXTURE_ADVANCED_HINT_MASK = 4032;        // 質數 {17,19,23,29,31,37}（bit 6..11），唯一解
    export const FIXTURE_AMBIGUOUS_HINT_MASK = 33554304;   // 質數 ≥ 19（bit 7..24），恰 2 解
    export const FIXTURE_RECORD: LevelRecord = { s: 8, p: FIXTURE_DIRS, h: 4032, c: null, seed: 0 };
    export const FIXTURE_ALT_DIRS = 'RDDDDDLDRDDDLUULDDLUULLLDRRDLLLLLURRULLUUUUUUURRRDLLDDDDDRRRRRRUURULLDLUUURDRRULULLLDDDLULDDDRURDRR';
    export const FIXTURE_ALT_PATH: readonly number[] = [8,9,19,29,39,49,59,58,68,69,79,89,99,98,88,78,77,87,97,96,86,76,75,74,73,83,84,85,95,94,93,92,91,90,80,81,82,72,71,70,60,50,40,30,20,10,0,1,2,3,13,12,11,21,31,41,51,61,62,63,64,65,66,67,57,47,48,38,37,36,46,45,35,25,15,16,26,27,28,18,17,7,6,5,4,14,24,34,33,23,22,32,42,52,53,43,44,54,55,56];
    // 已驗證性質：easy 題面唯一解；給 {1} ∪ 質數≥19 恰 2 解（另一解為 FIXTURE_ALT_PATH，只有數字 12–18 位置不同）；
    // 只給 {1, 17} 仍唯一解；challenge 題面（只給 1）≥ 2 解；2 的格 = 9 為龍頭相鄰格中唯一灰底。
    export function fixtureGrid(path: readonly number[]): Uint8Array;            // grid[path[k-1]] = k
    export function fixturePuzzle(shownPrimes: Iterable<number>): Puzzle;         // start=8、grey 由 FIXTURE_GREY_CELLS、givens = {8→1} ∪ {FIXTURE_PATH[p-1] → p}
    ```

**驗收指令：**
- `pnpm install --frozen-lockfile`
- `pnpm vitest run src/core/__tests__ src/__tests__`
- `pnpm typecheck && pnpm test && pnpm build`
- `pnpm exec wrangler deploy --dry-run`（只驗設定檔可解析，不需登入）

**完成證據：** 上列檔案存在；`pnpm test` 至少 5 個測試檔全綠；`dist/index.html` 產出；`docs/CLAUDE.LOG/drafts/A1.md` 與（若有）`docs/backlog/drafts/A1.md` 寫好（不改月檔與 `docs/backlog.md`）。

- [ ] **Step 1: 寫失敗測試**
  - `geometry.test.ts`：`cellAt(3,4) === 34`；`rowOf(34)===3`、`colOf(34)===4`；`isEdge` 對 36 個邊緣格為真、其餘 64 格為假（迭代全部 100 格計數）；`edgeSides(0)` 深等於 `['top','left']`、`edgeSides(8)` 為 `['top']`、`edgeSides(55)` 為 `[]`；`color(8)===0`、`color(9)===1`；`adjacent(9,19)` 真、`adjacent(9,10)` 假（跨行）、`adjacent(0,11)` 假（斜角）；`step(0,'U')===-1`、`step(9,'R')===-1`、`step(8,'R')===9`；`dirBetween(8,9)==='R'`、`dirBetween(8,18)==='D'`、`dirBetween(8,28)===null`；`NEIGHBORS[0]` 長度 2、`NEIGHBORS[55]` 長度 4。fast-check 屬性（`fc.integer({min:0,max:99})` 兩個）：`adjacent(a,b)===adjacent(b,a)`；`adjacent(a,b) === (manhattan(a,b)===1)`；`adjacent(a,b) ⇒ color(a)!==color(b)`。
  - `primes.test.ts`：`PRIMES` 長度 25、首 2 末 97；`isPrime(1)` 假、`isPrime(97)` 真、`isPrime(100)` 假、`isPrime(101)` 假；對每個 p：`PRIMES[primeIndex(p)] === p`；`primeIndex(4) === -1`。
  - `rng.test.ts`：`hash32('')===2166136261`（FNV-1a offset basis）；`hash32('a')===0xe40c292c`；`levelSeed('prime-trail-v1', 1, 0) === hash32('prime-trail-v1:1:0')`；同 seed 兩個 rng 的前 1000 個 `next()` 相同；不同 seed 前 10 個不全相同；`next()` 皆在 `[0,1)`；`int(10)` 1000 次都在 `[0,9]`；`shuffle([0..9])` 回傳同一參考且為排列。
  - `fixture.test.ts`：`FIXTURE_DIRS.length===99` 且匹配 `/^[UDLR]{99}$/`；`FIXTURE_PATH` 長 100 且為 0…99 排列；相鄰每對 `adjacent` 真；`isEdge(FIXTURE_START)` 真；`FIXTURE_PATH[0]===8`；由 `FIXTURE_PATH[p-1]` 算出的灰底集合排序後深等於 `FIXTURE_GREY_CELLS`；`FIXTURE_ALT_PATH` 同樣是合法 Hamiltonian path、灰底集合相同、與 `FIXTURE_PATH` 恰在索引 11…17 不同；`fixturePuzzle(PRIMES).givens.size===26`；`fixturePuzzle([]).givens` 只含 `8→1`；`fixtureGrid(FIXTURE_PATH)[8]===1`、`[56]===100`。
  - `src/__tests__/smoke.test.ts`：以 `@vue/test-utils` `mount(App, { global: { plugins: [router] } })` 後 `router.push('/')`、`await router.isReady()`，`wrapper.html()` 含 `<main`。
- [ ] **Step 2: 跑測試確認失敗**（`pnpm vitest run src/core/__tests__ src/__tests__` 應因模組不存在而失敗）
- [ ] **Step 3: 最小實作**：依 Interfaces 建立所有檔案；`HomeView.vue`／`PlayView.vue` 只放 `<section data-view="home">`／`<section data-view="play">`；`e2e/smoke.spec.ts` 開 `/` 斷言 `main` 可見（E 層才會跑）。`tsconfig.node.json` 包含 `scripts/**`、`e2e/**`、`*.config.ts`。
- [ ] **Step 4: 跑測試確認通過**：驗收指令四條全綠。
- [ ] **Step 5: Commit**（訊息 `feat(A1): project skeleton, core types, geometry/primes/rng, verified fixture`）

---

## 層 B

### Task B1: 路徑編碼與關卡解碼

**Files:**
- Create: `src/core/path-codec.ts`、`src/core/level-decode.ts`
- Test: `src/core/__tests__/path-codec.test.ts`、`src/core/__tests__/level-decode.test.ts`

**禁區：** `src/core/types.ts`、`src/core/geometry.ts`、`src/core/primes.ts`、`src/core/rng.ts`、`src/core/__fixtures__/**`、`package.json`、其他任務的檔案

**Interfaces:**
- Consumes: `types.ts` 的 `Level`、`LevelRecord`、`LevelFile`、`Puzzle`、`Difficulty`；`geometry.step/dirBetween`；`primes.PRIMES/primeIndex`；fixture 常數。
- Produces:
  - `path-codec.ts`：`export class PathCodecError extends Error { constructor(message: string, readonly index: number) }`；`encodePath(path: Uint8Array | readonly number[]): string`（長度非 100、相鄰不合法丟 `PathCodecError`）；`decodePath(start: Cell, dirs: string): Uint8Array`（長度 ≠ 99、非 UDLR、越界、重訪、起點越界皆丟 `PathCodecError` 並帶出錯索引）；`isHamiltonianPath(path: ArrayLike<number>): boolean`。
  - `level-decode.ts`：`hintMaskToPrimes(mask: number): Set<number>`、`primesToHintMask(primes: Iterable<number>): number`、`decodeLevel(record: LevelRecord, id: number): Level`（`cellOf === path` 同一參考；`numberAt[path[k-1]] = k`；`grey[path[p-1]] = 1`）、`derivePuzzle(level: Level, difficulty: Difficulty): Puzzle`（givens 含 `start→1`；easy 25 質數；advanced 依 `advancedHints`；challenge 只有 1）、`parseLevelFile(json: unknown): LevelFile`（檢查 `schema===1`、`libraryVersion` 正整數、`count===levels.length`、每筆欄位型別與 `p` 正規式；不符丟 `Error`，訊息含第幾筆）。

**驗收指令：**
- `pnpm vitest run src/core/__tests__/path-codec.test.ts src/core/__tests__/level-decode.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 兩個測試檔全綠（含 fast-check 屬性）；日誌／backlog 只寫 `docs/CLAUDE.LOG/drafts/B1.md`、`docs/backlog/drafts/B1.md`。

- [ ] **Step 1: 寫失敗測試**
  - `path-codec.test.ts`：`decodePath(8, FIXTURE_DIRS)` 深等於 `FIXTURE_PATH`；`encodePath(FIXTURE_PATH) === FIXTURE_DIRS`；fast-check：用隨機 `Rng` 走「隨機自避免步伐直到 100 格」太慢，改以 `fc.constantFrom(FIXTURE_PATH, FIXTURE_ALT_PATH)` 加上「以隨機反轉整條路徑」的變體驗證 `decodePath(p[0], encodePath(p))` 深等於 `p`；錯誤案例：長度 98 → `PathCodecError`；含 `X` → `index` 為該位置；`decodePath(0, 'U' + ...)` 越界 → `index===0`；重訪（`'RL' + ...`）→ `index===1`；`isHamiltonianPath` 對 `FIXTURE_PATH` 真、對把兩元素互換後的陣列為假、對含重複的為假。
  - `level-decode.test.ts`：`hintMaskToPrimes(4032)` 深等於 `new Set([17,19,23,29,31,37])`；`primesToHintMask([17,19,23,29,31,37])===4032`；`hintMaskToPrimes(33554304).size===18` 且不含 17；`decodeLevel(FIXTURE_RECORD, 7)`：`id===7`、`start===8`、`numberAt[8]===1`、`numberAt[56]===100`、`grey` 中 1 的索引排序後等於 `FIXTURE_GREY_CELLS`、`advancedHints` 等於上述集合、`cellOf===path`；`derivePuzzle(level,'easy').givens.size===26` 且 `get(77)===13`；`'advanced'` 為 7（1 + 6）；`'challenge'` 為 1；`parseLevelFile({schema:1, libraryVersion:1, generator:'x', masterSeed:'s', count:1, levels:[FIXTURE_RECORD]})` 成功；`schema:2` 丟錯；`count:2` 與 levels 長度不符丟錯；`p` 長度 98 丟錯且訊息含 `levels[0]`。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**（純函式，`Uint8Array` 輸出）
- [ ] **Step 4: 跑測試確認通過**（兩條驗收指令）
- [ ] **Step 5: Commit**

### Task B2: 盤面驗證與衝突偵測

**Files:**
- Create: `src/core/validate.ts`
- Test: `src/core/__tests__/validate.test.ts`

**禁區：** 同 B1，加 `src/core/path-codec.ts`、`src/core/level-decode.ts`

**Interfaces:**
- Consumes: `types.ts`（`Puzzle`、`Conflict`、`ConflictKind`、`Cell`）；`geometry.adjacent/color`；`primes.isPrime`；fixture `fixturePuzzle/fixtureGrid`。
- Produces：`findConflicts(grid: Uint8Array, puzzle: Puzzle): Conflict[]`（同一格多種衝突各回一筆；順序不保證）；`conflictMap(conflicts: Conflict[]): Map<Cell, ConflictKind[]>`；`isFull(grid: Uint8Array): boolean`；`isSolved(grid: Uint8Array, puzzle: Puzzle): boolean`（§2.8 五條）；`headOf(grid: Uint8Array): number`（最大 h 使 1…h 全部出現；無 1 則 0）；`cellOfNumber(grid: Uint8Array, n: number): Cell | -1`（重複時回最小索引）；`gridEquals(a: Uint8Array, b: ArrayLike<number>): boolean`。

**驗收指令：**
- `pnpm vitest run src/core/__tests__/validate.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 測試檔全綠，案例涵蓋四種衝突與五條過關條件各至少一個反例；草稿寫 `drafts/B2.md`。

- [ ] **Step 1: 寫失敗測試**（`P = fixturePuzzle(PRIMES)`、`G = fixtureGrid(FIXTURE_PATH)`）
  - `isSolved(G, P)` 真；`findConflicts(G, P)` 為空。
  - 條件 1：`G` 複本把 cell 56（100）清 0 → `isSolved` 假、`isFull` 假。條件 2：把 `start` 改成 2 並把 cell 9 改成 1（不動 given 檢查之外）→ 假。條件 3：把數字 12（cell 78）與 13（cell 77）互換 → `findConflicts` 含 `{cell:77,kind:'nonAdjacent'}`？——12 與 13 互換後兩者仍相鄰但 11(cell 79)-12、13-14 斷鏈：斷言結果中 kind 為 `nonAdjacent` 的格集合等於 `{79, 78, 77, 87}`，另有 `primeMismatch` 於 77 與 78（13 跑到非灰格、12 跑進灰格）；`isSolved` 假。條件 4：`G` 複本把 cell 77 設 12、cell 78 設 13（同上）已覆蓋；另造 `grid` 全對但 `puzzle.grey` 多一格 → 假。條件 5：`fixturePuzzle([17])` 下把 cell 99 的 17 與鄰格互換 → 假。
  - `duplicate`：空 grid 填 cell 9 = 2、cell 18 = 2 → 兩格皆 `duplicate`。
  - `parity`：空 grid（只有 start=1）填 cell 18（color 1）為 3 → `{cell:18, kind:'parity'}`；填 cell 18 為 2 → 無 parity 衝突（但有 `primeMismatch`，因 18 非灰）。
  - `headOf`：空 grid → 0；只有 1 → 1；1,2,3 加 7 → 3；1,2,3,4…7 → 7。`cellOfNumber(G, 100)===56`、`cellOfNumber(G, 101)===-1`。
  - 「不同於參考解但合法」：`fixtureGrid(FIXTURE_ALT_PATH)` 對 `fixturePuzzle([])`（challenge）`isSolved` 真，對 `fixturePuzzle(PRIMES)` 假（13 given 於 77）；`gridEquals(fixtureGrid(FIXTURE_ALT_PATH), fixtureGrid(FIXTURE_PATH))` 假。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task B3: Solver（計數到 n 即停、節點預算）

**Files:**
- Create: `src/core/solver.ts`
- Test: `src/core/__tests__/solver.test.ts`

**禁區：** 同 B2，加 `src/core/validate.ts`

**Interfaces:**
- Consumes: `types.ts`（`Puzzle`、`SolveOptions`、`SolveResult`）；`geometry.NEIGHBORS/manhattan/adjacent`；`primes.PRIMES/isPrime`；fixture。
- Produces：`solve(puzzle: Puzzle, options: SolveOptions): SolveResult`。語意照 §5.1：`nodes` 為嘗試放數字的次數；`count ≤ maxSolutions`；`exhausted` 為真表示搜尋完整走完；`collect` 為真時 `solutions` 為 `Uint8Array(100)` 的 grid（cell → number）。前處理：連續 given 曼哈頓距離 > 數字差 → 直接 `{count:0, exhausted:true, nodes:0}`。

演算法（簽章與測試無法決定，故列出）：DFS 依數字遞增延伸 head；候選過濾 §5.3；剪枝 §5.4 四條（given 可達、下一質數可達與灰底格趕得上、度數規則 `avail=0` 或 `avail=1` 的格 ≥ 2、未訪格 + head 連通 BFS）；候選依 Warnsdorff（未訪相鄰數少者先）排序；用 `Uint8Array visited`、`Int8Array deg` 增量維護；遞迴深度 ≤ 100。

**驗收指令：**
- `pnpm vitest run src/core/__tests__/solver.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 測試全綠且整檔 < 20 s；草稿寫 `drafts/B3.md`。

- [ ] **Step 1: 寫失敗測試**
  - easy：`solve(fixturePuzzle(PRIMES), {maxSolutions:2, maxNodes:200_000})` → `count===1 && exhausted===true`，`nodes < 200_000`。
  - 只給 17：`solve(fixturePuzzle([17]), {maxSolutions:2, maxNodes:2_000_000})` → `count===1 && exhausted`。
  - 恰 2 解：`solve(fixturePuzzle(hintMaskToPrimes(33554304) 的等價清單 [19,23,...,97]), {maxSolutions:1000, maxNodes:2_000_000, collect:true})` → `count===2 && exhausted`，兩個解之一 `gridEquals(fixtureGrid(FIXTURE_PATH))`、另一 `gridEquals(fixtureGrid(FIXTURE_ALT_PATH))`。
  - 早停：同上題面 `maxSolutions:1` → `count===1 && exhausted===false`。
  - 預算：`solve(fixturePuzzle([]), {maxSolutions:2, maxNodes:1000})` → `exhausted===false && nodes ≤ 1000 + 4`（允許最後一層多算一個分支）。
  - challenge：`solve(fixturePuzzle([]), {maxSolutions:2, maxNodes:5_000_000, collect:true})` → `count===2`，且每個解對 `fixturePuzzle([])` 都合法——B2 與本任務同層，測試檔**不得** import `validate.ts`，改在測試檔內寫三行檢查：為 1…100 排列、連續數字相鄰、`isPrime(grid[cell]) === (grey[cell]===1)`。
  - 不可能題面：`fixturePuzzle` 的 givens 再加 `{ cell 55 → 3 }`（距 start 太遠）→ `count===0 && exhausted && nodes===0`。
  - 全部 given（100 個數字都給）→ `count===1`。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**，實作後若 challenge 案例超過 10 s，先確認度數規則與連通性剪枝有生效，再考慮每步連通性改為度數變動時才做。
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task B4: Backbite 隨機 Hamiltonian path 生成

**Files:**
- Create: `src/core/generator.ts`
- Test: `src/core/__tests__/generator.test.ts`

**禁區：** 同 B3，加 `src/core/solver.ts`

**Interfaces:**
- Consumes: `types.ts`（`Rng`、`Cell`）；`geometry.NEIGHBORS/isEdge`；`primes.PRIMES`；`rng.createRng`。
- Produces：`serpentinePath(): Uint8Array`（row 0 左→右、row 1 右→左…，`[0]===0`、`[99]===90`）；`backbiteStep(path: Uint8Array, rng: Rng): void`（原地；隨機選端點、隨機選該端點的非路徑鄰接相鄰格、反轉對應區段）；`randomHamiltonianPath(rng: Rng, opts: { steps: number; edgeExtraMax: number }): Uint8Array | null`（先跑 `steps` 次 backbite，再逐步直到某端點為邊緣格，超過 `edgeExtraMax` 回 `null`；兩端皆邊緣以 `rng.int(2)` 選；回傳的 `[0]` 為起點）；`greyOf(path: ArrayLike<number>): Uint8Array`。

**驗收指令：**
- `pnpm vitest run src/core/__tests__/generator.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 測試全綠且 100_000 步案例 < 2 s；草稿寫 `drafts/B4.md`。

- [ ] **Step 1: 寫失敗測試**
  - `serpentinePath()` 為 0…99 排列、相鄰皆合法、`[0]===0`、`[99]===90`。
  - 對 `createRng(1)`，連做 1000 次 `backbiteStep` 後仍是合法 Hamiltonian path（排列 + 相鄰）；每一步後路徑都合法（迴圈內斷言）。
  - `randomHamiltonianPath(createRng(20), {steps:100_000, edgeExtraMax:10_000})` 非 null、合法、`isEdge(path[0])` 真。
  - 可重現：`createRng(42)` 兩次產出深等於；`createRng(42)` 與 `createRng(43)` 不同。
  - 多樣性：seed 1…20 的 20 條路徑互不相同；起點位於至少 5 個不同格。
  - `greyOf(FIXTURE_PATH)` 中 1 的索引等於 `FIXTURE_GREY_CELLS`。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**（`path.indexOf` 找位置 O(100) 可接受；反轉用 `subarray().reverse()`）
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task B5: i18n 字串表、`useI18n` 與 CJK 守門

**Files:**
- Create: `src/i18n/index.ts`、`src/i18n/types.ts`、`src/i18n/zh-TW/index.ts`、`src/i18n/zh-TW/app.ts`、`common.ts`、`difficulty.ts`、`board.ts`、`conflict.ts`、`input.ts`、`status.ts`、`picker.ts`、`win.ts`、`solution.ts`、`pdf.ts`、`play.ts`、`home.ts`
- Test: `src/i18n/__tests__/i18n.test.ts`、`src/i18n/__tests__/no-hardcoded-cjk.test.ts`

**禁區：** `src/core/**`、`src/components/**`、`src/composables/**`、`src/views/**`、`src/App.vue`、`package.json`

**Interfaces:**
- Consumes: 無（純 TS）。
- Produces：
  - 每個命名空間檔 `export const <ns> = { ... } as const`；`zh-TW/index.ts` 組成 `export const zhTW = { app, common, difficulty, board, conflict, input, status, picker, win, solution, pdf, play, home } as const`（此檔之後不再改；各命名空間檔在 C／D 層只指派給一個任務可改：`board`、`conflict` → C2；`input`、`status`、`picker`、`win` → C6；`pdf` → C5；`solution`、`play` → D1；`home` → D2；`app`、`common`、`difficulty` 不再改）。
  - `types.ts`：`export type Messages = typeof zhTW`；`export type MessageKey = DotPath<Messages>`（遞迴條件型別，葉節點為 string）；`export type Locale = 'zh-TW'`。
  - `index.ts`：`export function t(key: MessageKey, params?: Record<string, string | number>): string`（`{name}` 置換；找不到鍵回傳鍵名本身並 `console.warn`）；`export function useI18n(): { t: typeof t; locale: Ref<Locale> }`；`export const messages: Readonly<Record<Locale, Messages>>`。
  - 最低鍵集合（文案由本任務定，術語照 §10）：`app.title`（`Prime Trail`）；`common.confirm/cancel/close/back/ok`；`difficulty.easy/advanced/challenge`（簡單／進階／挑戰）；`board.cellLabel`（`第{r}列第{c}行，{content}`）、`board.empty`、`board.primeCell`、`board.head`、`board.legendHead`、`board.legendPrime`；`conflict.duplicate/nonAdjacent/primeMismatch/parity`（parity 文案「此格只能放{parity}」+ `conflict.odd/even`）；`input.trail/direct/toggle/digit/clear/confirm/pending`；`status.level`（`地圖 #{id}`）、`status.steps`（`步數 {n}`）、`status.time`、`status.assisted`（`輔助中・不列入最佳紀錄`）；`picker.levelId/random/start/resume`（`繼續上次`）、`picker.resumeLabel`（`#{id}・{difficulty}`）、`picker.best/bestTime/bestSteps/cleared/assistedCleared`（`輔助完成`）、`picker.invalidId`；`win.title/titleAssisted`（`輔助完成`）、`win.time/steps/newBestTime/newBestSteps/notRecorded`（`本局不列入最佳紀錄`）、`win.viewSolution/nextRandom/backHome/exportPdf`；`solution.title/mine/reference/alsoValid`（`你的解也合法`）、`solution.confirm`（`看過解答後，這局不列入最佳紀錄。`）；`pdf.title/level/difficulty/legendHead/legendPrime/solutionTitle/export/includeSolution/confirmSolution`（`匯出含解答的 PDF 後，這局不列入最佳紀錄。`）、`pdf.fontFallback`；`play.restored`（`已恢復進度`）、`play.restart`、`play.restartConfirm`（`清除目前盤面並重新計時？`）、`play.undo/clear/hint/viewSolution/exportPdf`、`play.hintDiverged`（`從 {n} 開始與參考解不同；提示依參考解`）、`play.remainingErrors`（`還有 {n} 格有錯`）、`play.levelMissing`、`play.loading`；`home.title/subtitle/continue`。
- 不含 Hidato／Numbrix 字樣。

**驗收指令：**
- `pnpm vitest run src/i18n/__tests__`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 兩個測試檔全綠；`no-hardcoded-cjk` 掃描到 A1 既有檔案也通過；草稿寫 `drafts/B5.md`。

- [ ] **Step 1: 寫失敗測試**
  - `i18n.test.ts`：`t('difficulty.easy')==='簡單'`；`t('status.steps',{n:57})==='步數 57'`；`t('picker.resumeLabel',{id:'0123',difficulty:'進階'})==='#0123・進階'`；`t('nope' as MessageKey)` 回 `'nope'` 且 `console.warn` 被呼叫一次（spy）；型別測試：`// @ts-expect-error` 於 `t('difficulty.hard')`；所有葉節點為非空字串（遞迴走訪 `zhTW`）；所有葉節點不含 `/hidato|numbrix/i`。
  - `no-hardcoded-cjk.test.ts`：用 `fast-glob` 或 Node `fs` 遞迴列出 `src/**/*.{vue,ts}` 排除 `src/i18n/**`、`**/__tests__/**`、`**/__fixtures__/**`、`**/*.test.ts`，每檔逐行比對 `/[㐀-鿿豈-﫿]/`，命中即 `expect.fail` 並印檔名與行號。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task B6: BsModal／BsToast／useConfirm 與 App 掛載

**Files:**
- Create: `src/components/ui/BsModal.vue`、`src/components/ui/BsToastHost.vue`、`src/components/ui/BsConfirmHost.vue`、`src/composables/useToast.ts`、`src/composables/useConfirm.ts`
- Modify: `src/App.vue`（掛 `<BsToastHost />` 與 `<BsConfirmHost />`）
- Test: `src/components/ui/__tests__/BsModal.test.ts`、`src/components/ui/__tests__/toast-confirm.test.ts`

**禁區：** `src/core/**`、`src/i18n/**`、`src/views/**`、`src/router.ts`、`src/styles/main.scss`、`package.json`

**Interfaces:**
- Consumes: Bootstrap class（已由 `main.scss` 匯入 modal、toast、close）。不 import `bootstrap` JS。
- Produces：
  - `BsModal.vue` props `{ modelValue: boolean; title: string; size?: 'sm' | 'lg'; closeOnBackdrop?: boolean (預設 true); labelledBy?: string }`，emits `update:modelValue(false)`、`closed()`；slots `default`、`footer`；`<Teleport to="body">`；開啟時 `document.body` 加 `modal-open`，渲染 `.modal.show.d-block[role="dialog"][aria-modal="true"]` 與 `.modal-backdrop.show`；Esc 關閉；關閉後焦點回到開啟前的 `document.activeElement`；開啟時焦點移到第一個可聚焦元素。
  - `useToast(): { toasts: Readonly<Ref<ToastItem[]>>; show(message: string, opts?: { variant?: 'info' | 'success' | 'danger'; durationMs?: number }): number; dismiss(id: number): void }`，`ToastItem = { id; message; variant; durationMs }`，預設 `durationMs = 3000`；模組層單例。`BsToastHost.vue` 渲染 `.toast-container.position-fixed.bottom-0.end-0.p-3` 內的 `.toast.show[role="status"]`。
  - `useConfirm(): { confirm(message: string, opts?: { title?: string; okLabel?: string; cancelLabel?: string }): Promise<boolean>; pending: Readonly<Ref<ConfirmRequest | null>> }`，模組層單例；`BsConfirmHost.vue` 用 `BsModal` 渲染 `pending`，按 OK resolve `true`、取消／Esc／backdrop resolve `false`；按鈕文字由呼叫端傳入（此任務不 import i18n）。

**驗收指令：**
- `pnpm vitest run src/components/ui/__tests__`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 測試全綠；`App.vue` 掛載兩個 host；草稿寫 `drafts/B6.md`。

- [ ] **Step 1: 寫失敗測試**
  - `BsModal.test.ts`：`mount` 後 `modelValue=false` 不渲染 `.modal`；設 true 後 `document.body.querySelector('.modal.show')` 存在、`role="dialog"`、`aria-modal="true"`、`document.body.classList.contains('modal-open')`；觸發 `keydown Escape` → emits `update:modelValue` 為 `[false]`；點 `.modal-backdrop` 且 `closeOnBackdrop=false` 時不 emit；關閉後 body 無 `modal-open`；焦點回復：先 focus 一個 button，開啟再關閉後 `document.activeElement` 為該 button。
  - `toast-confirm.test.ts`：`show('a')` 後 `toasts.value.length===1`，`vi.advanceTimersByTime(3000)` 後為 0；`show('b',{durationMs:100})` 100 ms 後消失；`BsToastHost` 渲染出 `.toast.show` 文字 `a`；`useConfirm().confirm('x',{okLabel:'OK',cancelLabel:'No'})` 後 `pending.value` 非 null，mount 的 `BsConfirmHost` 點 OK → promise resolve `true`、`pending` 回 null；再呼叫並按取消 → `false`。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

---

## 層 C

### Task C1: 題庫生成腳本（JSONL meta、續跑、組裝、worker）

**Files:**
- Create: `scripts/gen-config.ts`、`scripts/gen-levels.ts`、`scripts/lib/gen-level.ts`、`scripts/lib/meta.ts`、`scripts/lib/assemble.ts`、`scripts/lib/worker.ts`、`scripts/lib/cli.ts`
- Test: `scripts/__tests__/gen-level.test.ts`、`scripts/__tests__/meta.test.ts`、`scripts/__tests__/assemble.test.ts`、`scripts/__tests__/cli.test.ts`

**禁區：** `src/**`（只能 import，不能改）、`package.json`、`scripts/gen-pdf-font.ts`

**Interfaces:**
- Consumes: `core/rng.createRng/levelSeed`、`core/generator.randomHamiltonianPath/greyOf`、`core/solver.solve`、`core/level-decode.{decodeLevel, derivePuzzle, primesToHintMask, hintMaskToPrimes, parseLevelFile}`、`core/path-codec.encodePath`、`core/validate.isSolved`、`types.{LevelRecord, LevelFile, CHALLENGE_CAP}`。
- Produces：
  - `gen-config.ts`：`export const GEN_CONFIG = { generator: 'backbite/1.0.0', masterSeed: 'prime-trail-v1', libraryVersion: 1, count: 1000, backbiteSteps: 100_000, edgeExtraMax: 10_000, easyBudget: 200_000, advBudget: 2_000_000, advFloor: 6, advRestarts: 3, candidates: 3, challengeCap: 1000, challengeBudget: 5_000_000, maxAttemptsPerLevel: 200 } as const`。
  - `lib/gen-level.ts`：`generateLevel(id: number, cfg: GenConfig): MetaRow`，`MetaRow = { id; attempt; seed; s; p; h; c; hintCount; candidates: { attempt; seed; c: number | null; nodes: number }[]; nodes: { easy: number; adv: number; chal: number }; ms: number; generator: string }`；內部流程 §4.4–§4.6（K 個候選各自以 `attempt` 連號取 seed；easy 不唯一就丟並 attempt+1；挑戰解數 cap/budget；選 `c` 最小（null 最大、平手 attempt 小）；對選中者 greedy 子集 ×3 重啟，floor 6，用該候選的 rng 洗牌順序）。`greedyHintMask(level: Level, rng: Rng, cfg): number` 單獨匯出以便測試。
  - `lib/meta.ts`：`readMeta(path): Map<number, MetaRow>`（同 id 以最後一行為準；壞行跳過並計數）、`appendMeta(path, row): void`（`appendFileSync` 一行 JSON + `\n`）。
  - `lib/assemble.ts`：`assemble(rows: Map<number, MetaRow>, cfg): LevelFile`（缺任一 id 1…count 丟 `Error` 列出缺號；輸出 `levels` 僅含 `{s,p,h,c,seed}`）、`verifyLevelFile(file: LevelFile): string[]`（回傳錯誤訊息陣列；檢查 §12.1 廉價項 + 每張 easy／advanced 唯一（此為 §4.8 完整檢查，慢））、`sha256Hex(text: string): string`、`writeLevelFiles(file, { jsonPath, hashPath })`（`levels.json` 以 `JSON.stringify(file)` 無縮排 + `\n`；`levels.hash.txt` 第一行 sha256、第二行 `libraryVersion=<n>`）。
  - `lib/cli.ts`：`parseArgs(argv: string[]): { ids: number[]; workers: number; recompute: ('h'|'c')[]; assemble: boolean; partial: boolean }`（預設 ids 1…count、workers = `os.availableParallelism()`）。
  - `gen-levels.ts`：主流程——讀 meta、跳過已完成 id、以 `worker_threads` 分派剩餘 id（每完成一張主執行緒 `appendMeta`）、結束時若 1…count 全齊則 `verifyLevelFile` 無錯才 `writeLevelFiles`，並印統計（hintCount 分布、c 分布、null 數、SHA-256）；`--partial` 寫 `src/data/levels.partial.json`（不驗唯一）；`--recompute` 只在 `levels.json` 不存在時允許，否則拒絕並退出碼 2。

**驗收指令：**
- `pnpm vitest run scripts/__tests__`
- `pnpm gen:levels --ids 1-3 --workers 1 --partial`（應寫入 meta 三行與 `levels.partial.json`，不得產生 `src/data/levels.json`；結束後 `git checkout -- src/data 2>/dev/null; rm -f src/data/levels.meta.jsonl src/data/levels.partial.json` 清掉產物不 commit）
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 測試全綠；`--ids 1-3` 試跑輸出尾段（含每張耗時）貼進回報；試跑產物不 commit；草稿寫 `drafts/C1.md`（含實測每張耗時，供 D4 估時）。

- [ ] **Step 1: 寫失敗測試**
  - `meta.test.ts`（用 `os.tmpdir()`）：`appendMeta` 兩行後 `readMeta` 得 2 筆；同 id 追加第二行後以後者為準；夾一行 `{bad json` 跳過且其他可讀。
  - `assemble.test.ts`：以 `FIXTURE_RECORD` 為基礎造 3 筆 row、`cfg.count=3` → `assemble` 成功、`levels.length===3`、`schema===1`、`libraryVersion===1`；缺 id 2 → 丟錯訊息含 `2`；`sha256Hex('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`；`writeLevelFiles` 後讀回 hash 檔兩行格式正確且第一行等於 `sha256Hex(json 內容)`；`verifyLevelFile` 對 3 張 fixture 回傳 `[]`（easy 唯一已驗證），把其中一張 `h` 改成 `33554304`（2 解）→ 回傳含 `advanced` 字樣的錯誤。
  - `gen-level.test.ts`：`generateLevel(1, { ...GEN_CONFIG, backbiteSteps: 2000, candidates: 1, challengeBudget: 50_000, advBudget: 200_000, advRestarts: 1 })` 回傳 row：`p` 匹配 `/^[UDLR]{99}$/`、`isEdge(s)`、`decodeLevel` 後 easy `solve` 唯一、`hintCount >= 6`、`seed === levelSeed('prime-trail-v1', 1, row.attempt)`；同參數跑兩次深等於（可重現）；`greedyHintMask(fixtureLevel, createRng(1), {advFloor:6, advBudget:2_000_000})` 的 popcount 恰為 6（fixture 只給 17 即唯一，floor 會綁住）且含 17 或其超集仍唯一（用 `solve` 驗 `count===1`）。
  - `cli.test.ts`：`parseArgs(['--ids','1-3,7'])` 得 `[1,2,3,7]`；`--workers 2`；`--recompute h,c`；預設 ids 長度 1000。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**；worker 以 `new Worker(new URL('./lib/worker.ts', import.meta.url), { execArgv: ['--import', 'tsx'] })` 或由 tsx 直接支援，實作者擇一並在草稿記錄。
- [ ] **Step 4: 跑測試確認通過**（三條驗收指令）
- [ ] **Step 5: Commit**

### Task C2: 棋盤元件（GameBoard／BoardCell／HeadMarker）與 board.scss

**Files:**
- Create: `src/components/board/GameBoard.vue`、`src/components/board/BoardCell.vue`、`src/components/board/HeadMarker.vue`、`src/styles/board.scss`
- Modify: `src/i18n/zh-TW/board.ts`、`src/i18n/zh-TW/conflict.ts`
- Test: `src/components/board/__tests__/BoardCell.test.ts`、`src/components/board/__tests__/GameBoard.test.ts`、`src/components/board/__tests__/HeadMarker.test.ts`

**禁區：** `src/core/**`、`src/composables/**`、`src/views/**`、其他 i18n 命名空間、`src/styles/main.scss`、`package.json`

**Interfaces:**
- Consumes: `types.{Puzzle, Cell, ConflictKind, InputMode}`、`geometry.{rowOf, colOf, edgeSides}`、`primes.isPrime`、`i18n.t`、fixture。
- Produces（照 §6.1–§6.3）：
  - `GameBoard.vue` props：`puzzle: Puzzle`、`grid: Uint8Array`、`conflicts: ReadonlyMap<Cell, ConflictKind[]>`、`selected: Cell | null`、`head: Cell | null`、`highlight: Cell | null`、`mode: InputMode`、`readonly: boolean`；emits：`press(cell: Cell)`、`drag(cell: Cell)`、`dragend()`、`key(e: KeyboardEvent)`；`defineExpose({ shake(cell: Cell): void; focus(): void })`。根元素 `.pt-board[data-mode][tabindex="0"]`，`style="--cell: ..."` 由 scss 的 clamp 給；格子 `button.pt-cell[data-cell="<n>"]`，狀態 class：`is-start`、`is-prime`、`is-given`、`is-selected`、`is-head`、`is-highlight`、`is-conflict`、`is-shake`；`aria-label` 用 `board.cellLabel`。事件：在 `.pt-board` 上委派 `pointerdown`（emit `press`；`mode==='trail' && !readonly` 時 `setPointerCapture` 開始拖曳）、`pointermove`（拖曳中以 `elementFromPoint` 或矩形運算找格，只在進入**不同於上一格**時 emit `drag`；離開棋盤不 emit）、`pointerup`／`pointercancel`（emit `dragend`）、`keydown`（emit `key`）。`readonly` 時不 emit 任何事件。
  - `BoardCell.vue` props：`value: number`、`kind: 'start' | 'prime' | 'normal'`、`given: boolean`、`selected: boolean`、`head: boolean`、`highlight: boolean`、`conflict: boolean`、`shake: boolean`、`cell: Cell`；無 emits。
  - `HeadMarker.vue` props：`start: Cell`；每個 `edgeSides(start)` 畫一個 `.pt-head-marker.pt-head-marker--<side>`，以 CSS 變數 `--row`、`--col` 定位。
  - `board.scss`：`.pt-board` 為 `display:grid; grid-template-columns: repeat(11, var(--cell))` 的 11×11（外框帶半格由 `grid-template` 的首末行列為 `calc(var(--cell)/2)`）；`--cell: clamp(30px, calc((100vw - 16px) / 11), 48px)`；`.pt-cell` reset（`appearance:none; border:0; padding:0; font:inherit; font-size: calc(var(--cell)*0.42); font-variant-numeric: tabular-nums; user-select:none`）；顏色 `#9e9e9e`／`#e0e0e0`／`#fff`／`#dc3545`；`.pt-board[data-mode="trail"] { touch-action: none }`、`[data-mode="direct"] { touch-action: pan-y }`；`.is-shake` 150 ms keyframes。

**驗收指令：**
- `pnpm vitest run src/components/board/__tests__`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 測試全綠；草稿寫 `drafts/C2.md`。

- [ ] **Step 1: 寫失敗測試**（`puzzle = fixturePuzzle(PRIMES)`）
  - `BoardCell.test.ts`：`kind='start'` → class `is-start`；`given` → `is-given`；`value=0` 文字為空；`value=100` 顯示 `100`；`conflict` → `is-conflict`。
  - `HeadMarker.test.ts`：`start=8` 渲染 1 個 marker 且 class 含 `--top`；`start=0` 渲染 2 個（top、left）；`start=99` 渲染 2 個（bottom、right）。
  - `GameBoard.test.ts`：渲染 100 個 `.pt-cell`；`data-cell="9"` 有 `is-prime`、`data-cell="8"` 有 `is-start`；given 格文字正確；`pointerdown` 於 `[data-cell="18"]` → emits `press` `[18]`；trail 模式：`pointerdown` 18 後對 `[data-cell="28"]` 派 `pointermove`（jsdom 下用 `vi.spyOn(document,'elementFromPoint')` 或 stub 矩形）→ emits `drag` `[28]`；同格再 `pointermove` 不重複 emit；`pointercancel` → emits `dragend`；direct 模式 `pointermove` 不 emit `drag`；`readonly` 時 `pointerdown` 不 emit；`keydown ArrowUp` 於 `.pt-board` → emits `key`；`conflicts` 含 18 → `[data-cell="18"]` 有 `is-conflict`；`shake(18)` 後有 `is-shake`，`vi.advanceTimersByTime(150)` 後消失；根元素 `data-mode` 等於 `mode`；`aria-label` 含 `t('board.cellLabel', ...)` 的結果。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task C3: `useGame` 與 `useTimer`

**Files:**
- Create: `src/composables/useGame.ts`、`src/composables/useTimer.ts`
- Test: `src/composables/__tests__/useTimer.test.ts`、`src/composables/__tests__/useGame.trail.test.ts`、`src/composables/__tests__/useGame.direct.test.ts`、`src/composables/__tests__/useGame.restore.test.ts`

**禁區：** `src/core/**`、`src/components/**`、`src/views/**`、`src/i18n/**`、其他 composables、`package.json`

**Interfaces:**
- Consumes: `types.*`、`validate.{findConflicts, conflictMap, isFull, isSolved, headOf, cellOfNumber}`、`level-decode.derivePuzzle`、`geometry.{step, adjacent}`；fixture + `decodeLevel(FIXTURE_RECORD, 1)`。
- Produces：
  - `useTimer(opts?: { now?: () => number; doc?: Document | null }): Timer`，`Timer = { elapsedMs: Ref<number>; running: Ref<boolean>; start(): void; pause(): void; resume(): void; stop(): void; reset(ms?: number): void; dispose(): void }`；`start()` 在 `running` 已真時 no-op；監聯 `visibilitychange`：`hidden` → 內部暫停但保留「使用者意圖為執行」，`visible` → 續跑；`elapsedMs` 由 `requestAnimationFrame` 或 250 ms interval 更新，且在 `pause/stop` 時精確結算（`now()` 差值）。
  - `useGame(level: Level, difficulty: Difficulty, saved?: SavedProgress | null, deps?: { timer?: Timer }): Game`，`Game = { state: GameState（reactive，readonly 對外）; puzzle: Puzzle; head: ComputedRef<number>; headCell: ComputedRef<Cell | null>; conflicts: ComputedRef<Map<Cell, ConflictKind[]>>; isFull: ComputedRef<boolean>; elapsedMs: Ref<number>; place(cell, n): boolean; clear(cell): boolean; undo(): boolean; reset(): void; markAssisted(): void; trailPress(cell): 'placed' | 'retreated' | 'rejected'; trailStep(dir: Direction): 'placed' | 'rejected'; select(cell: Cell | null): void; digit(d: number): boolean; backspace(): void; confirmPending(): boolean; setInputMode(m: InputMode): void; toggleInputMode(): void; hint(): { cell: Cell; divergedAt: number | null } | null; snapshot(): SavedProgress }`。`GameState` 照 §7.2。語意照 §7.3、§5.6：`place` 於 given 或 `n∉[1,100]` 回 false；成功則 `steps++`、推 `Move`、`status='playing'`、timer `start()`；填滿且 `isSolved` → `status='won'`、timer `stop()`；`clear`/`undo` 不計步；`reset()` 保留 `assisted`、`status='idle'`、timer `reset(0)`；`trailPress`：目標為空且與 `headCell` 相鄰 → `place(cell, head+1)` 回 `'placed'`；目標為 `head-1` 的格且 head 格非 given → `clear(headCell)` 回 `'retreated'`；其他 `'rejected'`；`trailStep(dir)`：`step(headCell, dir)` 存在、為空、非 given → place；`digit`：`pending` 長度 < 3、首位不為 0、新值 ≤ 100 才接受；`confirmPending`：`pending` 非空且 `selected` 非 null → `place`；`hint()`：`head===100` 回 null；所有已填格與 `level.numberAt` 一致 → `{cell: level.cellOf[head], divergedAt: null}`；否則 `{cell: cellOfNumber(grid, n), divergedAt: n}`，n 為最小不一致數字；兩者皆 `markAssisted()`；`snapshot()` 回 `{grid: Array.from(grid), steps, elapsedMs, assisted, inputMode, savedAt: new Date().toISOString()}`。以 `saved` 建構：還原 grid／steps／assisted／inputMode、`timer.reset(saved.elapsedMs)` 且不啟動、`status` 為 `'playing'`（若 grid 只有 given 則 `'idle'`）。

**驗收指令：**
- `pnpm vitest run src/composables/__tests__/useTimer.test.ts src/composables/__tests__/useGame.trail.test.ts src/composables/__tests__/useGame.direct.test.ts src/composables/__tests__/useGame.restore.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 四個測試檔全綠；草稿寫 `drafts/C3.md`。

- [ ] **Step 1: 寫失敗測試**（`level = decodeLevel(FIXTURE_RECORD, 1)`；fake timers 與可注入 `now`）
  - `useTimer.test.ts`：`start()` 後推進 1000 ms → `elapsedMs` 介於 900–1100；`pause()` 後推進不變；`resume()` 續加；`reset(61_000)` → `elapsedMs===61_000 && running===false`；模擬 `document.hidden=true` + `visibilitychange` → 推進 1000 ms 不變；`hidden=false` → 續加（Review Focus 6）。
  - `useGame.trail.test.ts`（`difficulty='challenge'`，給定只有 1）：初始 `head===1`、`headCell===8`；`trailPress(9)` → `'placed'`、`grid[9]===2`、`steps===1`、`status==='playing'`、timer running；`trailPress(50)`（不相鄰）→ `'rejected'`、`steps` 不變；`trailPress(8)`（head-1 的格）→ `'retreated'`、`grid[9]===0`、`steps===1`；依 `FIXTURE_PATH` 連 `trailPress` 到 100 → `status==='won'`、`isFull`、`conflicts.size===0`、timer 停；`difficulty='easy'`：依路徑填 2…10 的非 given（2,3,5,7 為 given 跳過）後 `head===11`（given 跳過，Review Focus 1）；構造：填 8、9 後把 10 放到與 11 的格不相鄰的空格 → `head===11`，`conflicts` 含 10 的格與 11 的格各有 `nonAdjacent`；`trailStep('D')` 從 `headCell` 延伸；`trailStep` 到越界／非空／given → `'rejected'`；`undo()` 還原最後一格、`steps` 不變；`markAssisted()` 兩次仍 `assisted===true`；`hint()` 在一致狀態回 `{cell: level.cellOf[head], divergedAt: null}` 並設 `assisted`；填錯一格後 `hint().divergedAt` 為該數字。
  - `useGame.direct.test.ts`（`easy`）：`select(18)`；`digit(0)` 回 false 且 `pending===''`；`digit(1); digit(0); digit(0)` → `pending==='100'`；`confirmPending()` → `grid[18]===100`、`steps===1`、`pending===''`；重設後 `digit(1); digit(0); digit(1)` → 第三次 false、`pending==='10'`（Review Focus 2）；`pending='1'` 時 `confirmPending` 填 1；`select(9)`（given）後 `confirmPending` 回 false；`backspace()`：`pending` 非空刪一字元，空時清除 `selected` 的值（非 given）；`place(18, 4)` 覆寫 `place(18, 6)` → `steps===2`；重複：`place(18,4)` 與 `place(28,4)` → 兩格 `duplicate`；`place(18, 3)` → `parity`；`toggleInputMode()` 切換 `inputMode`。
  - `useGame.restore.test.ts`：`saved = { grid: Array.from(fixtureGrid 前 30 個數字), steps: 29, elapsedMs: 61_000, assisted: true, inputMode: 'direct', savedAt }` → `state.steps===29`、`elapsedMs===61_000`、`timer.running===false`、`assisted===true`、`inputMode==='direct'`、`status==='playing'`；下一次 `place` 後 `running===true`（Review Focus 6）；`snapshot()` 回傳欄位完整且 `grid.length===100`；`reset()` 後 `steps===0`、`elapsedMs===0`、`status==='idle'`、`assisted` 仍 true、given 仍在。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task C4: 儲存層 composable（levelStore／records／progress／settings）

**Files:**
- Create: `src/composables/storage.ts`、`src/composables/useLevelStore.ts`、`src/composables/useRecords.ts`、`src/composables/useProgress.ts`、`src/composables/useSettings.ts`
- Test: `src/composables/__tests__/storage.test.ts`、`src/composables/__tests__/useLevelStore.test.ts`、`src/composables/__tests__/useRecords.test.ts`、`src/composables/__tests__/useProgress.test.ts`、`src/composables/__tests__/useSettings.test.ts`

**禁區：** `src/core/**`、`src/components/**`、`src/views/**`、`src/i18n/**`、`useGame.ts`、`useTimer.ts`、`useToast.ts`、`useConfirm.ts`、`package.json`

**Interfaces:**
- Consumes: `types.*`、`level-decode.{decodeLevel, parseLevelFile}`、fixture。
- Produces：
  - `storage.ts`：`storageKey(name: 'records' | 'progress' | 'lastPlayed', libraryVersion: number): string`（`prime-trail:v1:L${libraryVersion}:${name}`）；`SETTINGS_KEY = 'prime-trail:v1:settings'`；`readJson<T>(key: string, guard: (v: unknown) => v is T, storage?: Storage): T | null`（缺值、JSON 壞、guard 不過皆回 null，不丟錯）；`writeJson(key, value, storage?)`；`removeKey(key, storage?)`。
  - `useLevelStore()`（模組層單例）：`{ status: Ref<'idle' | 'loading' | 'ready' | 'missing' | 'error'>; libraryVersion: Ref<number | null>; count: Ref<number>; load(): Promise<void>; getLevel(id: number): Level; randomId(rand?: () => number): number; __setLoader(fn: () => Promise<unknown>): void }`。載入用 `import.meta.glob('../data/levels.json', { eager: false })`：無匹配 → `status='missing'`；有 → 動態 import → `parseLevelFile` → `ready`；解析錯 → `error`。`getLevel` 在非 ready 丟 `Error`；id 超界丟 `RangeError`；解碼結果以 `Map` 快取。`__setLoader` 供測試注入。
  - `useRecords(libraryVersion: number, storage?: Storage)`：`{ get(levelId, difficulty): RecordEntry | null; completion(levelId, difficulty): Completion; recordClear(levelId, difficulty, result: { elapsedMs: number; steps: number; assisted: boolean }): { entry: RecordEntry; isNewBest: { time: boolean; steps: boolean } }; all(): Readonly<Record<string, RecordEntry>> }`；key `${levelId}:${difficulty}`；規則 §7.4／§7.5：assisted → `assistedClears++`、不動 best、`isNewBest` 皆 false；非 assisted → `clears++`、`bestMs = min`、`bestSteps = min`、各自 `isNewBest`（首次設定也算 true）；`completion`：`clears>0` → `'cleared'`，否則 `assistedClears>0` → `'assisted'`，否則 `'none'`。
  - `useProgress(libraryVersion: number, storage?: Storage)`：`{ load(levelId, difficulty, puzzle: Puzzle): SavedProgress | null; save(levelId, difficulty, snap: SavedProgress): void; remove(levelId, difficulty): void; lastPlayed(): LastPlayed | null; has(levelId, difficulty): boolean }`；`load` 檢查 `grid.length===100`、每個 given `grid[cell]===value`、所有值在 0–100，不符 → `remove` 並回 null；`save` 寫 `progress[key]`、超過 20 筆依 `savedAt` 淘汰最舊、同時寫 `lastPlayed={levelId,difficulty,savedAt}`；`remove` 刪該筆，若 `lastPlayed` 指向它則寫 null。
  - `useSettings(storage?: Storage)`（模組層單例）：`{ inputMode: Ref<InputMode>; locale: Ref<'zh-TW'> }`，變更即寫 `SETTINGS_KEY`；壞值回預設 `'trail'`。

**驗收指令：**
- `pnpm vitest run src/composables/__tests__/storage.test.ts src/composables/__tests__/useLevelStore.test.ts src/composables/__tests__/useRecords.test.ts src/composables/__tests__/useProgress.test.ts src/composables/__tests__/useSettings.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 五個測試檔全綠；草稿寫 `drafts/C4.md`。

- [ ] **Step 1: 寫失敗測試**（每測前 `localStorage.clear()`）
  - `storage.test.ts`：`storageKey('records', 1)==='prime-trail:v1:L1:records'`；`readJson` 對 `'{bad'` 回 null 不丟；guard 失敗回 null；`writeJson` 後可讀回。
  - `useLevelStore.test.ts`：預設（無檔）`load()` 後 `status==='missing'`（若實作環境 `import.meta.glob` 在測試中有匹配，改以 `__setLoader(() => Promise.reject())` 驗 `error`）；`__setLoader(async () => ({ schema:1, libraryVersion:1, generator:'t', masterSeed:'s', count:1, levels:[FIXTURE_RECORD] }))` → `ready`、`libraryVersion.value===1`、`getLevel(1).start===8`、`getLevel(1)===getLevel(1)`（快取）、`getLevel(2)` 丟 `RangeError`；`randomId(() => 0)===1`、`randomId(() => 0.9999)===count`；schema 2 → `error`。
  - `useRecords.test.ts`：Review Focus 4 的三段序列：assisted 過關 → `{clears:0, assistedClears:1, bestMs:null, bestSteps:null}`、`completion==='assisted'`、`isNewBest` 皆 false；非 assisted `{elapsedMs:90_000, steps:80}` → `clears===1`、`bestMs===90_000`、`bestSteps===80`、`isNewBest.time && isNewBest.steps`、`completion==='cleared'`；再非 assisted `{elapsedMs:120_000, steps:75}` → `bestMs===90_000`、`bestSteps===75`、`isNewBest={time:false, steps:true}`；不同 `libraryVersion` 建的實例讀不到（`get` 為 null）；壞 JSON 不丟。
  - `useProgress.test.ts`：`save` 後 `load` 深等於；`lastPlayed()` 指向它；`remove` 後 `load` null 且 `lastPlayed()` null；存 21 筆後最舊的 `has` 為 false、其餘 20 筆在；Review Focus 3：`grid.length 99` → load null 且已刪除；given 格值不符（把 cell 8 設 2）→ null；`libraryVersion` 2 的實例讀不到 1 的存檔。
  - `useSettings.test.ts`：預設 `'trail'`；設 `'direct'` 後新實例（清模組快取或暴露 `__reset`）讀回 `'direct'`；壞值回預設。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task C5: PDF 產生、字型子集與 `usePdfExport`

**Files:**
- Create: `src/pdf/renderPuzzlePdf.ts`、`src/pdf/font-loader.ts`、`src/pdf/labels.ts`、`src/pdf/labels-en.ts`、`src/composables/usePdfExport.ts`、`scripts/gen-pdf-font.ts`、`public/fonts/pdf-zh.subset.ttf`、`public/fonts/OFL.txt`
- Modify: `src/i18n/zh-TW/pdf.ts`
- Test: `src/pdf/__tests__/renderPuzzlePdf.test.ts`、`src/pdf/__tests__/pdf-font-coverage.test.ts`、`src/composables/__tests__/usePdfExport.test.ts`

**禁區：** `src/core/**`、`src/components/**`、`src/views/**`、其他 i18n 命名空間、其他 composables、`scripts/gen-levels.ts`、`scripts/lib/**`、`package.json`

**Interfaces:**
- Consumes: `types.{Level, Difficulty}`、`geometry.{rowOf, colOf, edgeSides}`、`primes.isPrime`、`i18n.t`、`useToast`、fixture + `decodeLevel`。
- Produces：
  - `labels.ts`：`export interface PdfLabels { title: string; level: string; difficulty: string; difficultyName: string; legendHead: string; legendPrime: string; solutionTitle: string }`；`pdfLabelsFromI18n(difficulty): PdfLabels`；`labels-en.ts`：`PDF_LABELS_EN: Omit<PdfLabels,'difficultyName'> & { difficultyNames: Record<Difficulty,string> }`。
  - `renderPuzzlePdf(input: { level: Level; difficulty: Difficulty; includeSolution: boolean; labels: PdfLabels; font: { family: string; data: ArrayBuffer } | null }): Promise<Blob>`（jsPDF `{ unit:'mm', format:'a4' }`；§6.9 幾何常數；`font===null` 時所有文字用 Helvetica；`includeSolution` 加第二頁）；`pdfFilename(levelId: number, difficulty: Difficulty): string`（`prime-trail-${id 補零 4 位}-${difficulty}.pdf`）；為測試另匯出 `renderPuzzlePdfDoc(...)` 回 jsPDF 實例（可 `getNumberOfPages()`）。
  - `font-loader.ts`：`loadPdfFont(fetchImpl: typeof fetch = fetch, url = '/fonts/pdf-zh.subset.ttf'): Promise<{ family: 'PrimeTrailZh'; data: ArrayBuffer } | null>`（非 2xx 或例外回 null，模組層快取成功結果）。
  - `usePdfExport(): { busy: Ref<boolean>; exportPdf(level: Level, difficulty: Difficulty, includeSolution: boolean, deps?: { download?: (blob: Blob, filename: string) => void; fetchImpl?: typeof fetch }): Promise<boolean> }`：載字型（失敗 → 用 `PDF_LABELS_EN` 並 `toast(t('pdf.fontFallback'))`）、產生、`download`（預設建 `<a download>` 點擊）、回 true；例外 → toast danger、回 false。
  - `scripts/gen-pdf-font.ts`：從 `.cache/fonts/NotoSansTC-Regular.ttf` 讀來源（不存在則從 Google Fonts 的 noto-cjk GitHub release 下載到 `.cache/`，已在 `.gitignore`），以 `subset-font` 子集化，字元集 = `zhTW.pdf` 與 `zhTW.difficulty` 所有葉節點字元 ∪ `0-9#:・.- ` ∪ `Prime Trail`，寫 `public/fonts/pdf-zh.subset.ttf`，印出字元數與檔案大小；`public/fonts/OFL.txt` 放 SIL OFL 1.1 全文。

**驗收指令：**
- `pnpm gen:pdf-font`（產生子集；需要網路下載來源字型一次；若 worker 無網路，寫進回報「沒做的事」並讓覆蓋率測試對缺檔 `skipIf` 印原因）
- `pnpm vitest run src/pdf/__tests__ src/composables/__tests__/usePdfExport.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`
- `ls -la public/fonts/pdf-zh.subset.ttf`（期望 10–60 KB）

**完成證據：** 字型子集檔與 OFL 進 commit；三個測試檔全綠；草稿寫 `drafts/C5.md`（記字型來源 URL 與字元數）。

- [ ] **Step 1: 寫失敗測試**
  - `renderPuzzlePdf.test.ts`（jsdom 環境、`level=decodeLevel(FIXTURE_RECORD,123)`、`font:null`）：`includeSolution:false` → doc 頁數 1；`true` → 2；`blob.size > 1000`；讀 blob 前 5 bytes 為 `%PDF-`；`pdfFilename(123,'advanced')==='prime-trail-0123-advanced.pdf'`；用 `vi.spyOn(doc,'text')` 驗第一頁 easy 下 `text` 呼叫含 `'97'` 共 1 次、challenge 下不含 `'97'`、兩者都含 `'1'`；用 `vi.spyOn(doc,'triangle')` 驗 start=8 呼叫 1 次、start=0 的構造 level 呼叫 2 次；`setFillColor` 被以 55% 灰與 85% 灰各至少呼叫一次。
  - `pdf-font-coverage.test.ts`：`describe.skipIf(!existsSync('public/fonts/pdf-zh.subset.ttf'))`；以 `fontkit.openSync` 讀 cmap，對 `zhTW.pdf`、`zhTW.difficulty` 所有字元與 `'Prime Trail 0123456789#:・'` 斷言 `font.hasGlyphForCodePoint(cp)`；檔案 < 100 KB。
  - `usePdfExport.test.ts`：注入 `fetchImpl` 回 `{ ok:false }` → `download` 被呼叫一次、檔名正確、`toast` 有 `t('pdf.fontFallback')`、回 true；`fetchImpl` 回 `{ ok:true, arrayBuffer: () => new ArrayBuffer(8) }` 時若 jsPDF `addFont` 丟錯要被捕捉並退回 Helvetica（測試：仍 download）；`busy` 在執行中為 true、結束 false。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task C6: 純 props/emits 元件（NumberPad、InputModeToggle、StatusBar、LevelPicker、DifficultyPicker、WinModal、PdfExportDialog）

**Files:**
- Create: `src/components/input/NumberPad.vue`、`src/components/input/InputModeToggle.vue`、`src/components/ui/StatusBar.vue`、`src/components/picker/LevelPicker.vue`、`src/components/picker/DifficultyPicker.vue`、`src/components/game/WinModal.vue`、`src/components/game/PdfExportDialog.vue`、`src/components/format.ts`（`formatMs(ms): 'mm:ss'`、`padId(id): '0123'`）
- Modify: `src/i18n/zh-TW/input.ts`、`status.ts`、`picker.ts`、`win.ts`
- Test: `src/components/__tests__/NumberPad.test.ts`、`InputModeToggle.test.ts`、`StatusBar.test.ts`、`LevelPicker.test.ts`、`DifficultyPicker.test.ts`、`WinModal.test.ts`、`PdfExportDialog.test.ts`、`format.test.ts`（皆在 `src/components/__tests__/`）

**禁區：** `src/core/**`、`src/composables/**`（只 import `useConfirm`）、`src/components/board/**`、`src/components/ui/Bs*.vue`、`src/views/**`、其他 i18n 命名空間、`package.json`

**Interfaces:**
- Consumes: `types.*`、`i18n.t`、`BsModal`、`useConfirm`。
- Produces（照 §6.4–§6.7、§6.9）：
  - `NumberPad.vue` props `{ disabled: boolean; pending: string }`，emits `digit(d: number)`、`clear()`、`confirm()`；按鍵 `button[data-key="0".."9"|"clear"|"confirm"]`；顯示 `pending`。
  - `InputModeToggle.vue` props `{ modelValue: InputMode }`，emits `update:modelValue(InputMode)`；兩個 radio-like 按鈕 `[data-mode]`。
  - `StatusBar.vue` props `{ levelId: number; difficulty: Difficulty; elapsedMs: number; steps: number; assisted: boolean }`；渲染 `地圖 #0123・進階・12:34・步數 57`；`assisted` 時 `.badge[data-assisted]` 文字 `t('status.assisted')`。
  - `DifficultyPicker.vue` props `{ modelValue: Difficulty; completion: Record<Difficulty, Completion>; best: Record<Difficulty, RecordEntry | null> }`，emits `update:modelValue`；每個難度一個 `[data-difficulty]`，含 `[data-completion="cleared"|"assisted"|"none"]` 標記與最佳值文字。
  - `LevelPicker.vue` props `{ count: number; completion: (id: number, d: Difficulty) => Completion; best: (id, d) => RecordEntry | null; lastPlayed: LastPlayed | null; canResume: boolean }`，emits `start(levelId: number, difficulty: Difficulty)`、`resume(levelId, difficulty)`、`random()`（父層決定隨機 id 並回填 `modelValue`）；另 prop `modelValue: number | null` + `update:modelValue`；編號不在 1…count 時「開始」disabled 並顯示 `picker.invalidId`；`canResume` 才顯示「繼續上次」及 `#0123・進階`。
  - `WinModal.vue` props `{ modelValue: boolean; levelId; difficulty; elapsedMs; steps; best: { bestMs: number | null; bestSteps: number | null } | null; isNewBest: { time: boolean; steps: boolean }; assisted: boolean }`，emits `update:modelValue`、`viewSolution()`、`nextRandom()`、`backHome()`、`exportPdf()`；標題 `assisted ? t('win.titleAssisted') : t('win.title')`；assisted 時無 `[data-new-best]` 徽章且顯示 `win.notRecorded`。
  - `PdfExportDialog.vue` props `{ modelValue: boolean; gameStatus: GameStatus }`，emits `update:modelValue`、`export(options: { includeSolution: boolean })`、`markAssisted()`；勾選「附解答頁」且 `gameStatus==='playing'` 時先 `useConfirm().confirm(t('pdf.confirmSolution'))`，true → emit `markAssisted()` 後保持勾選，false → 取消勾選；按匯出 emit `export({includeSolution})`。
- 所有文字走 `t()`。

**驗收指令：**
- `pnpm vitest run src/components/__tests__`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 八個測試檔全綠；草稿寫 `drafts/C6.md`。

- [ ] **Step 1: 寫失敗測試**
  - `format.test.ts`：`formatMs(754_000)==='12:34'`、`formatMs(0)==='00:00'`、`formatMs(3_600_000)==='60:00'`；`padId(7)==='0007'`、`padId(1000)==='1000'`。
  - `NumberPad.test.ts`：點 `[data-key="7"]` → emits `digit` `[7]`；`clear`／`confirm` 各一次；`disabled` 時按鈕皆 disabled；`pending='100'` 顯示 `100`（Review Focus 2）。
  - `InputModeToggle.test.ts`：點 `[data-mode="direct"]` → emits `update:modelValue` `['direct']`。
  - `StatusBar.test.ts`：props `{levelId:123, difficulty:'advanced', elapsedMs:754_000, steps:57, assisted:false}` 文字含 `地圖 #0123`、`進階`、`12:34`、`步數 57`；`assisted:true` 出現 `[data-assisted]`。
  - `DifficultyPicker.test.ts`：三個 `[data-difficulty]`；`completion.easy='cleared'` → `[data-difficulty="easy"] [data-completion="cleared"]`；`'assisted'` → 文字含 `輔助完成`；點 `advanced` → emits。
  - `LevelPicker.test.ts`：`modelValue=0` → 開始 disabled 與 `invalidId` 文字；`modelValue=5` 點開始 → emits `start` `[5, <目前難度>]`；`canResume=true, lastPlayed={levelId:123,difficulty:'advanced'}` → 顯示 `#0123・進階`，點擊 emits `resume` `[123,'advanced']`；`canResume=false` 不渲染；點隨機 emits `random`。
  - `WinModal.test.ts`：`assisted=false, isNewBest.time=true` → 有 `[data-new-best="time"]`；`assisted=true` → 標題 `輔助完成`、無 `[data-new-best]`、有 `notRecorded` 文字；四個按鈕各 emit 對應事件。
  - `PdfExportDialog.test.ts`：`gameStatus='idle'` 勾選解答頁不呼叫 confirm、不 emit `markAssisted`；`gameStatus='playing'` 勾選 → `useConfirm().pending` 非 null；以 host 或直接 resolve 模擬確認 → emits `markAssisted`；取消 → checkbox 回 false；按匯出 → emits `export` `[{includeSolution:true}]`；`gameStatus='won'` 不確認。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task C7: 題庫完整性、凍結雜湊與慢測（帶 skipIf）

**Files:**
- Create: `src/data/__tests__/levels.integrity.test.ts`、`src/data/__tests__/levels.frozen.test.ts`、`src/data/__tests__/helpers.ts`（讀檔、`LEVELS_PATH`、`HASH_PATH`、`hasLevels()`、`sha256`）、`src/data/__slow__/levels.unique.test.ts`、`src/data/__slow__/levels.reproducible.test.ts`、`src/data/__slow__/levels.solutions.test.ts`
- Test: 以上即測試檔；另 `src/data/__tests__/helpers.test.ts`

**禁區：** `src/data/levels*.json`、`src/data/levels.meta.jsonl`、`src/data/levels.hash.txt`（本任務不得產生題庫）、`src/**`（非 `src/data/`）、`scripts/**`、`package.json`

**Interfaces:**
- Consumes: `types.*`、`level-decode.{parseLevelFile, decodeLevel, derivePuzzle, hintMaskToPrimes}`、`path-codec.isHamiltonianPath`、`geometry.{isEdge, manhattan}`、`solver.solve`、`generator.randomHamiltonianPath`、`rng.createRng`、`validate.isSolved`。
- Produces：測試檔本身；`helpers.ts` 匯出 `LEVELS_PATH = 'src/data/levels.json'`、`HASH_PATH = 'src/data/levels.hash.txt'`、`hasLevels(): boolean`、`readLevelFile(): LevelFile`、`readHashFile(): { sha256: string; libraryVersion: number }`、`sha256Hex(text): string`、`SAMPLE_IDS: readonly number[] = [1, 50, 100, 250, 333, 500, 666, 750, 900, 1000]`。
- `levels.integrity.test.ts` 與 `levels.frozen.test.ts` 頂層：`describe.skipIf(!hasLevels())('levels.json', ...)`，skip 時 `console.warn('levels.json 尚未生成（D4）, 跳過')`（**D4 任務會移除 skipIf**，此處要寫成單一行好刪）。
- `__slow__` 三檔同樣 `skipIf(!hasLevels())`。

**驗收指令：**
- `pnpm vitest run src/data/__tests__`（無題庫時應顯示 skipped 並印 warn；`helpers.test.ts` 必跑）
- 以 fixture 造一份假題庫驗測試本身：`helpers.test.ts` 內用 `vi.mock` 或環境變數 `PRIME_TRAIL_LEVELS_PATH` 指向 tmp 檔，含 3 張 fixture 的 `LevelFile`（`count:3`），斷言 integrity 的檢查函式對它回傳 `[]`、對 `h` 改壞的版本回傳錯誤；因此 integrity 的檢查邏輯要抽成 `helpers.ts` 的 `checkLevelFile(file: LevelFile): string[]`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** `pnpm test` 顯示題庫 describe 為 skipped 且 warn 出現；`helpers.test.ts` 全綠；草稿寫 `drafts/C7.md`。

- [ ] **Step 1: 寫失敗測試**
  - `helpers.test.ts`：`checkLevelFile` 對 3 張 fixture 檔回 `[]`；`schema:2` → 錯誤含 `schema`；`count` 不等 → 錯；`s=55`（非邊緣）→ 錯含 `levels[0].s`；`p` 改一字造成重訪 → 錯；`h=2**25` → 錯；`h` 含不在 grey 的質數——不可能（bit 對應質數格一定在 grey）改驗「`h` 的 bit 數 ≥ 1」為非必要故不驗；`c=0` → 錯、`c=1001` → 錯、`c=null` 通過；連續 given 曼哈頓可達以 easy puzzle 驗（fixture 必過）。
  - `levels.integrity.test.ts`：`checkLevelFile(readLevelFile())` 深等於 `[]`；`libraryVersion` 為正整數；`count===1000`；整檔執行 < 2 s（`expect(duration).toBeLessThan(2000)`）。
  - `levels.frozen.test.ts`：`sha256Hex(readFileSync(LEVELS_PATH,'utf8')) === readHashFile().sha256`；`readHashFile().libraryVersion === readLevelFile().libraryVersion`。
  - `__slow__/levels.unique.test.ts`：對每張 `solve(derivePuzzle(level,'easy'), {maxSolutions:2, maxNodes:200_000})` → `count===1 && exhausted`；`'advanced'` 以 `maxNodes:2_000_000` 同斷言；`hintMaskToPrimes(h).size >= 6`。
  - `__slow__/levels.reproducible.test.ts`：對 `SAMPLE_IDS` 每張以 `createRng(record.seed)` 跑 `randomHamiltonianPath(rng, {steps:100_000, edgeExtraMax:10_000})` → `encodePath` 等於 `record.p` 且 `[0]===record.s`（**注意**：此測試假設 C1 的 `generateLevel` 用「同一顆 rng 先產路徑」且未在產路徑前消耗亂數；C1 需遵守，D4 跑此慢測時若失敗即為 C1 的 bug）。
  - `__slow__/levels.solutions.test.ts`：對 20 張固定 id（`SAMPLE_IDS` ∪ 另 10 張）`solve(challenge, {maxSolutions:1, maxNodes:5_000_000, collect:true})`，有解則 `isSolved` 真。
- [ ] **Step 2: 跑測試確認失敗**（`helpers.test.ts` 因模組不存在失敗；其他 skipped）
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

---

## 層 D

### Task D1: PlayView 接線（輸入模式、鍵盤、回饋、恢復、過關、解答、PDF、E2E 鉤子）

**Files:**
- Modify: `src/views/PlayView.vue`、`src/main.ts`（呼叫 `installE2eHooks()`）、`src/i18n/zh-TW/play.ts`、`src/i18n/zh-TW/solution.ts`
- Create: `src/composables/usePlaySession.ts`、`src/components/game/SolutionView.vue`、`src/components/game/PlayActions.vue`、`src/e2e-hooks.ts`
- Test: `src/composables/__tests__/usePlaySession.test.ts`、`src/components/game/__tests__/SolutionView.test.ts`、`src/views/__tests__/PlayView.test.ts`

**禁區：** `src/core/**`、`src/components/board/**`、`src/components/input/**`、`src/components/picker/**`、`src/components/ui/**`、`src/views/HomeView.vue`、`src/router.ts`、`src/App.vue`、其他 composables、其他 i18n 命名空間、`src/data/**`、`package.json`

**Interfaces:**
- Consumes: `useGame`、`useTimer`、`useLevelStore`、`useRecords`、`useProgress`、`useSettings`、`useToast`、`useConfirm`、`usePdfExport`、`GameBoard`（含 `shake/focus`）、`NumberPad`、`InputModeToggle`、`StatusBar`、`WinModal`、`PdfExportDialog`、`BsModal`、`i18n.t`、`validate.gridEquals`、`geometry.DIRECTIONS`。
- Produces：
  - `usePlaySession(levelId: Ref<number>, difficulty: Ref<Difficulty>): Session`，`Session = { status: Ref<'loading' | 'missing' | 'error' | 'ready'>; game: ShallowRef<Game | null>; level: ShallowRef<Level | null>; restored: Ref<boolean>; onPress(cell): void; onDrag(cell): void; onKey(e: KeyboardEvent): void; requestRestart(): Promise<void>; requestViewSolution(): Promise<void>; showSolution: Ref<boolean>; hint(): void; winResult: Ref<{ entry: RecordEntry; isNewBest } | null>; shakeTarget: Ref<{ cell: Cell; seq: number } | null> }`。行為：`load` 題庫 → `getLevel` → `useProgress.load(id, d, puzzle)` → `useGame(level, d, saved)`；`saved` 非 null → `restored=true` 並 `toast(t('play.restored'))`；`watch(game.snapshot 相關狀態)` debounce 300 ms → `progress.save` + `lastPlayed`；`status==='won'` → `progress.remove`、`records.recordClear(...)`、`winResult` 設定、開 WinModal；`onPress`：trail → `trailPress`，`'rejected'` → shake；direct → `select`；`onDrag`：trail → `trailPress`（忽略 `'rejected'`）；`onKey`：trail 模式 Arrow* → `trailStep`（rejected → shake 目標格或 head 格）、Backspace/Delete → `undo`、Tab → `toggleInputMode` + `preventDefault`；direct 模式 0–9 → `digit`、Enter → `confirmPending`、Backspace/Delete → `backspace`、Arrow* → 移動 `selected`、Tab → toggle；兩模式 `Ctrl/Cmd+Z` → `undo`；填滿且有衝突 → `toast(t('play.remainingErrors', {n}))`（每次填滿只提示一次）；`requestRestart`：`confirm(t('play.restartConfirm'))` → `game.reset()` + `progress.remove`；`requestViewSolution`：首次 `confirm(t('solution.confirm'))` → `markAssisted` → `showSolution=true`（已 assisted 不再問）；`hint()`：`game.hint()` → 設 `GameBoard.highlight`，`divergedAt` 非 null 時 toast `play.hintDiverged`。
  - `SolutionView.vue` props `{ level: Level; puzzle: Puzzle; playerGrid: Uint8Array; solved: boolean }`，內部 toggle「我的填法／參考解」用 readonly `GameBoard`；`solved && !gridEquals(playerGrid, level.numberAt)` 顯示 `t('solution.alsoValid')`（`[data-also-valid]`）。
  - `PlayActions.vue` props `{ canUndo: boolean; inputMode: InputMode }`，emits `undo/clear/hint/restart/viewSolution/exportPdf/update:inputMode`。
  - `PlayView.vue`：路由 props `id: string`、`difficulty: Difficulty`；版面：棋盤（`:mode`、`:head`、`:selected`、`:conflicts`、`:highlight`）→ StatusBar → InputModeToggle → NumberPad（direct 才顯示）→ PlayActions；WinModal、SolutionView（BsModal 內）、PdfExportDialog；`status==='missing'` 顯示 `t('play.levelMissing')`。
  - `e2e-hooks.ts`：`installE2eHooks(store: ReturnType<typeof useLevelStore>): void`——`import.meta.env.VITE_E2E === '1'` 時掛 `window.__primeTrail = { solutionOf(id: number): number[] (cell 陣列), ready(): Promise<void> }`，否則 no-op。

**驗收指令：**
- `pnpm vitest run src/composables/__tests__/usePlaySession.test.ts src/components/game/__tests__/SolutionView.test.ts src/views/__tests__/PlayView.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 三個測試檔全綠；`pnpm dev` 下用 `useLevelStore.__setLoader` 無法手測，因此草稿記錄「以 `--partial` 題庫手測」步驟（`pnpm gen:levels --ids 1-3 --partial` 後暫時把 `levels.partial.json` 複製為 `levels.json` 手測，**不 commit**）；草稿寫 `drafts/D1.md`。

- [ ] **Step 1: 寫失敗測試**（`useLevelStore().__setLoader` 注入 fixture 題庫 `count:1`；fake timers）
  - `usePlaySession.test.ts`：無存檔 → `restored===false`、`game.value.state.status==='idle'`；先 `useProgress(1).save(1,'easy',snap)` 再建 session → `restored===true`、`useToast().toasts` 含 `已恢復進度`、`steps` 等於 snap（Review Focus 3 補強：存檔 given 不符 → 不恢復）；`onPress` 於 trail 模式對相鄰空格 → `grid` 變、推進 300 ms 後 `useProgress.has(1,'easy')` 真且 `lastPlayed()` 指向它；`onPress` 非相鄰 → `shakeTarget` 變；`onKey(ArrowDown)` 於 trail → 延伸；`onKey(Tab)` → `inputMode` 切換且 `preventDefault` 被呼叫；direct 模式 `onKey('1')`、`onKey('Enter')` → 填入；依 `FIXTURE_PATH` 填完 → `status==='won'`、`winResult` 非 null、`useRecords(1).get(1,'easy').clears===1`、`useProgress.has` 假、`lastPlayed()` null；assisted 情境：`requestViewSolution()` 後 resolve confirm → `assisted` 真、過關後 `assistedClears===1`、`bestMs===null`；`requestRestart()` 確認後 `steps===0` 且存檔消失；填滿但一格錯（把最後兩格互換）→ toast 含 `還有 2 格有錯` 且 `status!=='won'`；`hint()` 在一致狀態不 toast；偏離後 toast 含 `從`；`status` 於 store missing 時為 `'missing'`。
  - `SolutionView.test.ts`：`solved=false` 無 `[data-also-valid]`；`solved=true, playerGrid=fixtureGrid(FIXTURE_ALT_PATH)` 有；`playerGrid=fixtureGrid(FIXTURE_PATH)` 無；切換按鈕改變顯示的 grid（參考解下 cell 77 顯示 13）。
  - `PlayView.test.ts`：以 router 進 `/play/1/easy` mount → 渲染 `.pt-board`、`StatusBar`；`inputMode='direct'` 時 NumberPad 出現、`'trail'` 時不出現；store missing → 顯示 `levelMissing` 文字。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**（PlayView 只做組裝，邏輯在 `usePlaySession`）
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task D2: HomeView 接線（選圖、隨機、紀錄標記、繼續上次）

**Files:**
- Modify: `src/views/HomeView.vue`、`src/i18n/zh-TW/home.ts`
- Test: `src/views/__tests__/HomeView.test.ts`

**禁區：** `src/core/**`、`src/components/**`、`src/views/PlayView.vue`、`src/composables/**`、`src/router.ts`、`src/App.vue`、`src/main.ts`、其他 i18n 命名空間、`src/data/**`、`package.json`

**Interfaces:**
- Consumes: `useLevelStore`（`load/status/count/libraryVersion/randomId`）、`useRecords`、`useProgress`、`LevelPicker`、`DifficultyPicker`、`i18n.t`、router。
- Produces：`HomeView.vue`——`onMounted` 載題庫；`status==='ready'` 才渲染 `LevelPicker`（`count`、`completion`、`best` 由 `useRecords(libraryVersion)` 提供，`lastPlayed` 與 `canResume = lastPlayed && progress.has(...)` 由 `useProgress`）；`random` → `modelValue = store.randomId()`；`start`／`resume` → `router.push({ name:'play', params:{ id, difficulty } })`；`missing` → 顯示 `t('play.levelMissing')`（可 import `play` 命名空間的鍵，但不改該檔）。

**驗收指令：**
- `pnpm vitest run src/views/__tests__/HomeView.test.ts`
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** 測試全綠；草稿寫 `drafts/D2.md`。

- [ ] **Step 1: 寫失敗測試**（注入 fixture 題庫 `count:1`）
  - 載入後渲染 `LevelPicker`；`useRecords(1).recordClear(1,'easy',{elapsedMs:1000,steps:74,assisted:false})` 後，輸入 1 → `[data-difficulty="easy"] [data-completion="cleared"]`；只有 assisted 過關 → `assisted`；`useProgress(1).save(1,'advanced',snap)` → 「繼續上次」顯示 `#0001・進階`，點擊 → `router.currentRoute.value.fullPath==='/play/1/advanced'`；按開始（id 1、easy）→ `/play/1/easy`；按隨機 → `modelValue` 在 1…count；store missing → 顯示 `levelMissing`。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 最小實作**
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task D4: 正式生成 1000 張題庫並凍結（長時間；可由人本機執行）

**Files:**
- Create: `src/data/levels.json`、`src/data/levels.meta.jsonl`、`src/data/levels.hash.txt`
- Modify: `src/data/__tests__/levels.integrity.test.ts`、`src/data/__tests__/levels.frozen.test.ts`、`src/data/__slow__/levels.unique.test.ts`、`src/data/__slow__/levels.reproducible.test.ts`、`src/data/__slow__/levels.solutions.test.ts`（各只移除 `skipIf` 與 warn 那一行）
- Test: 以上既有測試

**禁區：** `scripts/**`（發現 bug 不得在本任務修，回報後由新任務修再重跑）、`src/**`（除上列）、`package.json`

**Interfaces:**
- Consumes: `pnpm gen:levels`（C1）、C7 測試。
- Produces: 凍結題庫 v1（`libraryVersion=1`）。

**驗收指令：**
- `pnpm gen:levels --workers <核數>`（預估 8 核 10–40 分鐘；可中斷續跑；Taskboard worker 預算不夠時由人在本機 checkout 任務分支執行並 commit）
- `pnpm vitest run src/data/__tests__`（不再 skipped；integrity < 2 s）
- `pnpm test:slow`（全綠；貼輸出尾段）
- `pnpm typecheck && pnpm test && pnpm build`
- `ls -la src/data/levels.json`（預期 150–200 KB）與 `du -sh dist/assets/levels*`（確認為獨立 chunk）

**完成證據：** 三個產物進同一 commit；`levels.hash.txt` 第二行 `libraryVersion=1`；生成統計（hintCount 分布、`c` 分布、null 數、總耗時）貼進回報與 `docs/CLAUDE.LOG/drafts/D4.md`；若 `c` 為 null 的比例 > 30% 或總耗時 > 2 小時，寫進 `docs/backlog/drafts/D4.md` 建議調參（調參必換 `generator` 字串並重跑，不在本任務做）。

- [ ] **Step 1: 寫失敗測試**：移除五個測試檔的 `skipIf` 行 → 無題庫時測試失敗（確認守門生效）。
- [ ] **Step 2: 跑測試確認失敗**（`pnpm vitest run src/data/__tests__` 紅）
- [ ] **Step 3: 最小實作**：`pnpm gen:levels`；完成後確認 `src/data/levels.json`、`levels.hash.txt` 由腳本寫出、`levels.meta.jsonl` 1000 行。
- [ ] **Step 4: 跑測試確認通過**（四條驗收）
- [ ] **Step 5: Commit**（訊息含 SHA-256 前 12 碼與 `libraryVersion=1`）

---

## 層 E

### Task E1: Playwright E2E 九情境

**Files:**
- Create: `e2e/helpers.ts`、`e2e/01-main-flow.spec.ts`、`e2e/02-direct-mode.spec.ts`、`e2e/03-mobile-drag.spec.ts`、`e2e/04-solution-assisted.spec.ts`、`e2e/05-restore.spec.ts`、`e2e/06-pdf.spec.ts`、`e2e/07-spa-fallback.spec.ts`、`e2e/08-trail-keyboard.spec.ts`
- Modify: `playwright.config.ts`（如需調整 `webServer`／`projects`；A1 已建）、`e2e/smoke.spec.ts`
- Test: 以上

**禁區：** `src/**`、`scripts/**`、`package.json`、`wrangler.jsonc`

**Interfaces:**
- Consumes: `window.__primeTrail.solutionOf(id)`、`ready()`（D1）；DOM 鉤子：`.pt-board`、`.pt-cell[data-cell]`、`.is-conflict`、`[data-key]`、`[data-mode]`、`[data-difficulty]`、`[data-completion]`、`[data-assisted]`、`[data-new-best]`、`[data-also-valid]`、`.toast`、`.modal`；localStorage key `prime-trail:v1:L1:records|progress|lastPlayed`。
- Produces：`helpers.ts`：`openPlay(page, id, difficulty)`、`fillByTrail(page, id, upTo = 100)`（依 `solutionOf` 依序 click 格，跳過 given）、`readRecords(page)`、`readProgress(page)`。

**驗收指令：**
- `pnpm exec playwright install chromium`
- `pnpm test:e2e`（desktop + mobile projects 全綠）
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** `playwright-report` 摘要貼進回報（通過數／專案）；草稿寫 `drafts/E1.md`（含 flaky 處理）。

- [ ] **Step 1: 寫失敗測試**（照 §12.3 情境 1–8，含 5b）
  - 01：首頁輸入 1、選簡單、開始 → URL `/play/1/easy`；`fillByTrail` → `.modal` 含 `win.title` 文字、時間非 `00:00`、步數 > 0；回首頁輸入 1 → `[data-difficulty="easy"] [data-completion="cleared"]`；reload 仍在。
  - 02：切 `[data-mode="direct"]`、點某空格、按 `[data-key="1"]`、`[data-key="2"]`、`confirm` → 格顯示 12；在另一格再填 12 → 兩個 `.is-conflict`；按 undo → 一個也沒有（或剩 0）。
  - 03（mobile project）：trail 模式以 `page.touchscreen`／`locator.dispatchEvent('pointerdown')` + 多次 `pointermove` 連填 5 格 → 5 格有值；`window.scrollY` 前後相等。
  - 04：按看解答 → confirm modal → 確認 → `[data-also-valid]` 不存在（未過關）且解答格顯示；`fillByTrail` 完成 → `readRecords()['1:easy'].assistedClears===1`、`bestMs===null`；回首頁 `[data-completion="assisted"]`。
  - 05：填 5 格 → `page.reload()` → 五格仍在、`.toast` 含 `已恢復進度`；按重新開始 → 確認 → 空、`readProgress()` 無 `1:easy`。05b：在 `/play/2/advanced` 填 3 格 → 回 `/` → 「繼續上次」文字 `#0002・進階` → 點擊 → 三格在；再從首頁輸入 2 選進階按開始 → 仍三格。
  - 06：匯出不勾解答 → `download.suggestedFilename()` 匹配 `/^prime-trail-0001-easy\.pdf$/`、檔頭 `%PDF`、`[data-assisted]` 不存在；填 1 格後開匯出並勾解答頁 → 確認 modal → 確認 → `[data-assisted]` 出現。
  - 07：直接 `page.goto('/play/500/challenge')` → `.pt-board` 可見（dev server）；另一個 test 以 `pnpm build && pnpm exec wrangler dev --port 8788` 為 `webServer`（獨立 project `wrangler`，`testMatch: 07-*`）驗同一 URL 回 200 且 `.pt-board` 可見。
  - 08：聚焦 `.pt-board`，按 `ArrowDown`／合法方向 → 多一格；往非法方向 → 格數不變且目標格短暫有 `.is-shake`；`Backspace` → 少一格；`Tab` → `[data-mode="direct"]` 為選中狀態。
- [ ] **Step 2: 跑測試確認失敗**（在未實作 helpers 前）
- [ ] **Step 3: 最小實作**（helpers 與穩定等待：用 `ready()` 與 `expect.poll`，不用固定 sleep）
- [ ] **Step 4: 跑測試確認通過**
- [ ] **Step 5: Commit**

### Task E2: 部署設定驗證與部署手冊

**Files:**
- Create: `docs/deploy.md`、`public/_headers`（可選：`/assets/*` `Cache-Control: public, max-age=31536000, immutable`）
- Modify: `wrangler.jsonc`（僅在 dry-run 指出問題時）
- Test: 無自動測試；驗收為指令

**禁區：** `src/**`、`scripts/**`、`e2e/**`、`package.json`、`CLAUDE.md`

**Interfaces:**
- Consumes: `pnpm build` 產物、`wrangler.jsonc`。
- Produces：`docs/deploy.md`：前置（`wrangler login`）、步驟（`pnpm install --frozen-lockfile` → DoD 三條 → `pnpm test:slow` → `pnpm run deploy`）、為何用 `pnpm run deploy`、驗證清單（首頁、`/play/500/challenge` 直達、PDF 字型載入、Cache header）、回滾（`wrangler rollback`／重新 deploy 上一 commit）。

**驗收指令：**
- `pnpm build && pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry-run`（成功且輸出列出 `dist` assets 數量）
- `pnpm exec wrangler dev --port 8788 &` 後 `curl -s -o /dev/null -w '%{http_code}' http://localhost:8788/play/500/challenge` 為 `200`，且 `curl -s http://localhost:8788/play/500/challenge | grep -c '<div id="app"'` 為 1；結束 dev
- `pnpm typecheck && pnpm test && pnpm build`

**完成證據：** dry-run 輸出尾段、curl 結果貼進回報；`docs/deploy.md` 存在；`docs/backlog/drafts/E2.md` 寫一條「CLAUDE.md 守門結構的部署前檢查需由主 session 補上：DoD 全綠 + `pnpm test:slow` 全綠」；實際 `wrangler deploy` 由人執行，不在本任務。

- [ ] **Step 1: 寫失敗測試**：先跑 dry-run，若 `wrangler.jsonc` 有誤記錄錯誤。
- [ ] **Step 2: 跑測試確認失敗**（若無誤則略，記錄「首次即過」）
- [ ] **Step 3: 最小實作**：寫 `docs/deploy.md`、`public/_headers`；修 `wrangler.jsonc`（若需）。
- [ ] **Step 4: 跑測試確認通過**（三條驗收）
- [ ] **Step 5: Commit**

---

## 轉成 `implement-layer` 的 args

主 session 從本 plan 的某一層轉出，存成 `docs/superpowers/plans/2026-10-24-prime-trail.layer-<層>.json` 再傳給 Workflow 或 Taskboard：

```json
{
  "spec": "docs/superpowers/specs/2026-10-24-prime-trail-design.md",
  "plan": "docs/superpowers/plans/2026-10-24-prime-trail.md",
  "layer": "B",
  "base": "<git rev-parse main 的輸出>",
  "dod": ["pnpm typecheck", "pnpm test", "pnpm build"],
  "tasks": [
    {
      "id": "B1",
      "title": "路徑編碼與關卡解碼",
      "files": ["src/core/path-codec.ts", "src/core/level-decode.ts", "src/core/__tests__/path-codec.test.ts", "src/core/__tests__/level-decode.test.ts"],
      "forbidden": ["CLAUDE.md", "src/core/types.ts", "src/core/geometry.ts", "src/core/primes.ts", "src/core/rng.ts", "package.json", "pnpm-lock.yaml"],
      "acceptance": ["pnpm vitest run src/core/__tests__/path-codec.test.ts src/core/__tests__/level-decode.test.ts"],
      "planSection": "### Task B1"
    }
  ],
  "models": {"implement": "sonnet", "verify": "haiku", "review": "haiku", "fix": "sonnet"}
}
```
