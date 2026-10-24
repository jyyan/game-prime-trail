## 新增

- 【文件・低】spec §2.8「1–5 等價於 findConflicts 為空且盤面填滿」漏了前提：四種衝突都不涵蓋條件 2（`grid[start] = 1`）與條件 5（given 一致），兩者等價只在 UI 鎖住 given 格（含龍頭）時成立。`isSolved` 已經直接檢查五條；建議在 spec 補上前提，免得 C3 `useGame` 拿「無衝突 + 填滿」當過關判斷。

## 結案

- 無
