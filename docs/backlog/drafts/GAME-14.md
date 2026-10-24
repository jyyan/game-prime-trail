## 新增

- 【UI・低】BsConfirmHost 的按鈕預設英文：`BsConfirmHost` 在 `okLabel`／`cancelLabel` 未給時顯示 `OK`／`Cancel`；GAME-14 的 `PdfExportDialog` 已自帶 `common.confirm`／`common.cancel`，但 D1 其他 `confirm()` 呼叫端（重新開始、看解答）也要記得傳，或改由 BsConfirmHost 預設走 i18n（屬 `src/components/ui/Bs*.vue`，GAME-14 禁區）。
- 【UI・低】PDF 對話框對已 assisted 的局仍會確認：plan 介面 `PdfExportDialog` 只有 `{ modelValue, gameStatus }`，已看過解答（assisted）的局勾「附解答頁」仍跳確認並再 emit `markAssisted`（冪等、只是多問一次）；若要依 §7.4「已 assisted 不再問」，需先改 plan 介面加 `assisted` prop 再實作。
- 【UI・低】LevelPicker 空白欄位即顯示錯誤：依 plan 字面，首頁初次載入欄位空白就顯示 `picker.invalidId`；若希望空白時只停用不提示，需先改 plan／spec。

## 結案

無
