## 2026-10-25 A1 死路判定核心（spec：docs/superpowers/specs/2026-10-25-demo-playback.md §6.1）

- **起因**：plan Task A1（taskboard GAME-31）。示範 AI 的 `far`／`trap`／`twoEnds`／`split` 判定與正式遊戲簡單難度的死路標示要共用同一份判定，所以先抽成純 TS 的 `src/core/dead-end.ts`，不各寫一份。
- **裁定（使用者）**：無。
- **做法**：`trailOf` 取 `headOf` 的 h，只收 1..h 的格；重複數字、不相鄰、質數／黃格不符、given 對不上一律回 `null`（交給既有衝突標示），因此 h 之外的暫放數字與 given 都不影響判定。`findDeadEnd` 只認 trail 內的格為已走，依 far、trap、twoEnds、split、noMove 的順序回傳第一個成立者。可走鄰格 = 未走鄰格加上與龍頭相鄰（龍頭算一個）。`noMove` 的 `rejected` 含已走的鄰格，因為 spec 的條件把「都已走」也算進不能放。
- **守門**：`dead-end.test.ts` 25 案：trailOf 10、各 kind 正反例、前 50 張題庫沿參考解 h=1…100 無誤報。trap／split 的正例依 plan 從 fixture 參考解前 k 步出發再偏離（trap：前 39 步＋61,60,50；split：前 45 步＋21,22,12,2,3；單步偏離在 fixture 上只會觸發 far，所以偏離走了數步），不再用手建盤面。審查補洞：noMove 的 given 子句、`target !== next` 子句、trailOf 第二個 givens 迴圈各補一案，並以暫時刪除該子句確認測試會失敗（突變檢查）。題庫無誤報測試維持既有慣例 `skipIf(skipWithoutLevels())`，levels.json 已 tracked 所以不會跳過。
- **遺留**：無。
