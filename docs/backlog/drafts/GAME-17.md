## 結案

- R21：HomeView 以 `progress.has(lastPlayed.levelId, lastPlayed.difficulty)` 判斷 `canResume`，並有「lastPlayed 指向已不存在的存檔時隱藏繼續上次」的測試（GAME-17）。
- R22：HomeView 只在 `status==='ready'` 時呼叫 `store.randomId()`，上界為題庫的 `count`；`randomId()` 本身不改（GAME-17）。

## 新增

- 【UI・低】首頁 records／lastPlayed 不會即時更新：HomeView 以 computed 讀取 localStorage，只在掛載後算一次；同一個分頁從 PlayView 回首頁時元件會重新掛載，所以沒有問題，但其他分頁寫入的變更要重新整理才會出現。要即時更新可以監聽 `storage` 事件。
