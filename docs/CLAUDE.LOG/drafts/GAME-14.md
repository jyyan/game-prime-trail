## 2026-10-24 GAME-14 C6 純 props/emits 元件（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md §6.4–§6.7、§6.9）

- **起因**：plan 層 C 的 Task C6；D1（PlayView）與 D2（HomeView）要組裝這七個元件，先把畫面元件做成不碰 composable 的純 props/emits，讓 D 層只寫接線。
- **裁定（使用者）**：無（沿用 spec 與 plan 介面）。
- **做法**：
  - 七個元件只吃 props、只發 emits；唯一例外是 `PdfExportDialog` 依 plan 直接呼叫 `useConfirm()`，確認流程（勾選「附上參考解」且 `gameStatus==='playing'` → 確認 → `markAssisted` 或取消勾選）留在元件內，PlayView 不必知道勾選狀態。
  - `PdfExportDialog` 介面照 plan 只有 `{ modelValue, gameStatus }`：初版多加的選填 prop `assisted`、session 計數與確認中停用狀態，審查認定超出 plan 而移除；只保留「每次開啟重設勾選」。已 assisted 的局再勾解答頁仍會再問一次（見 backlog 草稿）。
  - `LevelPicker` 內部持有難度（預設 easy）並內嵌 `DifficultyPicker`；完成標記與最佳值只在編號合法時查詢；依 plan 字面「編號不在 1…count 時顯示 `picker.invalidId`」，空白欄位也算不合法、同樣顯示訊息（初版空白不顯示，審查認定為 plan 外的行為裁定而改回）。輸入解析：空白、非數字一律回 `null`，小數照原值回傳交給驗證判不合法。
  - `DifficultyPicker` 的完成標記：實心勾 U+2714＋visually-hidden「已完成」、空心勾 U+2713＋可見「輔助完成」（§6.6）。
  - `StatusBar` 把「地圖 #0123・進階・12:34・步數 57」組成一行字串，時間不用 `status.time` 前綴，照 §6.5 的樣式。
  - `formatMs`、`padId` 放在 `src/components/format.ts`，D 層共用。
  - i18n 只在 input／status／picker／win 四個命名空間補鍵（`input.pad`、`status.label`、`picker.difficulty`、`win.bestTime`、`win.bestSteps`）；PDF 對話框沿用既有 `pdf.*`、`common.*`，未改那兩個檔。
- **守門**：新增 8 個測試檔、57 案（審查後補：DifficultyPicker 選取態 class／aria-pressed、最佳值缺項、完成標記字元；WinModal 步數徽章、雙徽章、bestMs／bestSteps 為 null；PdfExportDialog 改用真實 click、每案前斷言 confirm 單例無殘留、取消勾選與再次勾選、狀態切換；LevelPicker 小數／非數字／前導零輸入解析與 Enter 不越過驗證）。`GameStatus` 只有 idle／playing／won，無 paused 可測。`pnpm test` 164 → 221 案、26 檔全綠；`pnpm typecheck`、`pnpm build` 綠。
- **流程**：layer C 本機平行 fan out，本任務在獨立 worktree、分支 `layer-C/C6`，基底 eb3d315；草稿檔名依 taskboard 用 `GAME-14.md`（plan 寫 `drafts/C6.md`）。
- **踩坑**：worktree 隔離下 Bash 的 heredoc 多檔寫入會被拒，改用 Write 工具逐檔寫。
- **遺留**：見 `docs/backlog/drafts/GAME-14.md`。
