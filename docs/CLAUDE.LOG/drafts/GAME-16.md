## 2026-10-24 GAME-16（D1）PlayView 接線（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md）

- **起因**：plan Task D1；C 層的 composable 與元件都已就位，PlayView 仍是空殼。
- **裁定（使用者）**：沿用 spec §7.3 已裁定的「過關即鎖盤」與「pending 不因換格或切模式清空」，`useGame` 已照做，本任務只在接線層配合（過關後棋盤 `readonly`、session 的輸入處理在 `won` 時直接略過，不 shake）。
- **做法**：
  - 邏輯全部放在 `usePlaySession`，PlayView 只做組裝，理由是鍵盤／指標分派、存檔 debounce、過關結算都能在無 DOM 的單元測試裡驗，不必 mount 整個頁面。
  - 每局遊戲在一個 detached `effectScope` 內建立：`useGame` 自帶的計時器與本局的 watcher 都掛在這個 scope，換圖或換難度（同一個 PlayView 實例、路由 props 變動）時整個 scope 停掉，舊計時器不會殘留；換局前與元件卸載前先把尚未寫出的 debounce 存檔寫掉，`pagehide` 也會觸發寫出，避免 300 ms 內重新整理丟最後一步。
  - 自動存檔只在 `playing`、或 `idle` 但已 assisted 時寫：否則「重新開始」刪掉存檔後，`reset()` 引起的盤面變動會立刻再存一份只有 given 的空局、讓 `lastPlayed` 指向空局。已 assisted 的 idle 局仍要存，否則「先看解答、重新整理」就能洗掉輔助標記。
  - 過關：取消 debounce、`progress.remove`（同時清 `lastPlayed`）、`records.recordClear`、開 WinModal；存檔 watcher 與過關 watcher 同一 tick 觸發時順序不保證，所以 `shouldSave` 對 `won` 一律拒絕，保證過關局不會被「復活」存檔。
  - 「還有 n 格有錯」的 n 取紅格數（`conflicts.size`），與畫面上標紅的格數一致；以「是否填滿且未過關」的 computed 變化觸發，所以每次填滿只提示一次，覆寫同一格不再提示。plan 的測試描述「最後兩格互換 → 還有 2 格有錯」與實際紅格數不符（98→99 不相鄰也會標紅，共 3 格），測試照紅格數斷言 3，見 backlog 草稿。
  - 鍵盤：Tab 切模式並 `preventDefault`，但 Shift+Tab 不攔，讓鍵盤使用者仍能把焦點移出棋盤；`Ctrl/Cmd+Z` 兩模式皆 undo；接續模式方向鍵被拒時 shake 目標格（出界則 shake 龍頭格）；指定模式方向鍵在尚未選格時先選龍頭格（無龍頭則起點）。
  - 看解答：已 assisted 或已過關都不再確認；過關後看解答不再 `markAssisted`（紀錄已寫入，問「這局不列入最佳紀錄」會誤導）。所有 `confirm()` 都傳 `common.confirm`／`common.cancel`（R28）。`PdfExportDialog` 照現有兩個 props 接（R29 不動）。
  - WinModal「隨機下一張」：抽到同一張就換抽，題庫只有一張時就地重開（路由不變不會重建 session）。
  - `installE2eHooks(store, env = import.meta.env)` 多一個可注入的 env 參數，只為了單元測試；預設行為與 plan 介面一致。
  - i18n 只在 play／solution 兩個命名空間補鍵：`play.loadError`、`play.actions`、`solution.switchView`。
- **守門**：新增 3 個測試檔、42 案（usePlaySession 26、SolutionView 6、PlayView 10，後者含 3 案 `installE2eHooks`）。`pnpm test` 455 passed／5 skipped；`pnpm typecheck`、`pnpm build` 綠。
- **流程**：layer D workflow，獨立 worktree、分支 `layer-D/D1`，基底 32fac7a；草稿檔名依 taskboard 用 `GAME-16.md`（plan 寫 `drafts/D1.md`）。
- **手測步驟（plan 完成證據要求，本次未執行）**：`pnpm gen:levels --ids 1-3 --partial` 後暫時把 `src/data/levels.partial.json` 複製為 `src/data/levels.json`，`pnpm dev` 開 `/play/1/easy` 依序試接續模式點格與拖曳、方向鍵、Tab 切模式、指定模式數字＋Enter、提示、看解答、重新開始、重新整理後的「已恢復進度」、填完過關的 WinModal 與 PDF 匯出；手測完刪掉複製的 `levels.json`，**不 commit**。
- **踩坑**：easy 難度 1、2、3、5、7… 都是 given，fixture 起點旁第一個可點的空格是數字 4（cell 29），初版測試誤以為 3 可點而全數失敗；fake timers 也會假造 `setImmediate`，`flushPromises` 不能用，改以多輪 `await Promise.resolve()` 推進微任務。
- **遺留**：見 `docs/backlog/drafts/GAME-16.md`。
