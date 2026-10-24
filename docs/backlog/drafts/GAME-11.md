## 新增

- 【規格・低】過關後是否允許繼續改盤面：spec §7.3 未規定 `won` 之後的 `place`／`clear`／`undo`。C3 依 plan 只在 `place` 判勝（`place` 一律先設 `playing`、再判勝）；`won` 後 `clear`／`undo` 不改 `status`、不動計時器，盤面可能與 `won` 不一致；`undo` 回到完整解答也不會判勝。D1 接線時若 UI 過關後鎖盤則無影響，否則需 spec 補一句再改 `useGame`。
- 【規格・低】存檔已是完整解答時的恢復狀態：plan C3 只定義 `playing`／`idle`，C3 照此還原為 `playing` 且不啟錶；正常流程過關即刪存檔（§7.6）不會遇到，若要改為 `won` 需先改 spec／plan。
- 【規格・低】指定模式 `select()` 換格、`setInputMode()` 切模式是否清空 `pending`：spec §7.3 未明說，C3 目前都不清（`pending` 會帶到新格），待 spec 補述；D1 可在 PlayView 層處理。
