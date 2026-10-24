## 新增

- 【介面・低】`useProgress.lastPlayed()` 回傳原始 key 值：對應 progress 被刪（LRU 淘汰或 load 驗證失敗以外的情形）時仍可能指向不存在的存檔；spec §7.5 要求首頁以 `has()` 判斷是否顯示「繼續上次」，D 層 HomeView 實作時須照做，或改由 `lastPlayed()` 自行過濾。
- 【介面・低】`useLevelStore.randomId()` 在非 ready 時丟 `Error`；spec §6.6 說隨機在 1–1000 均勻抽，若 LevelPicker 要在題庫載入前就能抽號，需改為以固定 1000 為上界或先 `load()`。

## 結案

無
