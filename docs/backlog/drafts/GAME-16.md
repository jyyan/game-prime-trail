## 新增

- 【規格・低】plan D1 「填滿但一格錯」案例的 n 與紅格數不符：plan 寫「把最後兩格互換 → toast 含 `還有 2 格有錯`」，但互換 99／100 後 98→99 不相鄰也會標紅，紅格共 3 格。實作取 n = 紅格數（`conflicts.size`，與畫面一致），測試斷言 3。若要改成「與參考解不同的格數」需先改 spec §8（挑戰難度另解時會失準），否則請把 plan 案例文字改為 3。
- 【UI・低】已 assisted 的局按「重新開始」後，因要保住輔助標記，會在 300 ms 後再存一份只有 given 的 idle 存檔、`lastPlayed` 也指回它；首頁「繼續上次」會出現一局空盤。若不希望如此，需在 spec §7.6 決定 assisted 是否跨「重新開始＋重新整理」保留。
- 【UI・低】`PlayActions` 依 plan 宣告了 `update:inputMode` emit，但操作列沒有自己的模式切換（模式切換由 `InputModeToggle` 負責），目前不會發出；`inputMode` prop 只以 `data-mode` 帶出。若 plan 原意是操作列也放切換鍵，需補述。
- 【UI・低】操作列「清除」在接續模式等同撤回最後一格（undo），在指定模式等同 Backspace（先刪 pending、空了才清選取格）；spec §9 只列了按鈕名稱，未定義語意。

## 結案

- 無（R21 屬 D2 HomeView；R28 本任務所有 `confirm()` 呼叫端已傳 `common.confirm`／`common.cancel`，但 BsConfirmHost 預設值仍是英文，R28 的「或改由 BsConfirmHost 預設走 i18n」選項未做，故不結案；R29 照現有介面未動）。
