## 2026-10-24 GAME-11（C3）useGame 與 useTimer

- **盤面以「整片替換」驅動響應**：Vue 的 `reactive` 不代理 `Uint8Array`，就地寫入 `grid[cell]` 不會觸發 `head`／`conflicts`／`isFull` 重算；因此每次寫入都 `slice()` 一份新陣列再指派給 `state.grid`。100 bytes 的複製成本可忽略，換來 computed 永遠正確，不需要手動 trigger。
- **計時器以 `now()` 差值累加，interval 只負責刷新顯示**：`pause/stop/隱藏` 時立即結算，所以 interval 的 250 ms 粒度不影響最終成績。`running` 表示使用者意圖：分頁隱藏時內部停止累加但 `running` 仍為 true，回到可見即續跑；從未啟動或已暫停的計時器不會因 `visibilitychange` 自行開始。
- **`settle()` 統一處理勝負轉換**：任何盤面變動（place／clear／undo）後檢查「填滿且 isSolved」→ `won` 並停錶；若原本 `won` 而盤面被改壞（spec 未禁止過關後再動盤面）則回到 `playing` 並續錶，避免狀態與盤面不一致。
- **由存檔恢復時 given 一律以題面為準**：`useProgress` 已負責丟棄不相容存檔（§7.6），這裡再覆寫一次 given 只是防禦；恢復後計時器 `reset(saved.elapsedMs)` 不啟動，等下一次 `place` 才開始（Review Focus 6）。
- **指定模式 `select()` 換格時清空 `pending`**，`confirmPending()` 失敗（given 格）時保留 `pending`：spec 未明說，選擇理由是避免把上一格輸入一半的數字帶到新格。
- `hint()` 的 `divergedAt` 取「與參考路徑不一致的最小數字」，所在格以 `cellOfNumber`（重複時取最小格號）定位。
