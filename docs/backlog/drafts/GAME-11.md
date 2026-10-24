## 新增

- 【規格・低】過關後是否允許繼續改盤面：spec §7.3 未規定 `won` 之後的 `place`／`clear`／`undo`。C3 依審查改為鎖盤：`won` 期間三者皆回 false、狀態與計時器不變，`reset()` 才解鎖；`undo` 回到完整解答也不會判勝（正常流程不可達，因勝局即鎖）。請 spec §7.3 補一句確認「過關即鎖盤」，若要允許過關後繼續玩需另訂狀態轉移再改 `useGame`。
- 【規格・低】存檔已是完整解答時的恢復狀態：plan C3 只定義 `playing`／`idle`，C3 照此還原為 `playing` 且不啟錶；正常流程過關即刪存檔（§7.6）不會遇到，若要改為 `won` 需先改 spec／plan。
- 【規格・低】指定模式 `select()` 換格、`setInputMode()` 切模式是否清空 `pending`：spec §7.3 未明說，C3 目前都不清（`pending` 會帶到新格），待 spec 補述；D1 可在 PlayView 層處理。
