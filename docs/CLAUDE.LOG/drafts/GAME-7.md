## 2026-10-24 B5 i18n 字串表、useI18n 與 CJK 守門（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §10）

- **起因**：plan `docs/superpowers/plans/2026-10-24-prime-trail.md` Task B5（taskboard GAME-7）。C、D 層所有元件都要 import 字串表，所以字串表要先在 B 層建好。
- **裁定（使用者）**：無新裁定；沿用 spec §10 規劃者決定（自己寫 composable，不引入 vue-i18n）與 plan 的「一命名空間一檔」。
- **做法**：
  - `src/i18n/zh-TW/<ns>.ts` 共 13 個命名空間檔，`zh-TW/index.ts` 一次登錄全部。這樣 C／D 層各任務只改自己被指派的那一個命名空間檔，同層的 Files 清單不會相交，`index.ts` 之後不用再動。
  - `MessageKey = DotPath<typeof zhTW>`，拼錯鍵在 typecheck 就會失敗，測試以 `@ts-expect-error` 釘住；runtime 遇到缺鍵就回傳鍵名並 `console.warn`。路徑停在非葉節點（命名空間）時也算缺鍵，不會把物件字串化後顯示出來。
  - 沒帶到參數的 `{name}` 佔位符原樣保留、不換成空字串，畫面上缺參數一眼就看得出來。
  - CJK 守門用 Vite 的 `import.meta.glob(..., { query: '?raw', eager: true })` 讀原始碼，不用 `node:fs`。原因：`tsconfig.app.json` 的 `include` 涵蓋 `src/**/*.ts`（含測試），`types` 只有 `vite/client`、沒有 `@types/node`，若在測試裡 import `node:fs` 會讓 typecheck 失敗或必須改 tsconfig（A1 的檔、B 層禁改）。另外加了「掃描清單包含 `/src/App.vue`、`/src/core/types.ts` 且不含 i18n／測試檔」的案例，避免 glob 寫錯時掃到 0 個檔、守門形同虛設卻仍然綠燈。
  - CJK 正規式寫成 `\u` 跳脫字元（U+3400–U+9FFF、U+F900–U+FAFF），讓測試檔本身不含不可見的寬字元範圍端點。
  - 文案照 §10 固定術語（龍頭、質數格、接續模式、指定模式、參考解）；parity 用「此格只能放{parity}」配 `conflict.odd/even`，不出現「奇偶」二字（§8）。
- **守門**：測試檔 5 → 7、案數 29 → 43（`i18n.test.ts` 11 案、`no-hardcoded-cjk.test.ts` 3 案）。A1 既有檔案通過 CJK 掃描。DoD：`pnpm typecheck` 綠、`pnpm test` 7 files／43 tests 綠、`pnpm build` 綠。
- **流程**：taskboard 派工單 agent，在 worktree `task/GAME-7` 實作；第一次 run 因 API timeout 中斷，第二次因等待 vitest 核准而停駐，核准後接續完成。
- **踩坑**：worker 環境的 Bash 指令需要人核准，等待 30 分鐘就停駐；能事先放行的驗收指令最好先放行。
- **遺留**：backlog 草稿一項（spec §10 的檔案佈局與命名空間清單要同步成 plan 的版本）。
