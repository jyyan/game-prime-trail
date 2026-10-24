## 2026-10-24 B1 路徑編碼與關卡解碼（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md）

- **起因**：plan `docs/superpowers/plans/2026-10-24-prime-trail.md` Task B1（taskboard GAME-3）。C 層的生成腳本、`useGame`、儲存層、PDF 都要從 `LevelRecord` 拿到 `Level`／`Puzzle`，這層必須先有。
- **裁定（使用者）**：無（照已核准的 plan）。
- **做法**：`src/core/path-codec.ts` 與 `src/core/level-decode.ts` 都是純函式，只 import `types`／`geometry`／`primes`，不碰 Vue 和 DOM。`PathCodecError.index` 定為「出錯的位置」：在 `decodePath` 是 `dirs` 的字元索引，在 `encodePath` 是壞步起點的 path 索引；長度錯、起點不是格子這類整體性錯誤給 `-1`。這樣生成器與測試輸出能直接指到哪一步壞掉。`encodePath` 除了 plan 列的長度與相鄰檢查，也擋格子越界與重訪：這兩種輸入若能編出字串，`decodePath` 就解不回原路徑，round-trip 的保證會破。`derivePuzzle` 依質數由小到大填 givens（`start→1` 放第一個），並複製一份 `grey`，因為 `Puzzle` 會交給 composable，不希望它改到 `Level` 的資料。`parseLevelFile` 除了 plan 列的檢查，也依 spec §3.2 擋 `s` 不是邊緣格、`h ≥ 2^25`、`c` 不在 `null ∪ [1, 1000]`、`seed` 不是 32-bit 無號整數，錯誤訊息都帶 `levels[i].<欄位>`。刻意不做的有兩件：一是不強制 `count === 1000`（plan 的測試用 `count:1`，只要求跟 `levels.length` 一致）；二是不在 parse 時把每筆 `p` 解成路徑。路徑合法性留給 `decodeLevel` 呼叫時檢查，以及 C7 的題庫完整性測試。
- **守門**：測試檔 5 → 7、案數 29 → 55（`path-codec.test.ts` 12 案，含 fast-check：兩條 fixture 路徑及其反轉的 round-trip；`level-decode.test.ts` 14 案）。DoD：`pnpm typecheck` 通過、`pnpm test` 7 檔 55 案全綠、`pnpm build` 成功。
- **流程**：已核准 plan → 單一 agent 在 worktree `task/GAME-3` 依 TDD（先寫失敗測試再實作），以一個 commit 交付，由主 session 合併。
- **踩坑**：`unknown` 跟 `number` 比過 `!==` 之後 TS 不會收窄型別，所以 `parseLevelFile` 回傳的 `count` 改用 `levels.length`。
- **遺留**：無。
