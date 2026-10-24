## 2026-10-24 C7 題庫完整性、凍結雜湊與慢測（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md）

- **起因**：plan `docs/superpowers/plans/2026-10-24-prime-trail.md` Task C7（taskboard GAME-15）。D4 生成題庫之前，就要先把 spec §12.1 的廉價檢查與凍結雜湊、§12.2 的慢測寫好，讓 D4 只需移除 skip。
- **裁定（使用者）**：無（照已核准的 plan 做）。
- **做法**：
  - `helpers.ts` 用 `import.meta.glob(['/src/data/levels.json', '/src/data/levels.hash.txt'], { query: '?raw', eager: true })` 讀檔，不用 `node:fs`／`node:crypto`。原因是 `src/**` 走 `tsconfig.app.json`（`types: ["vite/client"]`，沒有 Node 型別）；如果用 `/// <reference types="node" />` 補型別，`setTimeout` 等全域型別會汙染整個 app program。glob 比對不到檔案時回傳 `{}`，所以缺題庫時是 skip 而非 import 失敗；`?raw` 拿到的是原始文字，雜湊涵蓋的位元組和 C1 寫出的檔案一致（`JSON.stringify` 加 `\n`）。
  - `sha256Hex` 是自寫的純 TS SHA-256（對 UTF-8 位元組計算），常數由前 64 個質數的平方根、立方根小數部分算出，不手抄表。用 FIPS 180-4 的四個向量驗證（含 1,000,000 個 `a` 的多區塊案例）。介面和 C1 的 `sha256Hex(text)` 相同，兩邊對同一字串應得同值。
  - 雜湊檔格式照 C1 的 `writeLevelFiles`：第一行 64 位小寫 hex，第二行 `libraryVersion=<n>`。解析抽成純函式 `parseHashFile`，在 `helpers.test.ts` 直接測，不靠真檔。
  - `checkLevelFile` 回傳全部錯誤，不在第一個錯誤就丟例外（`parseLevelFile` 會丟），方便一次看出多張壞題；它以執行期型別檢查輸入，所以 `readLevelFile` 只做 `JSON.parse`、不做驗證。依 plan 不驗「`h` 的 bit 對應的格在 grey 內」，因為解碼結構保證必然成立。連續 given 可達同時檢查距離 ≤ 數值差與奇偶，easy 和 advanced 都檢查。`count === 1000` 不放進 `checkLevelFile`，由 integrity 測試另外斷言，這樣 3 張的 fixture 檔也能通過。
  - plan 提到可用 `vi.mock` 或環境變數 `PRIME_TRAIL_LEVELS_PATH` 指向 tmp 檔，這裡沒有做：檢查邏輯已是純函式，直接把記憶體裡的 3 張 fixture `LevelFile` 交給 `checkLevelFile` 即可，不必經過檔案系統。
  - skip 寫成單一行 `describe.skipIf(skipWithoutLevels())(...)`。`skipWithoutLevels()` 在缺檔時 warn 一次，D4 把該行改成 `describe(...)` 即可。之後缺檔時 `readRaw` 會丟 `not found`，測試失敗。
  - 慢測的生成參數（100_000／10_000、200_000／2_000_000、floor 6、5_000_000）寫成字面值並註明出處 `scripts/gen-config.ts`。C1 和本任務同層，C1 還沒合併，無法 import。
- **守門**：新增 `src/data/__tests__/` 3 檔、`src/data/__slow__/` 3 檔。`pnpm test` 由 14 檔、136 案變為 15 檔通過＋2 檔 skip，156 案通過＋4 案 skip，skip 的兩檔都印出 warn。`pnpm vitest run -c vitest.slow.config.ts` 為 3 檔 skip、15 案 skip。DoD 三條全綠。
- **流程**：單 agent 在 worktree `task/GAME-15` 直接實作（範圍小，沒有 fan out）。
- **踩坑**：skip 時的 warn 在預設 reporter 不會顯示，要加 `--reporter=verbose` 才看得到 stderr。題庫存在時的路徑（glob 的 key 是 `/src/data/levels.json`、`?raw` 讀 JSON）受禁區限制，本任務不能造題庫檔，所以沒有實測；D4 第一次跑時會驗到。
- **遺留**：見 `docs/backlog/drafts/GAME-15.md`（雜湊與參數和 C1 重複定義）。
