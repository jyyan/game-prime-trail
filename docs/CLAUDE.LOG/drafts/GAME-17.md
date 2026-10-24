### GAME-17（D2）HomeView 接線

- HomeView 掛載時呼叫 `useLevelStore().load()`，只在 `status==='ready'` 才渲染 LevelPicker；`missing` 顯示 `play.levelMissing`，`error` 顯示新增的 `home.loadError`，其餘狀態顯示 `play.loading`。題庫缺檔與壞檔是兩種不同情況（前者是尚未生成題庫，後者是檔案毀損），所以分開提示。
- `useRecords`／`useProgress` 依 `libraryVersion` 建立，因為 localStorage key 帶題庫版本前綴（spec §7.5）；版本只有 ready 後才知道，所以兩者都包在 computed 裡、ready 前為 null。
- 「繼續上次」的 `canResume` 以 `progress.has(lastPlayed.levelId, lastPlayed.difficulty)` 判斷（backlog R21）：`lastPlayed()` 回傳原始指標，對應存檔被刪或被 LRU 淘汰時仍可能存在，spec §7.5 要求這時隱藏按鈕。測試涵蓋了「指標還在、存檔不在」的情況。
- 「隨機」只在 ready 時呼叫 `store.randomId()`（backlog R22）；LevelPicker 本來就只在 ready 時渲染，這個檢查是防禦性的。上界跟著 `count`，不寫死 1000，題庫張數改變時不必改這裡。
- `start` 與 `resume` 都導向同一個 `play` 路由，是否恢復進度由 PlayView 決定（spec §6.6、§7.6）。
- 照現狀保留 LevelPicker 欄位空白時就顯示錯誤訊息的行為（R30），沒有改元件。
