## 新增

- 【規格・低】過關後是否允許繼續改盤面：spec §7.3 未規定 `won` 之後的 `place`／`clear`／`undo`；C3 目前允許並在盤面不再成立時回到 `playing`、續錶。D1 接線時若 UI 在過關後鎖盤，可改為 `useGame` 內直接拒絕，需要 spec 補一句。
- 【規格・低】指定模式 `select()` 換格是否清空 `pending`、`setInputMode()` 是否清空 `pending`：C3 兩者皆清空，spec §7.3 未明說，待 spec 補述。
