# 示範怎玩、死路標示與完成連線 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首頁「示範怎玩」AI 試錯播放；正式遊戲簡單難度的死路標示；示範與正式遊戲完成時畫 1→100 連線。

**Architecture:** 兩個純 TS 核心模組：`dead-end.ts`（判定路線是否注定走不完，示範與遊戲共用）與 `demo-solver.ts`（像人的 DFS，輸出事件序列、挑圖、播放時長）。棋盤呈現層一次補齊兩種新能力（格子標記 `marks`、連線疊層 `trail`），遊戲頁與示範對話框都只是餵資料給 `GameBoard`。

**Tech Stack:** Vue 3 + TypeScript、Vitest + `@vue/test-utils`、Playwright、SCSS token。

**Spec:** `docs/superpowers/specs/2026-10-25-demo-playback.md`（定稿）。所有文字、時間、條件以 spec 為準；本計畫只補檔案、介面與測試的決定。

## Global Constraints

- CJK 字串只能放 `src/i18n/zh-TW/<ns>.ts`；新命名空間 `demo`、`deadEnd` 由 A2 一次建好並登錄。
- 不改 `src/core/solver.ts`、`src/core/validate.ts`、題庫、存檔格式、路由、`GameBoard.vue` 的互動行為與操作語意。
- 示範不得讀寫 `useProgress`、`useRecords`、`useGame`／`usePlaySession`、局存檔、`prime-trail:v1:ui`。
- 死路標示不設 `assisted`、不寫 storage、不阻擋操作；只在簡單難度。
- 新顏色一律為 `src/styles/main.scss` 的 `--pt-*` token，並登記到 `scripts/check-contrast.ts`；新 class 不得用到未 import 的 Bootstrap partial。
- `src/core/**` 新檔不依賴 Vue 與 DOM。
- 分支內不改 `docs/CLAUDE.LOG/YYYYMM.md`、`docs/backlog.md`；寫 `drafts/<任務編號>.md`。
- DoD：`pnpm typecheck`、`pnpm test`、`pnpm build`。

## Review Focus

1. 死路誤報：沿任一張地圖的參考解逐步走，`findDeadEnd` 必須每步回 `null`（A1 測，抽 50 張）；指定模式暫放的 > h 數字不得影響判定（A1 測）。
2. 示範對話框關閉後計時器殘留、或「再看一張」與舊播放疊在一起（C1 以 fake timers 測）。
3. 過關連線依參考解而非玩家盤面（B2 以與參考解不同的合法解測）。
4. 恢復已過關的局、重新開始、切換難度後連線與死路標示的出現與消失（B2 測）。
5. 320px 寬：示範對話框與遊戲頁死路說明行不造成水平捲動（C1、B2 e2e 測）。

---

## 工作流與相依

| 層 | 任務 | 相依 |
|---|---|---|
| A | A1 死路判定核心、A2 棋盤標記與連線呈現（含 i18n、token） | 無 |
| B | B1 示範 AI 核心、B2 遊戲頁接上死路標示與過關連線 | B1 依 A1；B2 依 A1、A2 |
| C | C1 示範對話框與首頁按鈕 | B1、A2 |

各任務 Files 兩兩不相交。e2e 只新增檔案，不改 `e2e/helpers.ts`。

---

## 層 A

### Task A1: 死路判定核心

**Files:**
- Create: `src/core/dead-end.ts`
- Test: `src/core/__tests__/dead-end.test.ts`

**禁區：** `src/core/solver.ts`、`src/core/validate.ts`、`src/components/**`、`src/views/**`

**Interfaces — Produces:**

```ts
export type DeadEndKind = 'far' | 'trap' | 'twoEnds' | 'split' | 'noMove';
export interface DeadEnd {
  kind: DeadEndKind;
  /** far: [cell of v]; trap/twoEnds: the trapped cells; split: cells the head cannot reach; noMove: [] */
  cells: Cell[];
  /** noMove: head neighbours that cannot take h+1; otherwise [] */
  rejected: Cell[];
  /** far only */
  target?: number; dist?: number; steps?: number;
}
/** Cells of 1..h for the player's grid: h = largest with 1..h all filled; null if 1..h is not a
 *  legal trail (non-adjacent step, prime/grey mismatch, given mismatch). */
export function trailOf(grid: Uint8Array, puzzle: Puzzle): Cell[] | null;
/** spec §6.1; checks in order far, trap, twoEnds, split, noMove; null = not doomed or h = 100.
 *  Only cells in `trail` count as visited; givens and anything else are unvisited. */
export function findDeadEnd(puzzle: Puzzle, trail: readonly Cell[]): DeadEnd | null;
```

`far` 的 v 為大於 h 的最小 given 數字（`puzzle.givens`），`steps = v − h`、`dist = manhattan(head, cell(v))`，條件 `dist > steps`。`noMove`：head 的每個鄰格對 h+1 都不合格（已走、`grey[x] !== isPrime(h+1)`、x 是別的數字的 given、h+1 是 given 但 x 不是它的格）。

**驗收指令：** `pnpm vitest run src/core/__tests__/dead-end.test.ts`

- [ ] **Step 1: 寫失敗測試**，案例：
  - `trailOf`：fixture 參考解前 k 格填入 → 回傳長度 k、順序正確；中間缺一格 → 只回到缺口前；1→2 不相鄰 → `null`；空盤（只有 given）→ `[start]`。
  - 指定模式暫放：參考解前 10 步 ＋ 在遠處填一個 50 → `trailOf` 長度 10，`findDeadEnd` 為 `null`。
  - 每種 kind 一個手工正例（從 fixture 參考解前 k 步出發，再走一步偏離造成該情況；斷言 `kind` 與 `cells`/`rejected`/`dist`/`steps`）與一個反例。
  - 不誤報：`levels.json` 前 50 張，`derivePuzzle(level,'easy')`，沿參考解 h = 1…99 每步 `findDeadEnd` 皆為 `null`；h = 100 為 `null`。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 實作**（鄰格可走數用「未走鄰格數 ＋ 是否與 head 相鄰」；`split` 從 head 對未走格 BFS）
- [ ] **Step 4: 跑測試與 DoD 確認通過**
- [ ] **Step 5: Commit**（`feat(core): <任務編號> dead-end detection for trails`）

### Task A2: 棋盤標記、完成連線疊層、i18n 與 token

**Files:**
- Create: `src/components/board/TrailLine.vue`、`src/components/board/__tests__/TrailLine.test.ts`
- Create: `src/i18n/zh-TW/demo.ts`、`src/i18n/zh-TW/deadEnd.ts`
- Modify: `src/i18n/zh-TW/index.ts`、`src/components/board/GameBoard.vue`、`src/components/board/BoardCell.vue`、`src/styles/board.scss`、`src/styles/main.scss`、`scripts/check-contrast.ts`
- Test: `src/components/board/__tests__/GameBoard.test.ts`、`src/components/board/__tests__/BoardCell.test.ts`

**禁區：** `src/core/**`、`src/views/**`、`src/components/game/**`（`SolutionView` 不傳新 prop，行為不變）

**Interfaces — Produces:**

```ts
// src/components/board/GameBoard.vue 新增選填 props（預設 undefined／null，不傳時行為與現在完全相同）
export type CellMark = 'reject' | 'trap' | 'branch';   // 由 GameBoard.vue 匯出型別（或放 src/components/board/marks.ts）
marks?: ReadonlyMap<Cell, CellMark>;
/** trail[k-1] = cell of k, length 100; non-null draws TrailLine and moves numbers to the corner */
trail?: readonly Cell[] | null;
```

- `reject`：淡紅底＋右上 ✕ 角標（`::after`，`aria-hidden` 不需要，但 `aria-label` 追加 `t('deadEnd.markReject')`）。
- `trap`：淡紅底＋紅色**虛線**框（與 `.is-conflict` 的實線框可區分）；`aria-label` 追加 `t('deadEnd.markTrap')`。
- `branch`：藍色虛線框（示範用，退回的分歧點）；`aria-label` 追加 `t('demo.markBranch')`。
- `TrailLine.vue`：props `{ trail: readonly Cell[] }`，SVG 疊在格子之上、數字之下，`pointer-events: none`，`aria-hidden="true"`；99 段 `<line>`（或一條 `<polyline>`，測試以點數判定）通過格心，色 `--pt-trail`（= `#3465a4`，同 PDF `PATH_RGB`），線寬約格寬 8%，`stroke-linecap/linejoin: round`。座標系與 `.pt-board` 的 11×11 grid 對齊（10 格加四周半格外框）。
- `trail` 非 null 時 BoardCell 加 `is-trail`：數字縮小、移到格子左上角。
- i18n：`demo.ts` 收 spec §5.3 兩張表的全部文字（開場、依序往下填、質數、卡住標題、四周已填、退回、換路、完成、地圖資訊、按鈕「示範怎玩」「再看一張」、對話框標題、載入中、載入失敗、方向「上面/下面/左邊/右邊」、`markBranch`、八種原因）；`deadEnd.ts` 收 spec §6.2 的說明行（每種 kind 一句，主詞為玩家：「填了這格，…」；`far` 帶 `{v}{dist}{steps}`；`noMove` 帶 `{n}`）與 `markReject`、`markTrap`。參數一律 `{name}` 佔位。
- token：`--pt-trail`、`--pt-dead-bg`（淡紅底）、`--pt-dead-line`（紅虛線，可直接用 `--pt-danger`）、`--pt-branch-line`（可用 `--pt-primary`）；`check-contrast.ts` 登記：`--pt-text` 在 `--pt-dead-bg` 上 ≥ 4.5、`--pt-danger` ✕ 在 `--pt-dead-bg` 上 ≥ 4.5、`--pt-dead-line` 對 `--pt-surface` 與 `--pt-prime` ≥ 3、`--pt-trail` 對 `--pt-surface`／`--pt-prime` ≥ 3。
- `prefers-reduced-motion: reduce`：標記切換無過渡。

**驗收指令：** `pnpm vitest run src/components/board` 與 `pnpm exec tsx scripts/check-contrast.ts`

- [ ] **Step 1: 寫失敗測試**：`TrailLine` 給 fixture 參考解 → 99 段、第 k 段端點為 `trail[k-1]`、`trail[k]` 的格心；`GameBoard` 傳 `marks` → 對應格有 `is-mark-reject`／`is-mark-trap`／`is-mark-branch` class 與 aria 文字；傳 `trail` → 渲染 `TrailLine` 且格子有 `is-trail`；都不傳 → 無新 class、無 SVG（既有測試不改仍綠）。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 實作**
- [ ] **Step 4: 跑驗收、對比腳本、`bootstrap-partials` 測試與 DoD**
- [ ] **Step 5: Commit**（`feat(board): <任務編號> cell marks, trail line overlay, demo/deadEnd i18n`）

---

## 層 B

### Task B1: 示範 AI 核心

**Files:**
- Create: `src/core/demo-solver.ts`
- Test: `src/core/__tests__/demo-solver.test.ts`

**禁區：** `src/core/dead-end.ts`（只呼叫，不改）、`src/core/solver.ts`、`src/components/**`、`src/views/**`

**Interfaces — Consumes:** A1 的 `findDeadEnd`（候選的 `far`／`trap`／`twoEnds`／`split` 判定：對 `trail + [x]` 呼叫，回 `noMove` 或 `null` 視為可走）、`derivePuzzle`。

**Produces:**

```ts
export type DemoReasonKind =
  | 'used' | 'otherGiven' | 'givenElsewhere' | 'needPrime' | 'notPrime' | 'far' | 'trap' | 'twoEnds' | 'split';
export interface DemoReason {
  cell: Cell; kind: DemoReasonKind;
  value?: number;   // otherGiven: the given there; far: v
  dist?: number; steps?: number;  // far
  cells?: Cell[];   // trap / twoEnds / split
}
export type DemoEvent =
  | { type: 'place'; cell: Cell; n: number }
  | { type: 'unplace'; cell: Cell; n: number }
  | { type: 'stuck'; n: number; head: Cell; reasons: DemoReason[] }; // n = last placed number
export interface DemoTrace { solved: boolean; events: DemoEvent[]; backtracks: number }
export const DEMO_PACING: {
  introMs: 2500; placeMs: 1000; primeMs: 1800; stuckBaseMs: 3000; stuckPerReasonMs: 2000;
  unplaceMs: 1000; branchPauseMs: 1200; branchMsgMs: 1800;
};
export const DEMO_LIMITS: { maxEvents: 4000; minBacktracks: 2; maxBacktracks: 4; maxPickEvents: 260;
  maxPlaybackMs: 360000; tries: 80; fallbackMaxBacktracks: 8 };
export function traceDemo(level: Level): DemoTrace;
/** spec §5.3 timings: intro + place(prime? primeMs : placeMs) + stuck(base + perReason × non-`used` reasons)
 *  + unplace × unplaceMs + per backtrack (branchPauseMs + branchMsgMs). Excludes the final hold. */
export function playbackMs(trace: DemoTrace): number;
export interface DemoPick { levelId: number; trace: DemoTrace }
/** spec §4.3; ids are 1..count as in useLevelStore.getLevel */
export function pickDemo(count: number, getLevel: (id: number) => Level, random?: () => number): DemoPick;
```

`stuck.reasons` 每個 head 鄰格一筆（含 `used`），每格取第一個不成立的檢查，順序依 spec §4.2 表。候選排序：Warnsdorff（可走鄰格數少者先），同分依 上、右、下、左。`maxEvents` 用盡 → `solved: false`。

**驗收指令：** `pnpm vitest run src/core/__tests__/demo-solver.test.ts`

- [ ] **Step 1: 寫失敗測試**（spec §8「單元測試（demo-solver）」各條）：
  - `levels.json` 前 50 張：`solved` 者重放 place／unplace 得到的盤面 `isSolved`（`validate.ts`）為真。
  - 重放一致性：每次 place 的格是當時 head 的鄰格且為空；每段 unplace 從最新數字往回收；每段連續 unplace 前一筆恰為 `stuck`；`backtracks` = `stuck` 筆數 = unplace 段數。
  - 每筆 `stuck`：reasons 涵蓋 head 全部鄰格；以**測試檔內獨立寫的**檢查（數鄰格、BFS、曼哈頓）在重放盤面上驗證每條原因屬實，不 import `dead-end.ts`。
  - `playbackMs` 對手寫的小 trace 等於依 `DEMO_PACING` 手算的值。
  - `pickDemo`：固定 seed（`mulberry32` 等，測試檔內寫）兩次結果相同；結果 2 ≤ backtracks ≤ 4、events ≤ 260、`playbackMs` ≤ 360000；注入「只有少數圖符合退路條件（退回 1 或 5–8 段）」的 `getLevel` 時回傳退路圖且 `playbackMs` ≤ 360000；注入「沒有任何圖符合」時兩輪後丟 `Error`（UI 顯示載入失敗）。測試圖從 `levels.json` 先篩出所需性質的 id，再以 `getLevel` 映射。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 實作**；量測：`pickDemo` 在 `levels.json` 上以 Node 跑 20 次的平均與最大耗時，寫進 CLAUDE.LOG 草稿（spec §4.3 的手機預算由 C1 決定是否分批）。
- [ ] **Step 4: 跑驗收與 DoD**
- [ ] **Step 5: Commit**（`feat(core): <任務編號> demo solver trace, pacing and map pick`）

### Task B2: 遊戲頁接上死路標示與過關連線

**Files:**
- Modify: `src/views/PlayView.vue`
- Test: `src/views/__tests__/PlayView.test.ts`
- Create: `e2e/16-dead-end-trail.spec.ts`

**禁區：** `src/core/**`、`src/components/**`、`src/composables/**`、`src/i18n/**`、`e2e/helpers.ts`

**Interfaces — Consumes:** A1 `trailOf`、`findDeadEnd`；A2 `GameBoard` 的 `marks`、`trail` 與 `CellMark`；A2 的 `deadEnd.*` i18n key。

- `deadEnd = computed(...)`：僅 `difficulty === 'easy'` 且未過關時；`trailOf(state.grid, game.puzzle)` 為 null → null；否則 `findDeadEnd`。
- `marks`：`noMove` → `rejected` 各 `reject`；其他 kind → head 格 `reject`、`cells` 各 `trap`。
- 說明行：棋盤下方（`StatusBar` 之前）一行 `aria-live="polite"`、`data-dead-end`，文字取 `deadEnd.<kind>`；無死路時不渲染元素（版面不留白）。
- `trail`：`won` 時由 `state.grid` 算 `cellOf`（k → 填 k 的格），否則 null。

**驗收指令：** `pnpm vitest run src/views/__tests__/PlayView.test.ts`；`pnpm exec playwright test e2e/16-dead-end-trail.spec.ts`

- [ ] **Step 1: 寫失敗測試**（PlayView）：簡單難度沿參考解填到某步後走一步造成 `trap` → 出現 `.is-mark-reject`、`.is-mark-trap` 與 `[data-dead-end]` 文字；undo 後消失；`assisted` 不變；同盤面進階難度不出現；過關 → GameBoard 收到 `trail` 且依玩家盤面（用與參考解不同的合法解，例如 fixture 的 `FIXTURE_ALT_PATH` 搭配允許它的題面）；未過關無 `trail`；重新開始後 `trail` 消失；恢復已過關存檔時有 `trail`；不寫入額外 localStorage key。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 實作**
- [ ] **Step 4: e2e**：桌機：簡單難度走出一步死路看到 ✕ 與說明行、按復原消失；走完一局關掉過關彈窗看到 `svg` 連線；320px 寬死路說明顯示時無水平捲動。跑驗收與 DoD。
- [ ] **Step 5: Commit**（`feat(play): <任務編號> dead-end marks on easy and trail line on win`）

---

## 層 C

### Task C1: 示範對話框與首頁按鈕

**Files:**
- Create: `src/composables/useDemoPlayback.ts`、`src/composables/__tests__/useDemoPlayback.test.ts`
- Create: `src/components/demo/DemoDialog.vue`、`src/components/demo/__tests__/DemoDialog.test.ts`
- Modify: `src/views/HomeView.vue`、`src/views/__tests__/HomeView.test.ts`
- Create: `e2e/15-demo.spec.ts`

**禁區：** `src/core/**`、`src/components/board/**`、`src/views/PlayView.vue`、`src/i18n/**`（文字已由 A2 建好；缺 key 回報，不自行加）、`e2e/helpers.ts`

**Interfaces — Consumes:** B1 `pickDemo`、`DEMO_PACING`、`DemoTrace`、`DemoEvent`；A2 `GameBoard` 的 `marks`／`trail`、`demo.*` i18n；`useLevelStore`（`load`、`status`、`count`、`getLevel`）。

```ts
// useDemoPlayback.ts
export interface DemoFrame {
  grid: Uint8Array; head: Cell | null; marks: ReadonlyMap<Cell, CellMark>;
  trail: readonly Cell[] | null; message: DemoMessage; done: boolean;
}
export type DemoMessage =
  | { kind: 'intro' } | { kind: 'progress'; n: number } | { kind: 'prime'; n: number }
  | { kind: 'stuck'; n: number; lines: { dir: 'up' | 'down' | 'left' | 'right'; reason: DemoReason }[] }
  | { kind: 'back'; m: number } | { kind: 'branch'; m: number } | { kind: 'done'; backtracks: number };
export function useDemoPlayback(): {
  frame: Readonly<Ref<DemoFrame | null>>;
  start(pick: DemoPick, puzzle: Puzzle): void;  // stops any previous run first
  stop(): void;                                  // clears every timer
};
```

- 時間全取 `DEMO_PACING`；播放的步序須與 B1 `playbackMs` 計算的一致（測試以 fake timers 推進 `playbackMs(trace)` 後 `done === true`）。
- 「依序往下填」每 12 步更新一次（spec §5.3：不必每步換字）。
- DemoDialog：`BsModal`；地圖資訊「第 N 張地圖・簡單難度｜退回 k 次」；說明區固定高度、`aria-live="polite"`；`GameBoard` readonly；「再看一張」（`data-action="demoAgain"`）。開啟時 `store.load()` 後 `pickDemo`；載入中按鈕忙碌、不重複開；失敗顯示一行錯誤。關閉 → `stop()`。
- 若 B1 量測的 `pickDemo` 平均耗時 > 30ms（桌機，約對應中階手機 100ms），改為分批挑圖（每張之間 `await` 讓出主執行緒）；否則同步即可。實作者在報告中說明採用哪種。
- HomeView：規則卡標題列加「示範怎玩」按鈕（`data-action="demo"`，收合時可見，觸控目標 ≥ 44×44px），點擊開 DemoDialog；關閉後焦點回按鈕（BsModal 既有）。

**驗收指令：** `pnpm vitest run src/composables/__tests__/useDemoPlayback.test.ts src/components/demo src/views/__tests__/HomeView.test.ts`；`pnpm exec playwright test e2e/15-demo.spec.ts`

- [ ] **Step 1: 寫失敗測試**：
  - `useDemoPlayback`（fake timers、手寫小 trace 含一次 stuck 與 2 格 unplace）：開場訊息；place 後 grid/head 更新；stuck 時 `marks` 對被拒鄰格為 `reject`、`cells` 為 `trap`，`lines` 不含 `used`；unplace 時被收回格 `reject`、分歧點 `branch`；`done` 時 `trail` 非 null；`stop()` 後推進時間 frame 不變；`start()` 兩次只剩一組計時器。
  - DemoDialog：開啟即播放、「再看一張」換圖重播（注入 random）、關閉後推進時間 DOM 不變、全程不寫 localStorage。
  - HomeView：規則卡收合時按鈕仍在；點擊開對話框。
- [ ] **Step 2: 跑測試確認失敗**
- [ ] **Step 3: 實作**
- [ ] **Step 4: e2e**：首頁按「示範怎玩」看到棋盤與開場文字；Esc 關閉、焦點回按鈕；320px 寬無水平捲動。375／1280 截圖（播放中、卡住說明、完成連線）存 scratchpad 並在 CLAUDE.LOG 草稿註明。跑驗收與 DoD。
- [ ] **Step 5: Commit**（`feat(home): <任務編號> demo playback dialog`）

---

## 轉成 `implement-layer` 的 args

各層 JSON 存 `docs/superpowers/plans/2026-10-25-demo-playback.layer-<層>.json`（格式見 `docs/superpowers/plan-template.md` 末段），由主 session 發層前以當下主分支 HEAD 填 `base`。
