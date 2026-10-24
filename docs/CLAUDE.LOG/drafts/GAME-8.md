## 2026-10-24 B6 BsModal／BsToast／useConfirm 與 App 掛載（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md）

- **起因**：plan `docs/superpowers/plans/2026-10-24-prime-trail.md` Task B6（taskboard GAME-8）。C、D 層的過關視窗、看解答／匯出 PDF 確認、「已恢復進度」Toast、「重新開始」確認都要用到 Modal／Toast／Confirm，但 Global Constraints 規定不 import Bootstrap JS，所以要自己寫，只借 Bootstrap 的 class。
- **裁定（使用者）**：無（照 plan 介面實作）。
- **做法**：
  - `BsModal` 用 `v-if` 加 `<Teleport to="body">`，不做淡入淡出動畫：沒有 Bootstrap JS 就沒有 transition 事件可等，`v-if` 讓「關閉 = DOM 消失」可以同步測，`closed` 在清理完（body class、keydown listener、焦點歸還）後立刻 emit。
  - 用模組層的開啟堆疊（`openStack`）而不是每個 instance 各自切 `modal-open`：疊兩層 Modal（例如過關視窗上再跳確認）時，關掉內層不會把 body 的捲動鎖拿掉，Esc 也只關最上層。堆疊同時決定視覺層級：每個 Modal 開啟時取「目前最上層 + 1」，依層數給 modal 與 backdrop 加 inline z-index（以 Bootstrap 的 1055／1050 為基準，每層 +10）。原因是 Teleport 在掛載時就在 body 放好錨點，DOM 順序跟著掛載順序走；App 層的確認 host 比頁面上的 Modal 早掛載，如果只靠 Bootstrap 固定的 z-index，晚開的確認框反而會被早開的頁面 Modal 蓋住、點不到（審查第 1 輪抓到的問題）。
  - 背景點擊用 `target === currentTarget` 判斷：真實瀏覽器的 `.modal` 疊在 `.modal-backdrop` 上方、會先吃到點擊，所以兩個元素都掛同一個 handler，從對話框內冒泡上來的點擊不算。
  - 初始焦點先找 `[autofocus]`，沒有才找第一個可聚焦元素：不然確認框的焦點會落在標頭的 × 鈕。`BsConfirmHost` 把 autofocus 放在取消鈕，誤按 Enter 不會執行「重新開始」這種破壞性動作。
  - `useToast`／`useConfirm` 是模組層單例，App 只掛一個 host；新的 confirm 進來時，還沒回答的舊請求以 `false` 結束，避免 promise 永遠懸著。`ConfirmRequest.settle()` 做成冪等，host 與呼叫端怎麼重複觸發都只 resolve 一次。
  - 這層不 import i18n（B5 同層、檔案不相交）：按鈕與關閉鈕的 `aria-label` 由呼叫端或 `closeLabel` prop 傳入，預設是英文 `OK`／`Cancel`／`Close`，避免元件內出現 CJK 字串被 B5 的守門測試擋下。D 層接線時再傳 `t('common.*')`。
  - 刻意不動：`main.scss`（modal、toast、close 早就匯入了）、router、views。
- **守門**：測試檔 5 → 7、案數 28 → 54（新增 `BsModal.test.ts` 16 案、`toast-confirm.test.ts` 9 案，涵蓋 plan 列的所有斷言，另外加測疊層 Esc、掛載順序與開啟順序相反時的層級、低層關閉後新開的 Modal 仍在最上層、卸載清理、footer slot、autofocus、新請求取代舊請求）。`pnpm typecheck`、`pnpm test`（7 files／54 tests passed）、`pnpm build` 全綠。
- **流程**：單 agent 在 worktree `task/GAME-8` 實作（範圍小，沒有 fan out），交由主 session 審 diff 合併。
- **踩坑**：一開始的開啟堆疊只用來判斷誰處理 Esc，沒有管視覺層級；審查第 1 輪抓到後改成同時決定 z-index。之後寫疊層 UI 時，要分開驗證「誰收鍵盤」和「誰在最上面」。
- **遺留**：見 `docs/backlog/drafts/GAME-8.md`（Modal 焦點圈限）。
