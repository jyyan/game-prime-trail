## 2026-10-24 GAME-11（C3）useGame 與 useTimer

- **盤面以「整片替換」驅動響應**：Vue 的 `reactive` 不代理 `Uint8Array`，就地寫入 `grid[cell]` 不會觸發 `head`／`conflicts`／`isFull` 重算；因此每次寫入都 `slice()` 一份新陣列再指派給 `state.grid`。100 bytes 的複製成本可忽略，換來 computed 永遠正確，不需要手動 trigger。
- **計時器以 `now()` 差值累加，interval 只負責刷新顯示**：`pause/stop/隱藏` 時立即結算，所以 interval 的 250 ms 粒度不影響最終成績。`running` 表示使用者意圖：分頁隱藏時內部停止累加但 `running` 仍為 true，回到可見即續跑；從未啟動或已暫停的計時器不會因 `visibilitychange` 自行開始。
- **勝負判定只在 `place` 內做**（§7.3：「填滿後若 isSolved → won、timer stop」）：審查指出初版的 `settle()` 在 `won` 後 clear／undo 會退回 `playing` 並重啟計時、以及由存檔恢復時可直接成為 `won`，兩者 plan 與 spec 都未定義，屬實作自創，已移除。恢復狀態照 plan 只有 `playing`／`idle`；過關局的存檔會被刪（§7.6），所以「存檔已是完整解」不是正常路徑，測試鎖定它還原為 `playing` 且不啟錶。過關後再動盤面的語意留待 spec 決定（backlog 草稿）。
- **由存檔恢復時 given 一律以題面為準**：`useProgress` 已負責丟棄不相容存檔（§7.6），這裡再覆寫一次 given 只是防禦；恢復後計時器 `reset(saved.elapsedMs)` 不啟動，等下一次 `place` 才開始（Review Focus 6）。
- **`select()`／`setInputMode()` 只設值、不清 `pending`、不驗格號**：初版自行加了換格／切模式清 `pending`，spec §7.3 未提，審查判為自創而移除；無效格號由 `place` 拒絕即可。`confirmPending()` 失敗（given 格）時保留 `pending`。是否清空待 spec 補述（backlog 草稿）。
- `hint()` 的 `divergedAt` 取「與參考路徑不一致的最小數字」，所在格以 `cellOfNumber`（重複時取最小格號）定位。
