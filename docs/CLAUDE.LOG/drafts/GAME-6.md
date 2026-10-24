## 2026-10-24 B4 Backbite 隨機 Hamiltonian path 生成（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md）

- **起因**：plan `docs/superpowers/plans/2026-10-24-prime-trail.md` 的 Task B4（taskboard GAME-6），C1 題庫生成腳本要用它產每張關卡的參考路徑。
- **裁定（使用者）**：無（照 spec §4.1–§4.2 的規劃者決定：backbite）。
- **做法**：新增 `src/core/generator.ts`，只 import `geometry`、`primes` 與 `types`（`Rng` 由呼叫端注入），不碰 B1–B3 的模組（同層互不 import）。`backbiteStep` 依 plan 字面「選該端點的非路徑鄰接相鄰格」：先濾掉端點在路徑上的鄰居再 `rng.pick`，所以每步必定改變路徑（每個端點至少兩個格鄰、只有一個是路徑鄰居）；代價是不完全等於 Mansfield 原版「含空步」的均勻取樣，對遊戲多樣性無影響。反轉用 `subarray().reverse()` 原地做、位置用 `indexOf`，測試檔含二十多次十萬步整檔約 1 s。`randomHamiltonianPath` 的端點上限語意：在 `steps` 之後最多再做 `edgeExtraMax` 步，仍無邊緣端點即回 `null`（`edgeExtraMax=0` 表示不加步）；兩端皆邊緣時才擲 `rng.int(2)`，只有一端邊緣時不耗 PRNG，選尾端時整條反轉。PRNG 消耗順序是位元可重現的一部分，C1 起不可再改，否則題庫要升版。`greyOf` 與 `level-decode` 內的灰底計算重複兩行，為守同層不互 import 刻意保留。
- **守門**：新增 `src/core/__tests__/generator.test.ts` 8 案（蛇行、每步合法、十萬步 < 2 s 且起點在邊緣、可重現與跨 seed 不同、20 seed 多樣性與起點 ≥ 5 格、零步擲硬幣在 0／90、`edgeExtraMax=0` 會出 `null`、`greyOf` 對 fixture）。全套 7→8 檔、55→63 案；`pnpm typecheck`、`pnpm test`、`pnpm build` 全綠。
- **流程**：單 agent 在 taskboard worktree `task/GAME-6` 實作，基底 1999dfd。
- **踩坑**：無。
- **遺留**：無。
