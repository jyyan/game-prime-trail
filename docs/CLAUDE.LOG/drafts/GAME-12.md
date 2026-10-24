## 2026-10-24 C4 儲存層 composable（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md）

- **起因**：plan Task C4（taskboard GAME-12）；PlayView／LevelPicker 需要題庫載入、最佳紀錄、進度存檔與偏好設定的唯一出入口（spec §3.4、§7.1、§7.5、§7.6）。
- **裁定（使用者）**：無（照 plan 介面實作）。
- **做法**：`storage.ts` 收斂所有 localStorage 存取，讀取一律「缺值／壞 JSON／guard 不過／storage 無法存取」都回 null、寫入失敗（quota）回 false 不丟錯，讓上層不必處處 try。records 與 progress 以「整個物件 guard + 逐筆 guard」讀取，壞掉的單筆被丟掉而非整包作廢，避免一筆髒資料抹掉全部紀錄。`useRecords`／`useProgress` 每次呼叫都重讀 storage、不做記憶體快取，因為兩者以 `libraryVersion` 參數建立多個實例，快取會造成實例間不同步。`useLevelStore` 用 `import.meta.glob('../data/levels.json')` 而非直接 `import()`，題庫檔未產生前 build 與測試照樣能過、狀態為 `missing`；以 generation 計數讓 `__setLoader` 重設後舊的 in-flight 載入不會回寫狀態。進度 LRU 以 `savedAt` 排序淘汰，正在存的那筆永不被淘汰。`useSettings` 以 `flush: 'sync'` 的 watch 寫入，`__resetSettings()` 供測試重建單例。
- **審查修正**：同步丟錯的 loader 會讓 async IIFE 在賦值前就跑完 finally，`inflight` 被設成已 settle 的 promise 而永不清空、之後無法重試；改為賦值後以 `.finally` 在「仍是同一個 promise」時清空。測試補強：預設 loader 依題庫檔是否存在分成 `skipIf`/`runIf` 兩案各自釘死結果（glob 於轉譯期決定，無法在同一份 checkout 同時跑兩案；`missing` 分支另由 null loader 案覆蓋）；同值不算新紀錄、輔助通關不動最佳、`lastClearedAt` 以假時鐘比對；LRU 後 `lastPlayed` 必指向存在的存檔；多個 given 只錯最後一格也要作廢；locale 變更寫入並以 `nextTick` 讀取以免綁死 sync flush。
- **守門**：新增 5 檔 45 案（1 案依題庫檔存在與否 skip）；typecheck、全套 test、build 綠。
- **流程**：layer C 本機平行 fan-out，worktree 分支 `layer-C/C4`。
- **踩坑**：`tsconfig.app.json` 只含 `vite/client` 型別，src 內測試不能用 `node:fs`；改用測試內同一個 `import.meta.glob` 判斷題庫檔是否存在。
- **遺留**：見 `docs/backlog/drafts/GAME-12.md`。
