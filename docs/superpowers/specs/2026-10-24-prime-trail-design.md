# Prime Trail 設計 spec

- 日期：2026-10-24
- 狀態：草稿，待使用者確認（§15 開放問題裁定後定稿）
- 專案：`game-prime-trail`，slug `prime-trail`
- 讀者：負責拆 plan 與實作的前端工程師／agent。本文標「**規劃者決定**」的條目是規劃者在使用者未明示處做的取捨，使用者可推翻；其餘規則來自使用者。

---

## 1. 意圖、目標、非目標、反目標

### 1.1 意圖

單人益智網頁遊戲：在 10×10 棋盤上從「龍頭」（1）出發，沿四方向相鄰格依序填 1…100，走過每格恰好一次。質數格以底色標示（灰底；2026-10-25 起畫面上改為柔和黃，PDF 仍為灰階，見 `2026-10-25-ui-refresh.md`），是唯一的推理線索。三種難度共用同一張地圖與同一條參考路徑，差別只在顯示多少質數數字。

### 1.2 目標

- 純前端、無帳號、無後端狀態；部署到 Cloudflare Workers Static Assets。
- 手機（直立、觸控）與桌機（滑鼠、鍵盤）都能完整遊玩。
- 題庫 1000 張，編號固定、可重現、離線生成並打包進前端。
- 兩種輸入模式（接續、指定）、即時錯誤回饋、undo、看解答、計時計步與本機最佳紀錄。
- 匯出向量 PDF（題目頁＋可選解答頁）。
- 核心邏輯（幾何、質數、驗證、solver、生成、編碼）為不依賴 Vue 的純 TypeScript，可單獨測試；UI 字串集中管理，日後可加 en。

### 1.3 非目標（v1 不做）

- 每日一題、排行榜、分享連結、帳號同步。
- 瀏覽器內即時生成地圖。
- 深色模式、多主題、音效。
- 其他棋盤尺寸或八方向相鄰。
- 在瀏覽器內跑 solver（v1 的「提示」只用參考解；見 §5.6）。
- 自製手寫辨識、無障礙朗讀整盤內容（基本 aria-label 要做）。

### 1.4 反目標（刻意避免）

- 引入第二套 UI 框架（Vuetify、Element Plus 等）或 Pinia；狀態用 Vue reactive／composable。
- 用 CDN 載入 Bootstrap；一律 npm 安裝、SCSS 匯入。
- 在 UI 文案與程式命名使用 Hidato、Numbrix 等既有商標或產品名。
- 讓題庫編號隨生成器改版而變（題庫一旦發佈即凍結，見 §4.8）。
- 用牆鐘時間當 solver 預算（會破壞可重現性；一律用節點數）。

---

## 2. 規則的正式定義

### 2.1 座標與編號

- 棋盤 10 列 × 10 行。列 `r ∈ [0,9]` 由上往下，行 `c ∈ [0,9]` 由左往右。
- 格索引 `cell = r*10 + c`，`cell ∈ [0,99]`。全文以 `cell` 作為格的唯一識別。
- 方向：`U = -10`、`D = +10`、`L = -1`、`R = +1`，需配合邊界檢查（`L` 要求 `c > 0`，`R` 要求 `c < 9`，`U` 要求 `r > 0`，`D` 要求 `r < 9`）。
- 邊緣格：`r ∈ {0,9}` 或 `c ∈ {0,9}`，共 36 格。角落格同時屬於兩條邊。

### 2.2 相鄰

`adjacent(a, b)` 為真 iff `|ra − rb| + |ca − cb| = 1`（四方向，曼哈頓距離 1）。斜角不相鄰。

### 2.3 質數集合

`PRIMES = {2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97}`，共 25 個。`isPrime(n)` 以查表實作（`n ∈ [1,100]`）。`primeIndex(p) ∈ [0,24]` 為 p 在升冪排列中的位置（2 → 0，97 → 24），供 §3 的 bitmask 使用。

### 2.4 參考路徑（解答）

一條參考路徑 `path: cell[100]`，`path[k-1]` 為數字 k 所在格，滿足：

- `path` 為 0…99 的排列（每格恰好一次，Hamiltonian path）。
- `∀k ∈ [1,99]: adjacent(path[k-1], path[k])`。
- `path[0]`（龍頭）為邊緣格。

由參考路徑衍生：

- `start = path[0]`。
- `grey = { path[p-1] | p ∈ PRIMES }`，恰 25 格（質數格，淺灰底）。龍頭格以較深灰另標，不屬於 grey（1 不是質數）。

### 2.5 奇偶引理（棋盤著色）

定義 `color(cell) = (r + c) mod 2`。四方向相鄰的兩格顏色必不同，因此沿任何合法路徑顏色交替：

> **引理**：`color(path[k-1]) = (color(start) + k − 1) mod 2`。即奇數與龍頭同色、偶數與龍頭異色。

推論（規則、UI、solver 都用到）：

1. 2 是唯一的偶質數，所以 **2 的格是龍頭所有相鄰格中唯一的灰底格**；其餘 24 個灰底格全與龍頭同色。任何難度下 2 的位置都可由盤面直接推出。
2. 100 為偶數，終點與龍頭異色。
3. 指定模式下，把奇數填進與龍頭異色的格（或偶數填進同色格）一定錯，可即時標示（§8）。
4. Solver 不需另外檢查奇偶：只在相鄰格間移動時奇偶自動成立；但「曼哈頓距離 ≤ 剩餘步數」的可達性剪枝不必再檢查距離與步數的奇偶一致（由引理保證）。

### 2.6 難度與提示集合

難度 `Difficulty = 'easy' | 'advanced' | 'challenge'`（UI：簡單／進階／挑戰）。對同一張地圖：

| 難度 | 顯示的數字（given） | 灰底 |
|---|---|---|
| easy | 1 ＋ 全部 25 個質數 | 全部質數格 |
| advanced | 1 ＋ 質數子集 `advancedHints ⊂ PRIMES`（§4.5 決定） | 全部質數格 |
| challenge | 僅 1 | 全部質數格 |

「題面」`Puzzle = { start, grey: Set<cell>, givens: Map<cell, number> }`。`givens` 一定包含 `start → 1`。

### 2.7 玩家盤面與衝突

玩家盤面 `grid: Uint8Array(100)`，`grid[cell] ∈ [0,100]`，0 表示空。given 格鎖定不可改。

`findConflicts(grid, puzzle): Conflict[]`，每個 `Conflict = { cell, kind }`，`kind` 為：

| kind | 條件 |
|---|---|
| `duplicate` | 同一數字出現在兩格以上（所有該數字的格都標） |
| `nonAdjacent` | `grid[a] = n`、`grid[b] = n+1` 都已填且 `!adjacent(a,b)`（a、b 都標） |
| `primeMismatch` | `grid[cell] ≠ 0` 且 `isPrime(grid[cell]) ≠ grey.has(cell)` |
| `parity` | `grid[cell] = n ≠ 0` 且 `color(cell) ≠ (color(start) + n − 1) mod 2`（**規劃者決定**：列入即時回饋，理由見 §8） |

### 2.8 過關條件

`isSolved(grid, puzzle)` 為真 iff：

1. `grid` 無 0，且為 1…100 的排列。
2. `grid[start] = 1`。
3. `∀k ∈ [1,99]`：數字 k 與 k+1 所在格相鄰。
4. `∀cell`：`isPrime(grid[cell]) ⇔ grey.has(cell)`（灰底格集合恰為質數位置）。
5. `∀(cell, n) ∈ givens`：`grid[cell] = n`。

**規劃者決定**：不要求 `grid` 等於參考路徑。易見 1–5 等價於「`findConflicts` 為空且盤面填滿」。看解答時若玩家解與參考解不同，顯示「你的解也合法」。

---

## 3. 關卡資料格式與題庫檔案佈局

### 3.1 編碼（**規劃者決定**）

路徑以 **99 字元方向字串**（字母 `U/D/L/R`）表示，從 `start` 出發；直接可讀、可在測試輸出中肉眼比對。不採 2-bit 打包（省下的約 60 KB 在 brotli 壓縮後差距不到 10 KB，不值得犧牲可讀性）。

進階提示子集以 **25-bit 整數 bitmask** 表示：bit `primeIndex(p)` 為 1 表示質數 p 在進階難度顯示。

### 3.2 檔案 schema

打包檔 `src/data/levels.json`（由生成器產生並 **commit 進 git**）：

```ts
interface LevelFile {
  schema: 1;                 // 檔案格式版本；破壞性變更時遞增
  libraryVersion: number;    // 題庫版本；任何已發佈題面（s/p/h）變動即遞增，進 localStorage 前綴（§3.5、§7.5）
  generator: string;         // 例 "backbite/1.0.0"，生成器演算法與參數版本
  masterSeed: string;        // 例 "prime-trail-v1"
  count: 1000;
  levels: LevelRecord[];     // 陣列索引 i 對應地圖編號 id = i + 1
}

interface LevelRecord {
  s: number;        // start cell, 0..99，必為邊緣格
  p: string;        // 99 字元，/^[UDLR]{99}$/
  h: number;        // advanced hint bitmask，0 ≤ h < 2^25
  c: number | null; // challenge 難度解數：確切值；等於 CAP(=1000) 表示 ≥ CAP；null 表示節點預算內未算完
  seed: number;     // 本張實際使用的 32-bit 種子（含重試次數後的值）
}
```

審計檔 `src/data/levels.meta.jsonl`（JSONL、一行一張，commit、不被前端 import、不進 bundle）：每張的 `id`、`attempt`、`seed`、`s`、`p`、`h`、`c`、候選明細、solver 節點數、進階提示數、生成耗時。它是生成的真實來源，`levels.json` 由它組裝（§4 I/O）；行內欄位細節由實作者定。

### 3.3 解碼後的執行期型別（`src/core/types.ts`）

```ts
type Cell = number;                 // 0..99
type Difficulty = 'easy' | 'advanced' | 'challenge';

interface Level {
  id: number;                       // 1..1000
  start: Cell;
  path: Uint8Array;                 // length 100, path[k-1] = cell of k
  cellOf: Uint8Array;               // alias of path（語意命名）
  numberAt: Uint8Array;             // length 100, numberAt[cell] = k
  grey: Uint8Array;                 // length 100, 0/1
  advancedHints: ReadonlySet<number>; // 質數值集合
}

interface Puzzle {
  start: Cell;
  grey: Uint8Array;                 // length 100, 0/1
  givens: ReadonlyMap<Cell, number>;
}

function decodeLevel(record: LevelRecord, id: number): Level;
function encodePath(path: Uint8Array): string;          // 供生成器與測試 round-trip
function decodePath(start: Cell, dirs: string): Uint8Array;
function derivePuzzle(level: Level, difficulty: Difficulty): Puzzle;
```

### 3.4 大小估算與載入

- 每筆約 `99（p）+ 10（s）+ 12（h）+ 8（c）+ 14（seed）+ 鍵名與標點 ≈ 170 bytes` → 1000 張約 **170 KB** 未壓縮；`UDLR` 四符號字串熵約 2 bit/字元，Cloudflare 自動 brotli 後預估 **35–50 KB**。
- 載入方式（**規劃者決定**）：`src/data/levels.json` 以 **動態 `import()`** 載入，Vite 會切成獨立帶 hash 的 chunk，首頁 JS 不含題庫；進入第一局時才下載，之後由瀏覽器快取。單檔即可，不分片；若日後超過 500 KB 再改 `import.meta.glob` 分 10 片。
- `useLevelStore()`（§7）包住載入並快取在模組層 `shallowRef`。

### 3.5 題庫凍結規則

**規劃者決定（依審查修訂）**：`levels.json` 發佈後全檔凍結，包含 `h`——發佈後**禁止**只重算 `h` 或 `c`（進階題面改了，舊紀錄就不可比）。若真要改任何已發佈題面（`s`、`p`、`h` 任一），必須提升題庫版本號 `LevelFile.libraryVersion`（整數，v1 發佈為 1），且 localStorage key 前綴含題庫版本（`prime-trail:v1:L<libraryVersion>:*`，見 §7.5），舊版紀錄與存檔自然失效、不做遷移。`schema` 欄位只描述檔案格式，與題庫版本獨立。`--recompute` 僅限發佈前調參使用；發佈後的 commit 以 Vitest 的凍結雜湊測試（§12.1）擋下任何內容變動。

---

## 4. 關卡生成器

位置 `scripts/gen-levels.ts`（以 `tsx` 執行），只 import `src/core/*`。指令 `pnpm gen:levels [--ids 1-1000] [--workers <n>] [--recompute h,c]`（`--recompute` 僅限發佈前，§3.5）。

**生成器 I/O（規劃者決定，依審查修訂）**：

- 每張算完立即以 **JSONL** 逐行追加寫入 `src/data/levels.meta.jsonl`（一行一張：id、attempt、seed、`s`、`p`、`h`、`c`、候選明細、節點數、耗時）。續跑時讀 meta 已完成的 id 跳過；同一 id 若出現多行，以最後一行為準。
- `levels.json` **永遠由 meta 在最後組裝**（`pnpm gen:levels --assemble` 或主流程結尾自動），且只有 1…1000 全部齊備並通過 §4.8 檢查才寫正式檔；缺任何一張就不寫。
- `--ids` 部分跑只寫 meta，與（可選 `--partial`）`src/data/levels.partial.json` 供開發用，正式檔不動。`levels.partial.json` 進 `.gitignore`。
- 每張的 seed 只取決於 `(masterSeed, id, attempt)`，與 worker 數、分批、續跑順序無關，因此不論怎麼跑，組裝出的 `levels.json` 位元相同。

### 4.1 隨機 Hamiltonian path：比較與選擇

| 方法 | 優 | 劣 |
|---|---|---|
| Backtracking ＋ Warnsdorff 隨機平手 | 實作直接；10×10 幾毫秒內多半能成功 | 路徑有明顯「沿邊繞圈」偏態；失敗要重啟，分布不均 |
| Backbite（Mansfield）隨機漫步 | 從任意已知路徑出發，每步 O(n)，分布接近均勻，不會失敗 | 需要起始路徑（蛇行即可）；端點位置不可控，需額外處理起點在邊緣 |

**規劃者決定：採 backbite。** 理由：不會卡死、路徑形狀多樣（遊戲性）、端點移動自然滿足「起點在邊緣」的要求。

### 4.2 Backbite 流程

1. 初始路徑：蛇行（row 0 由左到右、row 1 由右到左…）。
2. 重複 `N = 100_000` 次：隨機選一端點 e（index 0 或 99）；在 e 的四方向相鄰格中隨機選一格 x，x 在路徑中位置 j 且 x 不是 e 在路徑中的相鄰元素；若 e 在 index 0，反轉 `path[0..j-1]`；若 e 在 index 99，反轉 `path[j+1..99]`。每步 O(100)，總計約 10^7 次元素操作，預估 < 100 ms。
3. 繼續做單步 backbite，直到至少一個端點是邊緣格（邊緣格佔 36%，預期數步內達成；設上限 10_000 步，超過視為失敗、換下一個 attempt）。
4. 若兩端都在邊緣，以 PRNG 擲硬幣決定哪端為 1；否則邊緣那端為 1；必要時反轉整條路徑。

### 4.3 PRNG 與可重現性

- `src/core/rng.ts`：`sfc32`（四個 32-bit 狀態，純 TS），種子來源 `hash32(masterSeed + ":" + id + ":" + attempt)`（FNV-1a 或 MurmurHash3 的 32-bit 版，自寫）。`seed` 欄位存實際使用的種子。
- 任何隨機選擇只來自這個 PRNG；**預算用節點數不用時間**（§1.4）。相同 `generator` 版本字串 ＋ `masterSeed` 必產出位元相同的 `levels.json`；Vitest 抽樣驗證（§12）。
- 固定參數（N、CAP、各預算、候選數 K、greedy 重啟數）全部寫進 `generator` 版本字串對應的常數檔 `scripts/gen-config.ts`；改任何一個就要改版本字串。

### 4.4 唯一解檢查（簡單難度）

對 `derivePuzzle(level, 'easy')` 呼叫 §5 的 `solve(puzzle, { maxSolutions: 2, maxNodes: EASY_BUDGET })`。

- `count === 1 && exhausted` → 收錄。
- `count ≥ 2` 或未在預算內算完 → 丟棄此候選，attempt + 1 重新 backbite。
- 25 個 given 把路徑切成最長 8 步（89→97）與 3 步尾段（97→100）的小段，搜尋空間極小；預估單次 < 10 ms，`EASY_BUDGET = 200_000` 節點已非常寬裕。預期丟棄率 20–50%（短段如 3→5 兩個共同相鄰格造成的歧義），因此 attempt 平均 1–2 次。

### 4.5 進階提示子集挑選（**規劃者決定**）

目標：在保持唯一解的前提下接近最少提示，同時避免進階難度的張與張之間落差過大。

1. 從全部 25 個質數出發，`shown = PRIMES`。
2. 用該張的 PRNG 把質數隨機排序；依序對每個 p 嘗試 `shown − {p}`：呼叫 `solve(puzzle(shown − {p}), { maxSolutions: 2, maxNodes: ADV_BUDGET })`；若 `count === 1 && exhausted` 則確定移除。預算內未算完視為「不唯一」（保守，保留該提示）。
3. 當 `|shown| ≤ ADV_FLOOR = 6` 時停止移除（下限，避免進階變成挑戰）。
4. 重複 1–3 共 `ADV_RESTARTS = 3` 次（不同隨機順序），取 `|shown|` 最小者；平手取第一個。
5. 不設上限；若 greedy 結束仍 > 12，照收並在 meta 記錄。

成本：每張最多 3 × 25 = 75 次 solver 呼叫，given 越少越貴；`ADV_BUDGET = 2_000_000` 節點（約 1–3 s 最壞），預估每張 0.5–10 s。

### 4.6 挑戰難度解數與候選挑選（**規劃者決定**）

挑戰題面只有 start 與 grey，不保證唯一。做法：

1. 每個 id 產生 `K = 3` 個通過 §4.4 的候選（attempt 連號）。
2. 對每個候選算 `solve(puzzle(challenge), { maxSolutions: CAP = 1000, maxNodes: CHAL_BUDGET = 5_000_000 })`，記 `c`（未算完記 `null`）。
3. 選 `c` 最小者（`null` 視為最大）；平手取 attempt 最小者。只對選中者做 §4.5。

### 4.7 預估時間與太慢的取捨

單張預估（單執行緒，M 系列 Mac）：backbite ×3 ≈ 0.3 s；easy 檢查 ≈ 0.05 s；挑戰計數 ×3 最壞 15 s、典型 1–3 s；進階 greedy 0.5–10 s。**典型每張 3–10 s，1000 張約 1–3 小時單執行緒；用 `worker_threads` 8 核約 10–25 分鐘。** 可接受，因為只跑一次。

若實測遠超預估，依序取捨（每一項都要改 `generator` 版本字串並重跑全部）：

1. `K` 從 3 降到 1（放棄挑戰解數偏好，仍記錄 `c`）。
2. `CHAL_BUDGET` 降到 1_000_000（`c` 更常為 null）。
3. `ADV_RESTARTS` 降到 1。
4. 最後手段：挑戰解數不算（`c` 一律 null）。

### 4.8 生成器輸出的驗證

組裝 `levels.json` 前自行跑一次 §12.2 的完整檢查（全部 1000 張結構合法、簡單與進階唯一）後才寫正式檔；寫檔後印出統計（進階提示數分布、`c` 分布、null 數）與整檔 SHA-256，供 §12.1 凍結雜湊測試使用。

---

## 5. Solver 設計

位置 `src/core/solver.ts`，純函式，Node 與瀏覽器都能跑（v1 只在 Node 用，見 §5.6）。

### 5.1 介面

```ts
interface SolveOptions {
  maxSolutions: number;   // 找到這麼多解就停（唯一解檢查用 2）
  maxNodes: number;       // 節點預算；每次嘗試放一個數字算 1 節點
  collect?: boolean;      // 是否回傳解的盤面（預設 false）
}
interface SolveResult {
  count: number;          // 找到的解數（≤ maxSolutions）
  exhausted: boolean;     // true = 搜尋空間已完整走完（count 即確切值，若 < maxSolutions）
  nodes: number;
  solutions?: Uint8Array[]; // 每個為 grid（cell → number）
}
function solve(puzzle: Puzzle, options: SolveOptions): SolveResult;
```

語意：`exhausted === false` 只會因 `maxNodes` 用盡或達到 `maxSolutions` 提前停止而發生。

### 5.2 搜尋順序

DFS 依數字 1→100 延伸路徑頭（head）。狀態：`visited: Uint8Array(100)`、`head`、`k`（目前已放的最大數）、`numberAt`。第 k+1 步候選 = head 的未訪相鄰格，依 Warnsdorff（候選格的可用度低者優先）排序，使第二個解盡早出現（唯一解檢查可早停）。

### 5.3 候選過濾（放數字 n = k+1 到格 x 的必要條件）

1. `!visited[x]`。
2. 若 n 是 given：x 必須等於該 given 的格；若 x 是某 given 格且其值 ≠ n：拒絕。
3. `grey[x] === isPrime(n)`。
4. 奇偶自動成立（§2.5），不檢查。

### 5.4 剪枝（放入 x 後檢查，任一失敗即回溯）

1. **Given 可達性**：對每個未訪的 given `(g, v)`，`manhattan(x, g) ≤ v − n`。前處理另外靜態檢查連續 given 之間 `manhattan(gi, gj) ≤ vj − vi`，不成立直接回傳 0 解。
2. **下一個質數可達性**（挑戰、進階用）：令 q 為大於 n 的最小質數，需存在未訪灰底格 y 使 `manhattan(x, y) ≤ q − n`；且每個未訪灰底格 y 都要存在某個未用質數 q' 使 `manhattan(x, y) ≤ q' − n`（否則該灰底格永遠趕不上）。未用質數數必等於未訪灰底格數（由條件 3 不變量保證，不必檢查）。
3. **度數規則**：令 `avail(y)` = 未訪格 y 的未訪相鄰格數 ＋（y 與 head 相鄰 ? 1 : 0）。若存在 `avail(y) = 0` → 剪；`avail(y) = 1` 的格數 ≥ 2 → 剪（剩餘路徑只有一個自由端）。用每格的度數計數器增量維護，放入／回溯各 O(4)。
4. **連通性**：所有未訪格須在「未訪格 ＋ head」導出子圖中連通。BFS O(100)。每步都做（1M 節點 × 100 ≈ 10^8 基本操作，可接受）；若剖析顯示過慢，改為只在度數計數器有變化的步做。
5. **尾段**：`n = 100` 時直接記一解。

### 5.5 複雜度與預算定位

- 簡單：given 密集，實測預期 10^3–10^4 節點。
- 進階 greedy 後段（6–8 個 given）：10^5–10^6 節點。
- 挑戰：僅 grey 約束，最壞可能超過 5×10^6 節點 → 記 `null`。這是已知風險（§14），不是缺陷。

### 5.6 遊戲內「提示下一步」（**規劃者決定**）

v1 不在瀏覽器跑 solver。「提示」按鈕行為：

1. 令 `h` = 玩家盤面中「1…h 全部已填」的最大 h（head，定義見 §7.2）。
2. 若玩家目前所有已填數字都與參考路徑一致：高亮參考路徑中 h+1 的格（不自動填）。
3. 否則：高亮玩家盤面與參考路徑不一致的最小數字所在格，並 toast「從 n 開始與參考解不同；提示依參考解」。挑戰難度下玩家可能走在另一條合法解上，此行為會把他推回參考解——文案明說，玩家可忽略。
4. 使用提示即設 `assisted = true`（同看解答，不列入最佳紀錄）。

Solver 保持純函式、無 DOM 依賴，日後可放進 Web Worker 做「依玩家目前盤面求解」（backlog）。

---

## 6. 元件結構

目錄：

```
src/
  core/          純 TS：types, geometry, primes, rng, path-codec, validate, solver, generator(backbite), level-store(decode)
  data/          levels.json, levels.meta.jsonl, levels.hash.txt, __slow__/
  i18n/          index.ts(useI18n/t), zh-TW.ts, en.ts(日後)
  composables/   useLevelStore, useGame, useTimer, useRecords, useProgress, useSettings
  components/
    board/       GameBoard.vue, BoardCell.vue, HeadMarker.vue
    input/       NumberPad.vue, InputModeToggle.vue
    ui/          BsModal.vue, BsToast.vue, StatusBar.vue
    picker/      LevelPicker.vue, DifficultyPicker.vue
    game/        WinModal.vue, SolutionView.vue, PdfExportDialog.vue
  pdf/           renderPuzzlePdf.ts（jsPDF；可在無 Vue 環境測試）, font-loader.ts
  views/         HomeView.vue, PlayView.vue
  router.ts, App.vue, main.ts
  styles/        main.scss（Bootstrap 變數覆寫 + 匯入）, board.scss
public/fonts/    pdf-zh.subset.ttf（§6.9 產生）
scripts/         gen-levels.ts, gen-config.ts, gen-pdf-font.ts
e2e/             Playwright specs
```

路由（vue-router、history 模式）：`/` → HomeView（LevelPicker）；`/play/:id(\d+)/:difficulty(easy|advanced|challenge)` → PlayView；其他 → `/`。

### 6.1 GameBoard.vue

純呈現 ＋ 指標事件，不含遊戲規則。

| props | 型別 | 說明 |
|---|---|---|
| `puzzle` | `Puzzle` | 灰底、given、start |
| `grid` | `Uint8Array` | 玩家盤面（readonly 用法） |
| `conflicts` | `ReadonlyMap<Cell, ConflictKind[]>` | 標紅 |
| `selected` | `Cell \| null` | 指定模式選取格 |
| `head` | `Cell \| null` | 接續模式目前龍頭所在格（高亮） |
| `highlight` | `Cell \| null` | 提示格 |
| `mode` | `'trail' \| 'direct'` | 決定 `touch-action` 與拖曳是否啟用 |
| `readonly` | `boolean` | 解答檢視、PDF 預覽用 |

| emits | 時機 |
|---|---|
| `press(cell)` | pointerdown／click／鍵盤 Enter 在格上 |
| `drag(cell)` | 拖曳中指標進入新格（僅 `mode === 'trail'`） |
| `dragend()` | pointerup／pointercancel |
| `key(e: KeyboardEvent)` | 棋盤有焦點時的鍵盤事件（數字、Backspace、方向鍵） |

版面：外層 `.pt-board` 為 11×11 單位的 CSS Grid（10 格 ＋ 四周各半格的外框帶，供三角形與呼吸空間），以 CSS 變數 `--cell` 控制格尺寸（§9）。格用 `<button class="pt-cell">`（不套 `.btn`），`aria-label` 為「第 r 列第 c 行，數字 n／空／質數格」。

### 6.2 BoardCell.vue

| props | 說明 |
|---|---|
| `value: number` | 0 為空 |
| `kind: 'start' \| 'prime' \| 'normal'` | 深灰／淺灰／白 |
| `given: boolean` | 鎖定，字重較粗 |
| `selected`、`head`、`highlight`、`conflict: boolean` | 狀態樣式 |

無 emits（事件由 GameBoard 以事件委派處理，減少 100 個 listener）。

### 6.3 HeadMarker.vue

props：`start: Cell`。以 CSS 三角形絕對定位在外框帶，指向龍頭格。**規劃者決定**：角落格在它所屬的每條邊各畫一個三角形（最多兩個），PDF 同規則。

### 6.4 NumberPad.vue

props：`disabled: boolean`、`pending: string`（目前輸入中的 0–3 位數字串，3 位只允許 `100`）。emits：`digit(d: 0–9)`、`clear()`、`confirm()`。鍵位：0–9、清除、確認。輸入規則見 §7.3。

### 6.5 StatusBar.vue

props：`levelId`、`difficulty`、`elapsedMs`、`steps`、`assisted`。顯示「地圖 #0123・進階・12:34・步數 57」；`assisted` 時顯示「輔助中・不列入最佳紀錄」標籤。無 emits。「已恢復進度」以 Toast 呈現（由 PlayView 觸發，§7.6），不佔狀態列。

### 6.6 LevelPicker.vue / DifficultyPicker.vue

LevelPicker：編號輸入（1–1000，無效即停用「開始」）、「隨機」按鈕、難度選擇、每個難度旁顯示該編號的最佳紀錄與完成標記（實心勾＝正常過關、空心勾＋「輔助完成」＝僅 assisted 過關；§7.5）、「繼續上次」（只對應 `lastPlayed` 那一局，顯示「#0123・進階」；§7.6）。emits：`start(levelId, difficulty)`、`resume(levelId, difficulty)`；兩者都導向 `/play/:id/:difficulty`，恢復與否由 PlayView 依存檔決定（§7.6），所以按「開始」進入有存檔的圖同樣自動續玩。**規劃者決定**：隨機在 1–1000 均勻抽，不排除已過關（使用者說「抽一張再選難度」，難度未定前無法判斷已過關）。

### 6.7 WinModal.vue

props：`levelId`、`difficulty`、`elapsedMs`、`steps`、`best: { bestMs, bestSteps } | null`、`isNewBest: { time: boolean, steps: boolean }`、`assisted`。`assisted` 為真時標題改「輔助完成」、不顯示新紀錄徽章、說明「本局不列入最佳紀錄」。emits：`viewSolution()`、`nextRandom()`、`backHome()`、`exportPdf()`。

### 6.8 SolutionView.vue

props：`level`、`puzzle`、`playerGrid`、`solved: boolean`。以 readonly GameBoard 顯示參考解，可切換「我的填法／參考解」；`solved && !equal(playerGrid, level.path)` 時顯示「你的解也合法」。進入前的確認 dialog 由 PlayView 負責（§7.4）。

### 6.9 PdfExportDialog.vue 與 `src/pdf/`

Dialog props：`level`、`difficulty`、`gameStatus: 'idle' | 'playing' | 'won'`；選項：附解答頁（checkbox）；emits：`export(options: { includeSolution: boolean })`、`markAssisted()`。

**規劃者決定（依審查修訂）**：過關前（`gameStatus === 'playing'`）勾選「附解答頁」要先確認（文案：「匯出含解答的 PDF 後，這局不列入最佳紀錄。」），確認後 emit `markAssisted()`，PlayView 接到即呼叫 `useGame.markAssisted()`（與看解答同規則，§7.4）。`gameStatus` 為 `idle`（尚未填任何一格）或 `won` 時匯出不影響紀錄、不需確認。不勾解答頁的匯出永遠不影響紀錄。

`renderPuzzlePdf({ level, difficulty, includeSolution }): Promise<Blob>`（**規劃者決定**細節）：

- jsPDF，A4 直式，單位 mm，向量繪製：棋盤 160 mm 置中，格線 0.3 mm，灰底用填色（龍頭 55% 灰、質數格 85% 灰），龍頭三角形在外框帶，數字用內建 Helvetica（數字不需中文字型）。
- 第一頁：標題「Prime Trail」、地圖編號、難度、題面（依難度顯示 given）、圖例一行（龍頭／質數格）。第二頁（可選）：完整參考解數字，另畫 0.6 mm 路徑折線。
- 中文字型：`public/fonts/pdf-zh.subset.ttf`，由 `scripts/gen-pdf-font.ts` 以 `subset-font`（harfbuzz）從 Noto Sans TC Regular 子集化，字元集 = `i18n/zh-TW.ts` 中 `pdf.*` 鍵值的所有字元 ∪ 難度名稱 ∪ 常用標點；預估 15–30 KB。匯出時才 `fetch` 字型並 `addFileToVFS/addFont`；載入失敗則 fallback 為英文標籤（`en.ts` 的 `pdf.*`）並 toast 提示。Noto 的 OFL 授權檔隨字型放 `public/fonts/`。
- 檔名 `prime-trail-0123-advanced.pdf`。
- Vitest：`pdf-font-coverage.test.ts` 檢查子集字型涵蓋所有 `pdf.*` 字元（讀 TTF cmap，用 `opentype.js` 或 `fontkit`，實作者選）。

### 6.10 BsModal.vue / BsToast.vue（**規劃者決定**）

不 import Bootstrap 的 JS（避免 Bootstrap JS 與 Vue 同時操作 DOM、也省掉 Popper）；用 Bootstrap 的 class 與 Vue `<Teleport to="body">` 自寫 Modal（含 backdrop、Esc 關閉、焦點回復）與 Toast（右下堆疊、自動消失）。SCSS 只匯入需要的 Bootstrap 部件（reboot、grid、buttons、forms、modal、toast、utilities）。

---

## 7. 狀態管理

全部用 Vue `reactive/ref/computed` 與 composable，模組層 singleton 以閉包變數實作；不用 Pinia。

### 7.1 composable 劃分

| composable | 職責 | 依賴 |
|---|---|---|
| `useLevelStore()` | 動態 import `levels.json`、快取、`getLevel(id)`、`randomId(rng?)`、schema 版本檢查 | core |
| `useGame(level, difficulty, saved?)` | 盤面、head、放數／清除、undo、衝突、過關判定、steps、`markAssisted()`、提示；`saved` 有值即由存檔恢復 | core, useTimer |
| `useTimer()` | `elapsedMs`、start/pause/resume/stop；`visibilitychange` 隱藏即 pause（**規劃者決定**） | — |
| `useRecords()` | 最佳紀錄讀寫（localStorage） | — |
| `useProgress()` | 進行中對局自動存檔／讀取／刪除；`lastPlayed` 讀寫（§7.6） | — |
| `useSettings()` | 輸入模式偏好、locale | — |
| `useI18n()` | `t(key, params)`、`locale` | i18n |

`useGame` 不碰 localStorage；PlayView 以 `watch` 把 `useGame` 的快照交給 `useProgress`（debounce 300 ms）。

### 7.2 遊戲狀態

```ts
interface GameState {
  levelId: number;
  difficulty: Difficulty;
  grid: Uint8Array;            // 100
  steps: number;
  elapsedMs: number;           // 由 useTimer 同步
  assisted: boolean;           // 看過解答、用過提示、或過關前匯出含解答 PDF（markAssisted()）
  status: 'idle' | 'playing' | 'won';
  undo: Move[];                // Move = { cell, prev, next }
  selected: Cell | null;       // 指定模式
  pending: string;             // 指定模式輸入中的數字串
  inputMode: 'trail' | 'direct';
}
// 衍生 computed
head: number;        // 最大 h 使 1..h 全部已填（不要求相鄰；相鄰錯誤由 conflicts 標示）
headCell: Cell | null;
conflicts: Map<Cell, ConflictKind[]>;
isFull: boolean;
```

### 7.3 操作語意

- `place(cell, n)`：given 格或 `n ∉ [1,100]` → 拒絕（no-op，回傳 false）。否則寫入、推 undo、`steps += 1`（覆寫也算一次）、timer 若 idle 則 start、`status = 'playing'`。填滿後若 `isSolved` → `status = 'won'`、timer stop。
- `clear(cell)`：given → 拒絕；否則寫 0、推 undo，**不計步**。
- `undo()`：pop 一筆還原，**不計步、不減步**。拖曳的每一格各算一筆 Move。
- `reset()`：清除所有非 given 格、steps 歸 0、timer 歸 0、undo 清空、`status = 'idle'`、`assisted` 保留（看過解答就是看過）；PlayView 的「重新開始」按鈕呼叫前必先確認（文案：「清除目前盤面並重新計時？」），並由 PlayView 刪除該 key 的進度存檔。
- `markAssisted()`：`assisted = true`，冪等；看解答、提示、過關前匯出含解答 PDF 三處共用（§7.4、§6.9）。
- **接續模式**：`press(cell)` 或 `drag(cell)` 時，若 `cell` 為空且與 `headCell` 相鄰 → `place(cell, head + 1)`；若 `cell` 等於數字 `head − 1` 的格且 head 的格非 given → `clear(headCell)`（拖回即退一步）；其他一律 no-op（給 150 ms 的 shake 動畫）。head 落在 given 時自動跳過：例如 1…7 已填且 11 為 given，填 8、9、10 後 head 直接變 11，下一步要從 11 的格延伸。**實體鍵盤（規劃者決定，依審查修訂）**：方向鍵 ↑↓←→ 讓 head 往該方向延伸一格（目標格須存在、為空且不是 given，否則拒絕並 shake）；Backspace/Delete 撤回最後一格（等同 `undo()` 最後一步）；Tab（或 UI 的切換鍵）切換輸入模式；`Ctrl/Cmd+Z` → undo。
- **指定模式**：`press(cell)` 設 `selected`；`digit(d)` 把 d 接到 `pending`（**最多 3 字元**，使 100 可輸入；接上後數值 > 100 或前導 0 即忽略該鍵）；`confirm()`（螢幕鍵盤「確認」或 Enter）才 `place(selected, Number(pending))` 並清空 `pending`；**規劃者決定**：不自動確認，避免「1」與「10」的歧義。填入後 `selected` 留在原格不移動（「自動前進到相鄰空格」v1 不做）。實體鍵盤：數字鍵 → digit、Enter → confirm、Backspace/Delete → `pending` 非空則刪一字元，否則 `clear(selected)`、方向鍵移動 `selected`、Tab 切換輸入模式、`Ctrl/Cmd+Z` → undo。NumberPad 的 `pending` prop 型別同為最多 3 字元字串（§6.4）。
- 步數定義（**規劃者決定**）：**steps = 成功 `place` 的次數**，含覆寫；清除與 undo 不計也不扣。理由：簡單、可比較、不懲罰反悔但懲罰亂填。
- **過關即鎖盤（使用者裁定，2026-10-24）**：`status = 'won'` 後 `place`／`clear`／`undo`（含接續模式的 press／drag／方向鍵與指定模式的 confirm／backspace）一律拒絕、回傳 false，盤面、steps、計時器都不變；只有 `reset()` 解鎖並回到 `idle`。不存在 `won → playing` 的轉移。
- **`pending` 不因換格或切模式清空（使用者裁定，2026-10-24）**：指定模式下 `select()` 換到別格、`setInputMode()`／`toggleInputMode()` 切換模式時，`pending` 原樣保留；之後 `confirm()` 填入當下的 `selected`。只有 `confirm()` 成功與 `backspace()` 會改變 `pending`。
- 以存檔恢復時 `status` 照 §7.6 與 plan：grid 只有 given 為 `idle`，否則為 `playing`、計時器不啟動；即使存檔已是完整解答也一樣（正常流程過關即刪存檔，不會遇到）。

### 7.4 看解答與提示

- `viewSolution()`：第一次呼叫前 PlayView 彈確認（文案：「看過解答後，這局不列入最佳紀錄。」）；確認後 `markAssisted()`，開 SolutionView；可關閉繼續玩。
- `hint()`：§5.6；`markAssisted()`。
- 過關前匯出含解答頁 PDF：確認後 `markAssisted()`（§6.9）。
- **assisted 過關（規劃者決定，依審查修訂）**：仍寫入紀錄並標為已完成，但 `assistedClears += 1`、不更新 `bestMs`/`bestSteps`；WinModal 與 LevelPicker 顯示「輔助完成」標記（空心勾）。非 assisted 過關：`clears += 1`、更新最佳值。某張同時有兩種過關時 LevelPicker 顯示實心勾（以正常過關為準）。

### 7.5 localStorage（key 前綴含版本）

前綴 `prime-trail:v1:L<libraryVersion>:`，`v1` 為儲存格式版本、`L<n>` 為題庫版本（§3.5）。v1 發佈時為 `prime-trail:v1:L1:*`。

| key（去前綴） | 內容 |
|---|---|
| `records` | `{ [\`${levelId}:${difficulty}\`]: { bestMs: number \| null, bestSteps: number \| null, clears: number, assistedClears: number, lastClearedAt: string } }`；`bestMs` 與 `bestSteps` **只取非 assisted 的局**、各自取最小，可能來自不同局（**規劃者決定**）；只有 assisted 過關時兩者為 `null` |
| `progress` | `{ [\`${levelId}:${difficulty}\`]: { grid: number[], steps, elapsedMs, assisted, inputMode, savedAt } }`，最多保留 20 筆（LRU 淘汰）；過關或「重新開始」即刪除該筆 |
| `lastPlayed` | `{ levelId, difficulty, savedAt } \| null`：最近一次有進度存檔的局；首頁「繼續上次」只看這個 key，對應的 `progress` 不存在時隱藏按鈕 |
| `settings` | `{ inputMode: 'trail' \| 'direct', locale: 'zh-TW' }`（**不含**題庫版本前綴：`prime-trail:v1:settings`，題庫換版不該清掉偏好） |

讀取時任何解析錯誤或 schema 不符 → 當作無資料、不丟錯。題庫換版（`libraryVersion` 遞增）即換前綴，舊紀錄與存檔自然失效、不遷移、不刪除。

### 7.6 進度恢復（**規劃者決定**，依審查修訂）

- 進入 `/play/:id/:difficulty` 時，PlayView 先向 `useProgress` 查 `${id}:${difficulty}`；有存檔 → 以 `saved` 建立 `useGame`（盤面、steps、elapsedMs、assisted、inputMode 全部恢復，timer 暫停直到下一次填入），並 toast「已恢復進度」；無存檔 → 新局。不論從首頁「開始」、「繼續上次」、WinModal「再來一張」或直接輸入網址進入，行為一致。
- PlayView 操作列有「重新開始」按鈕：確認後 `reset()` 並刪除該 key 的存檔。
- 每次 `useGame` 快照變動（debounce 300 ms）寫 `progress[key]` 並更新 `lastPlayed`；`status === 'won'` 時刪 `progress[key]`，若 `lastPlayed` 指向它則清為 `null`。
- 存檔的 `grid` 與目前題面不相容（given 格數值不符、長度不是 100）→ 視為無存檔並刪除該筆（防禦題庫換版漏改前綴的情況）。

---

## 8. 錯誤回饋規則

**選擇：即時標示、不阻擋**（**規劃者決定**）。放入數字後立刻重算 `findConflicts`，有衝突的格套 `.is-conflict`（紅字＋紅框）；衝突消失即解除。不等送出才檢查，理由：

1. 本遊戲沒有「送出」概念，過關是填滿瞬間自動判定；若等填滿才報錯，玩家要回頭找 1 格錯誤成本太高。
2. 接續模式本質上一步一驗證；指定模式若延後檢查，兩種模式手感不一致。
3. 不阻擋（除結構上不可能的操作）是為了允許玩家先暫放再調整，Sudoku 類 app 的慣例。

四種衝突（§2.7）全顯示，包含 `parity`：理由是它必然是錯（引理），早一步告知省時間；UI 圖例寫「此格只能放奇數／偶數」而不用「奇偶」術語。

結構上直接拒絕（不寫入、不標紅、shake 150 ms ＋ 不彈 toast）：改寫 given 格；接續模式點非相鄰或非空格；指定模式輸入超出 1–100。

兩種模式下的差異（兩種模式可隨時切換、共用同一盤面，所以標紅邏輯只有一套；差別只在「該模式自身的操作會不會製造該種錯誤」）：

| 情況 | 接續模式的操作會製造它嗎 | 指定模式的操作會製造它嗎 | 顯示 |
|---|---|---|---|
| 重複數字 | 不會（永遠放 head+1，且 head+1 必為空） | 會 | 兩格都標紅 `duplicate`；接續模式下盤面若留有先前在指定模式填入的重複，仍照常標紅 |
| 不相鄰 | 會（放 h+1 後若 h+2 已填且不相鄰 → h+1 與 h+2 標紅） | 會 | 標紅 `nonAdjacent` |
| 質數／灰底不符 | 會（例如 h+1 非質數卻踩進灰格）→ 玩家拖回即可 | 會 | 標紅 `primeMismatch` |
| 奇偶 | 不會（沿相鄰格延伸，引理保證） | 會 | 標紅 `parity`；接續模式下盤面若留有指定模式填入的奇偶錯，仍照常標紅 |

注意接續模式的 head 定義是「1…h 全已填」，不管是誰填的；若指定模式先填的數字有錯，接續模式會從錯的格接著延伸，紅格會一路提醒。

填滿但有衝突：toast「還有 n 格有錯」（紅格已標），不彈過關。

---

## 9. 手機版

- 版面：手機直立時頂列（回首頁、地圖／難度、計時、「？」操作說明）在上、棋盤其次、下方依序為資訊列（下一個數字或輸入中的 pending、步數）、輸入模式切換、數字鍵盤（指定模式才顯示）、操作列（復原／提示外露，看解答／匯出 PDF／重新開始收在「更多」選單）。2026-10-25 依 `2026-10-25-ui-refresh.md` §4 修訂；頂列與棋盤之間的首次操作提示卡與「？」說明見 `2026-10-25-controls-help.md`。
- 格尺寸：`--cell = clamp(30px, calc((100vw - 16px) / 11), 48px)`；11 = 10 格 ＋ 兩側各半格外框帶。360 px 寬手機 → 約 31 px；320 px → 27.6 px 低於 30 px 下限時棋盤容器允許水平捲動（極少數裝置）。桌機上限 48 px，棋盤約 530 px。
- 字級：數字 `calc(var(--cell) * 0.42)`（31 px 格 → 13 px），given 用 600 字重；兩位數與三位數（100）都要在 30 px 格內不換行（`font-variant-numeric: tabular-nums`）。
- 顏色對比（2026-10-25 依 `2026-10-25-ui-refresh.md` §3、§5.1 修訂）：龍頭格 `--pt-primary` `#2563EB` 藍底白字、質數格 `--pt-prime` `#FDE68A` 柔和黃、白格 `#fff`；衝突紅 `--pt-danger` `#B91C1C`；玩家填入的數字 `--pt-primary-strong` `#1D4ED8`。所有前景／背景對比 ≥ 4.5:1。PDF 維持灰階（§6.9）。
- 觸控／拖曳：
  - 接續模式：`.pt-board { touch-action: none }`，用 Pointer Events；`pointerdown` 在 head 格或與 head 相鄰的空格開始拖曳並 `setPointerCapture`；`pointermove` 以 `document.elementFromPoint` 查目前格（或預先計算格矩形做數學定位，較穩），進入新格即 emit `drag`；`pointerup/cancel` emit `dragend`。拖曳中頁面不捲動。
  - 指定模式：`.pt-board { touch-action: pan-y }`，單點 `press` 選格，頁面可正常捲動。
  - 棋盤之外的頁面不攔截捲動；棋盤高度 ≤ 視窗高度的 60% 以確保鍵盤可見（否則數字鍵盤改為 `position: sticky; bottom: 0`）。
- 不依賴 hover；`selected`／`head` 樣式用邊框與底色，不只靠顏色（衝突另加底線）。
- `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">`（避免雙擊縮放干擾拖曳）；長按選字用 `user-select: none` 於棋盤。

---

## 10. i18n 字串集中方式（**規劃者決定**：自寫 30 行 composable，不引入 vue-i18n）

- `src/i18n/zh-TW.ts`：`export const zhTW = { app: {...}, difficulty: { easy: '簡單', advanced: '進階', challenge: '挑戰' }, board: {...}, status: {...}, picker: {...}, win: {...}, solution: {...}, pdf: {...}, conflict: {...}, toast: {...} } as const;`
- `src/i18n/types.ts`：`export type Messages = typeof zhTW`（結構型別）；`en.ts` 必須 `satisfies Messages`，缺鍵即 typecheck 失敗。
- `src/i18n/index.ts`：`useI18n()` 回傳 `{ t, locale }`，`t('win.title')`、`t('status.steps', { n })`，參數以 `{n}` 置換；鍵型別為巢狀路徑字串聯集（型別層 `DotPath<Messages>`），拼錯鍵 typecheck 失敗。
- 文案規範：避免 Hidato／Numbrix；「龍頭」「質數格」「接續模式」「指定模式」「參考解」為固定術語。
- 結構性守門：Vitest `no-hardcoded-cjk.test.ts` 掃 `src/**/*.vue` 與 `src/**/*.ts`（排除 `src/i18n/`），出現 CJK 字元即失敗。

---

## 11. 部署

`wrangler.jsonc`（無 Worker 程式碼，不設 `main`）：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "prime-trail",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- `not_found_handling: "single-page-application"` 讓 `/play/12/easy` 直接開啟時回 `index.html`，vue-router history 模式才能用。
- 不需要 Worker 程式碼：無 API、無 header 客製需求。若日後要加 `Cache-Control` 或安全標頭，在 `public/_headers` 加即可（Static Assets 支援 `_headers`／`_redirects`），仍不需 Worker。
- `package.json` scripts：`dev`、`typecheck`（`vue-tsc --noEmit`）、`test`（`vitest run`）、`test:slow`（慢測，§12.2，非 DoD）、`test:e2e`（`playwright test`）、`build`（`vite build`）、`deploy`（`pnpm build && wrangler deploy`）、`gen:levels`、`gen:pdf-font`。
- **注意**：`pnpm deploy` 是 pnpm 的內建指令（部署 workspace 套件），會蓋掉同名 script；一律用 **`pnpm run deploy`**。CLAUDE.md 的部署說明要寫 `pnpm run deploy`。
- 步驟：`pnpm install` → DoD 全綠 → `pnpm run deploy`（內含 build）。首次需 `wrangler login`。
- `.gitignore`：`node_modules/`、`dist/`、`.wrangler/`、`.dev.vars`、`playwright-report/`、`test-results/`。

---

## 12. 測試策略

### 12.1 Vitest（`pnpm test`，DoD 一部分，目標 < 60 s）

- `core/geometry`：表格測試 `adjacent`、`isEdge`、`color`、`manhattan`、四方向邊界；fast-check 屬性：`adjacent` 對稱、`manhattan(a,b)=1 ⇔ adjacent`。
- `core/primes`：25 個質數、`primeIndex` 雙向。
- `core/path-codec`：fast-check 隨機合法路徑 `decode(encode(p)) = p`；非法字串（長度、字母、越界、重訪）拒絕。
- `core/validate`：一張 fixture 地圖：參考解 `isSolved` 為真；逐一注入每種衝突驗證 `findConflicts` 的 kind 與格；過關條件 1–5 各一個反例；「不同於參考解但合法」的構造例（用 fixture 中可交換的 2×2 段）。
- `core/solver`：fixture 地圖 easy → `count 1, exhausted`；移除某提示造成 2 解的構造例；`maxNodes` 用盡 → `exhausted false`；挑戰題面 `count ≥ 1`；`collect` 回傳的解通過 `isSolved`。
- `core/generator`：固定 seed 的 backbite 產出合法 Hamiltonian path 且起點在邊緣；相同 seed 兩次結果相同；不同 seed 不同。
- `data/levels.integrity`（**只做廉價檢查**，整檔 < 2 s；**規劃者決定，依審查修訂**）：讀 `levels.json`：`schema === 1`、`libraryVersion` 為正整數、`count === 1000`、每張 `s` 為邊緣格、`p` 匹配正規式且解碼為排列（Hamiltonian）、`h < 2^25` 且其 bit 對應的質數格都在 grey 內（提示一致）、`c` 為 null 或 `[1, CAP]`、連續 given 曼哈頓距離可達。**不跑 solver**。
- `data/levels.frozen`（凍結雜湊）：`levels.json` 的 SHA-256 必須等於 `src/data/levels.hash.txt` 內的值；兩者由 D4 一起 commit；之後任何改動都要同時更新雜湊並提升 `libraryVersion`（測試同時斷言：雜湊變了但 `libraryVersion` 沒變 → 失敗，實作方式為把 `libraryVersion` 也寫進 hash 檔的第二行）。
- **D4 之前的 skip 規則**：以上兩個測試檔在 `levels.json` 不存在時用 `describe.skipIf(!existsSync(path))` 跳過並 `console.warn('levels.json 尚未生成（D4）, 跳過')`；D4 任務負責移除 `skipIf`，之後缺檔即失敗。
- `i18n`：`en.ts` satisfies 由 typecheck 保證；`no-hardcoded-cjk`；`pdf-font-coverage`。
- `composables/useGame`（無 DOM）：接續模式 head 跳過 given、拖回退一步、方向鍵延伸與非法拒絕、Backspace 撤回最後一格、steps 定義、undo 不計步、`pending` 可輸入 `100` 且拒絕 `101`／前導 0、過關觸發、`markAssisted()` 冪等、以 `saved` 建構時盤面與 steps/elapsedMs/assisted 復原、`reset()` 回到 idle。
- `composables/useRecords`／`useProgress`：壞 JSON 不丟錯、LRU 淘汰、key 前綴含 `L<libraryVersion>`、assisted 過關只加 `assistedClears` 不動 best、非 assisted 過關更新 best 與 `clears`、過關刪 progress 並清 `lastPlayed`、不相容存檔被丟棄。
- 元件（`@vue/test-utils` + jsdom）：BoardCell class 對應、NumberPad emits、GameBoard 以 `press` 事件委派回傳正確 cell。
- `pdf/renderPuzzlePdf`：Node 下產生 Blob/ArrayBuffer，開頭為 `%PDF`，含解答頁時頁數為 2（jsPDF `getNumberOfPages`）；字型載入以注入的 loader stub。

### 12.2 慢測（`pnpm test:slow`，**不屬 DoD**，生成器完成、D4 commit 前與每次發佈前跑）

檔案放 `src/data/__slow__/`，Vitest 以獨立 config（`vitest.slow.config.ts`）或 `--project slow` 執行，預設 `pnpm test` 不包含。內容：

- 全部 1000 張：easy 唯一（`count 1, exhausted`）、advanced 唯一、`popcount(h) ≥ ADV_FLOOR`。預估數分鐘。
- 可重現性：以 `levels.json` 內 `seed` 重跑 backbite 對 10 張固定 id，路徑必須位元相同（驗證 PRNG 與演算法未漂移）。
- 抽樣 20 張 solver 的 `collect` 解通過 `isSolved`。

### 12.3 Playwright E2E（`pnpm test:e2e`，獨立列於 DoD 之外、合併前人工跑）

測試鉤子：`VITE_E2E=1` 時 `window.__primeTrail = { solutionOf(id) }` 暴露參考解（只在 E2E build／dev）。情境：

1. 桌機主流程：首頁輸入 1、選簡單 → `/play/1/easy` → 用接續模式依參考解點格 → WinModal 出現、時間與步數非零 → 回首頁顯示已過關勾號；重新整理後仍在。
2. 指定模式：選格、螢幕鍵盤輸入兩位數、確認；輸入重複數字出現兩個 `.is-conflict`；undo 後消失。
3. 手機（`devices['Pixel 7']`，`hasTouch`）：接續模式以 touch 拖曳連填 5 格；拖曳期間 `window.scrollY` 不變。
4. 看解答：按下 → 確認 → SolutionView 顯示；過關後 `records` 該 key 的 `assistedClears === 1`、`bestMs === null`；回首頁顯示空心勾／「輔助完成」。
5. 進度恢復（同網址）：填幾格 → `page.reload()` 同一 `/play/:id/:difficulty` → 盤面、步數復原，出現「已恢復進度」Toast；按「重新開始」→ 確認 → 盤面清空、`progress` 該 key 消失。
5b. 首頁「繼續上次」：在圖 A 填幾格、回首頁 → 「繼續上次」顯示 A 的編號與難度 → 點擊 → 盤面復原；另在首頁輸入 A 的編號按「開始」→ 同樣自動續玩。
6. PDF：匯出不含解答 → `page.waitForEvent('download')` → 檔頭 `%PDF`、檔名格式正確、`assisted` 不變；過關前勾「附解答頁」→ 出現確認 → 確認後狀態列顯示輔助標籤。
7. SPA 直達：直接開 `/play/500/challenge` 可進入（dev server 與 `wrangler dev` 各驗一次，後者驗 `not_found_handling`）。
8. 接續模式鍵盤：聚焦棋盤後按方向鍵延伸一格、往非法方向按不變且目標格 shake、Backspace 撤回、Tab 切到指定模式。

---

## 13. 建議的實作分階段（供寫 plan；每階段對應一層）

共用介面以 §3.3、§5.1、§6 的簽章為準；同層任務檔案集合兩兩不相交。

| 階段 | 任務（可平行） | 依賴 | 產出介面 |
|---|---|---|---|
| **A 骨架（單一任務）** | Vite+Vue+TS、Bootstrap SCSS、Vitest+jsdom+test-utils、Playwright 設定、`wrangler.jsonc`、`.gitignore`、scripts；**殘樁**：`src/core/types.ts`、`geometry.ts`、`primes.ts`（含測試）、`src/i18n/` 骨架與 `t()`、`BsModal/BsToast`、router 與空 views；**CLAUDE.md**：套件管理器改 pnpm、指令改 `pnpm typecheck`/`pnpm test`/`pnpm build`/`pnpm run deploy`、「完成定義」填三條 DoD、權威文件表加本 spec；backlog R1 結案 | — | 全部型別與幾何函式 |
| **B 純核心** | B1 `rng.ts` + `path-codec.ts` + `level-store(decode/derivePuzzle)`；B2 `validate.ts`（findConflicts/isSolved）；B3 `solver.ts`；B4 `generator.ts`（backbite）；B5 `i18n/zh-TW.ts` 全部字串 + `useSettings` | A | §3.3、§5.1 |
| **C 模組** | C1 `scripts/gen-levels.ts` + `gen-config.ts`（JSONL meta 逐張追加、續跑、`--ids`/`--partial`/`--assemble`、worker_threads、§4.8 檢查與 SHA-256 輸出）；C2 `GameBoard/BoardCell/HeadMarker` + `board.scss`（靜態呈現與事件委派，fixture 驅動）；C3 `useGame`（含 `saved` 恢復、`markAssisted()`、方向鍵延伸／Backspace 撤回的純邏輯）+ `useTimer`；C4 `useRecords`（`clears`/`assistedClears`、best 只取非 assisted）+ `useProgress`（`lastPlayed`、相容性檢查）+ `useLevelStore`（讀 `libraryVersion` 供前綴）；C5 `pdf/renderPuzzlePdf.ts` + `gen-pdf-font.ts` + 字型檔；C6 `NumberPad`、`StatusBar`、`LevelPicker`（含兩種完成標記）、`DifficultyPicker`、`WinModal`、`PdfExportDialog`（含確認與 `markAssisted` emit；純 props/emits 元件）；C7 `data/levels.integrity` 與 `levels.frozen` 測試檔（帶 `skipIf`，先以 fixture 驗測試本身） | B | 元件 props/emits、composable 回傳型別 |
| **D 接線** | D1 `PlayView`（兩種輸入模式接 GameBoard ↔ useGame、鍵盤含接續模式方向鍵／Backspace／Tab、衝突顯示、提示、看解答 SolutionView、過關流程、進入時自動恢復 + Toast、「重新開始」確認、progress/lastPlayed 寫入）；D2 `HomeView`（LevelPicker ↔ records/progress/levelStore、隨機、「繼續上次」只讀 `lastPlayed`）；D3 PdfExportDialog 接線（下載、`markAssisted` → useGame）；D4 跑 `pnpm gen:levels` 完整 1000 張 → 組裝 `levels.json`、寫 `levels.hash.txt`（含 `libraryVersion=1`）、commit `levels.meta.jsonl`、移除 C7 的 `skipIf`、跑 `pnpm test:slow` 全綠並貼輸出 | C | 可玩的完整流程 |
| **E 驗證與部署** | E1 Playwright 九個情境（§12.3）；E2 `pnpm run deploy` 首次部署、驗 SPA fallback、CLAUDE.md 守門結構補「部署前檢查」（DoD 全綠 ＋ `pnpm test:slow` 全綠） | D | — |

備註：

- C1 與 D4 分開是因為生成需要跑數十分鐘且產出大檔，獨立任務便於審查（D4 的 diff 幾乎只有 `levels.json`、`levels.meta.jsonl`、`levels.hash.txt` 與移除 `skipIf`）。D4 之前所有 DoD 跑的題庫測試都是 skip 狀態並印出原因，不會讓 DoD 紅。
- `pnpm test:slow` 不屬 DoD；但 D4 與 E2 的任務驗收指令必含它。
- C2 用 fixture 地圖（手工或 B4 以固定 seed 產生一張存成 `src/core/__fixtures__/level-fixture.ts`，由 B1 任務一併提供）即可開發，不等題庫。
- D1 是最大的接線任務，若要再拆：D1a 接續模式與拖曳、D1b 指定模式與鍵盤、D1c 看解答／提示／過關；但三者共用 `PlayView.vue`，需以子元件拆檔（`TrailInputLayer.vue`、`DirectInputLayer.vue`、`PlayActions.vue`）才能平行。
- 模型建議：B3、B4、C1、C3、D1 用較強模型；C6、B5、E1 文件類可用較省模型。

---

## 14. 風險清單

| 風險 | 影響 | 緩解 |
|---|---|---|
| 挑戰解數計算最壞情況超出預算 | `c` 大量為 null，候選挑選失去意義 | 節點預算而非時間；null 視為最大仍可比較；§4.7 的降級順序 |
| 進階 greedy 在 given 少時 solver 變慢 | 生成總時間拉長 | `ADV_FLOOR = 6` 下限；`ADV_BUDGET` 保守視為不唯一；worker_threads 平行 |
| 簡單難度唯一解丟棄率高於預期 | attempt 多、生成慢 | 便宜（< 10 ms），即使丟 90% 也可接受 |
| 挑戰模式多解 | 玩家解 ≠ 參考解、「提示」可能誤導 | 過關不要求等於參考解；SolutionView 顯示「你的解也合法」；提示文案明說依參考解 |
| 手機 10×10 可讀性 | 31 px 格、13 px 數字偏小 | 兩模式切換、拖曳連填降低精準點擊需求、given 粗體、下限 30 px 以下允許捲動；上線前真機驗 |
| Bootstrap reboot/utilities 與自寫 Grid 衝突 | `button` 預設樣式、`box-sizing`、字級繼承破壞格排版 | 棋盤用獨立 `pt-` 前綴 class、不套 `.btn`、`.pt-cell` 顯式 reset（`appearance:none; border:0; padding:0; font: inherit`）；只匯入需要的 Bootstrap 部件 |
| jsPDF 中文字型體積 | 全字型 8–10 MB 不可接受 | build 期子集化到 15–30 KB、匯出時才載入、覆蓋率測試；載入失敗退英文標籤 |
| 題庫資料大小 | 首頁 JS 變肥 | 動態 import 獨立 chunk；170 KB 原始／~40 KB 壓縮；超過 500 KB 才分片 |
| 題庫凍結與生成器演進衝突 | 修 bug 後重跑會換掉所有地圖 | §3.5：發佈後全檔凍結（含 `h`），凍結雜湊測試擋改動；要改就提升 `libraryVersion` 並換 localStorage 前綴，舊紀錄自然失效 |
| 拖曳與頁面捲動衝突 | 手機誤捲、誤填 | 接續模式 `touch-action:none` 僅限棋盤、指定模式 `pan-y`；E2E 情境 3 驗 scrollY |
| Bootstrap JS 不使用 → Modal 無障礙細節自負 | 焦點陷阱、Esc、aria | BsModal 實作清單寫進 plan 驗收：`role="dialog"`、`aria-modal`、焦點回復 |
| `pnpm deploy` 內建指令衝突 | 部署指令誤執行 | 文件一律 `pnpm run deploy` |
| 時間計算在背景分頁 | 計時不公平 | `visibilitychange` 暫停；以 `performance.now()` 差值累加 |

---

## 15. 留給實作者決定的事項與開放問題

### 15.1 實作者可自行決定（不需回問）

- `hash32` 用 FNV-1a 或 Murmur3；PRNG 用 sfc32 或 xoshiro128**（擇一後寫進 `generator` 字串）。
- Solver 連通性檢查頻率（每步或度數變化時）、Warnsdorff 平手次序。
- `scripts/` 的 worker_threads 切分方式與 meta JSONL 行內欄位（必含 §3.2 列出的欄位）。
- 凍結雜湊的計算方式（整檔 bytes 或 canonical JSON）；兩行 hash 檔的確切格式。
- 字型 cmap 解析庫（opentype.js／fontkit）、子集化工具（`subset-font` 或 `pyftsubset`）。
- 拖曳定位用 `elementFromPoint` 或矩形運算。
- Shake／高亮動畫參數、顏色微調（在 §9 給定對比範圍內）。
- 元件內部拆檔與 SCSS 組織；是否用 `<Transition>`。
- Vitest 環境（jsdom 或 happy-dom）。
- PDF 內的字級、邊距、圖例排版。
- E2E 測試鉤子的暴露方式（`import.meta.env.VITE_E2E`）。

### 15.2 需要使用者裁定（規劃者已先選、可推翻）

1. 「提示下一步」是否納入 v1（規劃者：納入，依參考解，計為 assisted；§5.6）。
2. 角落龍頭畫兩個三角形（§6.3）。
3. `parity` 衝突即時標紅（§2.7、§8）。
4. 步數定義：成功填入次數，含覆寫，清除與 undo 不計不扣（§7.3）。
5. 計時在分頁隱藏時暫停（§7.1）。
6. 最佳時間與最佳步數各自取最小、可來自不同局、只取非 assisted 局（§7.5）。
7. 隨機抽圖不排除已過關（§6.6）。
8. 進階提示下限 6 個、無上限（§4.5）。
9. 指定模式一律按確認／Enter 才填入（§7.3）。
10. 題庫 `c` 的 CAP = 1000、挑戰候選數 K = 3（§4.6）。
11. 中文字型採 Noto Sans TC（OFL）。
12. 不用 Bootstrap JS，自寫 Modal／Toast（§6.10）。
13. CLAUDE.md 目前寫 npm，本 spec 依使用者指示改為 pnpm，階段 A 一併修正。

以下為 Builder 審查後由規劃者裁定寫入的項目（已納入對應章節，列此供使用者一次確認）：

14. 進入 `/play/:id/:difficulty` 有存檔即自動恢復並 Toast「已恢復進度」，「重新開始」需確認；首頁「繼續上次」只對應 `lastPlayed`（§7.6、§6.6）。
15. 題庫發佈後全檔凍結含 `h`；任何題面變動必升 `libraryVersion`，localStorage 前綴 `prime-trail:v1:L<n>:*`；`--recompute` 只限發佈前（§3.5、§7.5）。
16. 過關前匯出含解答頁 PDF 需確認並計為 assisted；過關後或未開局匯出不影響（§6.9）。
17. assisted 過關仍標已完成但用「輔助完成」空心勾；`clears` 與 `assistedClears` 分欄；best 只取非 assisted（§7.4、§7.5）。
18. 接續模式鍵盤：方向鍵延伸、Backspace 撤回、Tab 切模式（§7.3）。
19. 生成器 I/O：JSONL meta 逐張追加可續跑，`levels.json` 只在 1…1000 全齊時由 meta 組裝；`--ids` 只寫 meta 與可選 `levels.partial.json`（§4）。
20. `pending` 最多 3 字元；題庫測試在 D4 前 `skipIf` 並印原因；DoD 內題庫測試只做廉價檢查與凍結雜湊，重量檢查在 `pnpm test:slow`（非 DoD）（§7.3、§12）。
