## 新增

- 【UI・低】BsConfirmHost 的按鈕預設英文：`BsConfirmHost` 在 `okLabel`／`cancelLabel` 未給時顯示 `OK`／`Cancel`；GAME-14 的 `PdfExportDialog` 已自帶 `common.confirm`／`common.cancel`，但 D1 其他 `confirm()` 呼叫端（重新開始、看解答）也要記得傳，或改由 BsConfirmHost 預設走 i18n（屬 `src/components/ui/Bs*.vue`，GAME-14 禁區）。
- 【UI・低】PDF 對話框與 `assisted` 狀態：`PdfExportDialog` 新增選填 prop `assisted`，D1 接線時應傳 `game.state.assisted`，否則同一局重複勾選解答頁會重複確認（不影響正確性，只是多問一次）。

## 結案

無
