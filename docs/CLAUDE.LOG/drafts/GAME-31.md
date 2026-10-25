## 2026-10-25 A1 死路判定核心（spec：docs/superpowers/specs/2026-10-25-demo-playback.md §6.1）

- **起因**：plan Task A1（taskboard GAME-31）。示範 AI 的 `far`／`trap`／`twoEnds`／`split` 判定與正式遊戲簡單難度的死路標示要共用同一份判定，所以先抽成純 TS 的 `src/core/dead-end.ts`，不各寫一份。
- **裁定（使用者）**：無。
- **做法**：`trailOf` 取 `headOf` 的 h，只收 1..h 的格；重複數字、不相鄰、質數／黃格不符、given 對不上一律回 `null`（交給既有衝突標示），因此 h 之外的暫放數字與 given 都不影響判定。`findDeadEnd` 只認 trail 內的格為已走，依 far、trap、twoEnds、split、noMove 的順序回傳第一個成立者。可走鄰格 = 未走鄰格加上與龍頭相鄰（龍頭算一個）。`noMove` 的 `rejected` 含已走的鄰格，因為 spec 的條件把「都已走」也算進不能放。
- **守門**：新增 `dead-end.test.ts` 23 案：trailOf 9、各 kind 正反例、前 50 張題庫沿參考解 h=1…100 無誤報。手工的 trap／split 正例用無黃格的純幾何盤面，因為 fixture 參考解在簡單難度下偏離一步幾乎只會觸發 far。
- **遺留**：無。
