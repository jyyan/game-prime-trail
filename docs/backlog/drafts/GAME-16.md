## 新增

- 【規格・中】plan D1「填滿但一格錯」驗收案例與 spec §8 不一致，待主 session 裁定並改 plan：plan 寫「把最後兩格互換 → toast 含 `還有 2 格有錯`」，但互換 99／100 後 98→99 不相鄰，98 所在格也會標紅，紅格必為 3 格（`findConflicts` 對不相鄰的兩端都標，見 `src/core/validate.ts`）。spec §8 原文「還有 n 格有錯（紅格已標）」以紅格數為 n 最自然，實作照此、測試斷言 3 並逐格比對紅格集合；要得到 2 只能改用「與參考解不同的格數」或另發明歸因規則，前者在玩家走另解時會失準，都屬改規格，本任務不能動 `docs/superpowers/**`，故未做。建議把 plan 案例改為「還有 3 格有錯」。
- 【規格・低】已 assisted 的局「重新開始」後不再寫回空局（R21 修正），代價是重開後尚未落子就重新整理，輔助標記不保留（記憶體內的 `assisted` 仍在，存檔已依 §7.6 刪除）。若要跨「重新開始＋重新整理」保留，需在 spec §7.6 定義存檔與 `lastPlayed` 如何區分「空局但 assisted」。
- 【UI・低】操作列「清除」在接續模式等同撤回最後一格（undo），在指定模式等同 Backspace（先刪 pending、空了才清選取格）；spec §9 只列了按鈕名稱，未定義語意。

## 結案

- 無（R21：PlayView 端已保證自己不會讓 `lastPlayed` 指向不存在的存檔，並有測試；但 `lastPlayed()` 回傳原始值、HomeView 端的 `has()` 判斷屬 D2，故不結案；R28 本任務所有 `confirm()` 呼叫端已傳 `common.confirm`／`common.cancel`，但 BsConfirmHost 預設值仍是英文，R28 的「或改由 BsConfirmHost 預設走 i18n」選項未做，故不結案；R29 照現有介面未動）。
