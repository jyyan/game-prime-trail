## 新增

- 【UI・低】模式切換按鈕組沒有撐滿寬度：`InputModeToggle` 用 `btn-group w-100`，但群組內按鈕不會 flex-grow，375／1280 px 都只佔左側一小段，和上下撐滿的資訊列、數字鍵盤、操作列對不齊。給按鈕加 `flex: 1` 即可；`InputModeToggle.vue` 不在 GAME-24 可動範圍。來源 GAME-24。
- 【a11y・低】棋盤的鍵盤焦點環靠 blur 再聚焦升級：棋盤以 `focusVisible: false` 聚焦後，Chrome 不會因按鍵把它改成 focus-visible，GameBoard 在第一個非修飾鍵時 blur 再以 `focusVisible: true` 重新聚焦。這會多送一組 blur／focus 事件；目前沒有元件聽這兩個事件，日後若有人在棋盤上掛 focus／blur 處理要留意。來源 GAME-24。

## 結案

- R33：操作列的「清除」已移除（UI refresh spec §4.2），接續模式用「復原」、指定模式用數字鍵盤的「清除」，不再有語意未定義的重複按鈕。GAME-24。
