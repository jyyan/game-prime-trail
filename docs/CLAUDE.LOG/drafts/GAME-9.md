## 2026-10-24 C1 題庫生成腳本（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md）

- **起因**：taskboard GAME-9（plan Task C1）。D4 要在本機長時間跑出 1000 張凍結題庫，需要一支可中斷續跑、結果與分批方式無關、組裝前自驗的生成腳本。
- **裁定（使用者）**：無（照 plan 與 spec §4 的規劃者決定）。
- **做法**：
  - 純邏輯放 `scripts/lib/`（`gen-level`、`meta`、`assemble`、`cli`），`gen-levels.ts` 只管 I/O、worker 池與統計，測試全打在 lib 上，不必真的起 worker。
  - **greedy 的 rng 沿用該候選 backbite 之後的狀態**（plan「用該候選的 rng 洗牌順序」）。好處是 `seed` 一個值就能完整重建：`createRng(seed)` → 重跑 backbite → rng 狀態就是 greedy 起點。`--recompute h,c` 因此不必另存 rng 狀態，`recomputeRow` 還會比對重建出的路徑，路徑對不上（backbite 參數或演算法漂移）就拒絕。
  - **`--recompute` 的結果必須等於用新參數從零生成**（spec §4.3：同 generator＋masterSeed 必產出位元相同的 `levels.json`；審查第 1 輪指出初版只重算選中候選的 `c` 而不重選，調 `challengeBudget` 後續跑與全新生成會挑到不同路徑）。現在重算 `c` 會把 meta 記下的每個候選從 seed 重建、全部重數、重新挑選；挑選換人時即使沒要求 `h` 也重跑 greedy。不在重算範圍內的參數（路徑與 easy 篩選相關的 `masterSeed`、`backbiteSteps`、`edgeExtraMax`、`easyBudget`、`candidates`、`maxAttemptsPerLevel`，以及沒要求重算那段的預算）必須與該行建立時相同，否則拒絕、要求整張重生；為此每行 meta 多存一份 `config` 快照。測試以「重算結果 == 新參數 `generateLevel`」逐欄比對（c、h、h＋c 三種），並用一個確定會換候選的案例（id 5）確保測試真的走到重選。
  - `c` 的語意：解數達 cap 記 cap（表示 ≥ CAP），預算用盡記 `null`；挑選時 `null` 排最後、平手取 attempt 小者（候選本來就依 attempt 排序，嚴格小於才換即可）。
  - meta 的「完成」以 `generator` 字串**且** `config` 快照都與目前 `gen-config.ts` 相同為準：改了參數（就算忘了升版本字串）舊行也會視為未完成而重生，組裝也只用當前參數的行，避免新舊參數混在同一份 `levels.json`。`--recompute` 吃任何版本的既有行，由上一條的檢查決定能否沿用。
  - `appendMeta` 寫入前若檔尾不是換行（上次中斷在半行），先補一個換行，否則新行黏在殘行後面、兩張一起變壞行。
  - `verifyLevelFile` 先用 `parseLevelFile` 做結構檢查，再對每張做提示一致、`popcount(h) ≥ advFloor`、相鄰 given 距離／奇偶可達、easy 與 advanced 唯一（solver 預算與生成時相同，生成時通過的不會在驗證時因預算不同而誤判）。
  - **worker 載入方式**：`new Worker(new URL('./lib/worker.ts', import.meta.url))`，不額外指定 `execArgv`；Node 24 的 worker 預設繼承主執行緒的 `process.execArgv`，tsx 的 loader 跟著進去，`.ts` worker 直接可跑（試跑已驗證）。
  - `--partial` 的 `levels.partial.json` 只給開發用，不驗唯一；`levels[i]` 是第 i 個已生成的 id，ids 不連續時不等於 id i+1。
- **守門**：新增 4 個測試檔、28 案（meta 5、cli 4、assemble 7、gen-level 12）；`pnpm test` 136 → 164 案全綠，script 測試約 10 s（重算一致性案例各要重生 id 5）。`pnpm typecheck`、`pnpm build` 綠。
- **流程**：CTO session 單 agent 在 `task/GAME-9` worktree 直接實作（C1 七個檔彼此耦合，拆 subagent 的整合成本高於收益）。試跑 `pnpm gen:levels --ids 1-3 --workers 1 --partial`，產物已刪、不 commit；草稿檔名依 taskboard 治理用 `GAME-9.md`（plan 寫的是 `drafts/C1.md`）。
- **踩坑**：greedy 的「多次重啟取最小」測試若用 `advFloor: 1` 加 2M 預算，提示少時 solver 很貴，單案超過 5 s；改用 20 000 節點的小預算（算不完視為不唯一，結果仍確定），整檔回到 3 s 內。
- **遺留**：見 `docs/backlog/drafts/GAME-9.md`。

實測（本機 macOS、Node 24、單 worker、正式參數，供 D4 估時）：

| id | 選中 attempt | hints | c | easy／adv／chal 節點 | ms |
|---|---|---|---|---|---|
| 1 | 13 | 6 | 2 | 9 435／118 961／9 755 819 | 8 667 |
| 2 | 5 | 6 | 1 | 10 233／785 921／5 344 791 | 5 708 |
| 3 | 21 | 6 | 1 | 17 128／1 014 419／9 426 689 | 9 576 |

平均約 8.0 s／張，牆鐘 24 s。推估 1000 張單執行緒約 2.2 小時，8 worker 約 17–20 分鐘，在 spec §4.7 估計內。時間大頭是挑戰解數（每張 5–10M 節點，id 1 的 attempt 0 候選吃滿 5M 預算記 `null`）；easy 丟棄率比 spec §4.4 估的 20–50% 高（湊 3 個候選用了 9–22 次 attempt）；三張進階提示數都停在 floor 6。
