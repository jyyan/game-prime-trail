## 新增

- 【UX・低】棋盤 aria-label 未帶衝突種類：BoardCell 介面只有 `conflict: boolean`，螢幕閱讀器聽不到「數字重複」等原因；若要補，需擴充 BoardCell props（例如 `conflictKinds`）並使用 `conflict.*` 字串。
- 【UX・低】spec §6.1「鍵盤 Enter 在格上 → press」未實作：格子不是 tab stop、焦點固定在棋盤，Enter 一律經 `key` 交給上層；D1 接線時確認 Enter 語意（指定模式＝確認），必要時改 spec 文字。
- 【測試・低】jsdom 無版面，拖曳只以 mock `elementFromPoint` 驗證；實際手機拖曳與 `scrollY` 不變留給 E1 Playwright 情境 3。
