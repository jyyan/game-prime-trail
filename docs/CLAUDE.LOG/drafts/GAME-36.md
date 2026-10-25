## 2026-10-25 GAME-36 過關後拿掉龍頭框（backlog R54；spec：docs/superpowers/specs/2026-10-25-demo-playback.md §2 D12、§5.4）

- **起因**：GAME-34 的 375／1280 目視發現，過關後 100 的龍頭框仍留在連線終點上，與完成連線疊在一起，畫面雜亂。龍頭框的用途是「下一步從哪裡接」，過關後沒有下一步，框已無意義。
- **裁定（使用者）**：無（沿用 spec D12：畫線時不顯示龍頭框）。
- **做法**：只改 PlayView 傳給 GameBoard 的 `:head`，加 `&& !won`，過關時傳 null。不動 GameBoard 與 composable：框的顯示本來就由 `head` prop 決定，在呼叫端關掉最小，也不影響其他使用 GameBoard 的地方（首頁示範）。條件用既有的 `won`（status === 'won'），因此「恢復存檔時盤面已是完整解但 status 為 playing」的情況框仍在；這與 GAME-34 連線改看盤面不同，因為 R54 範圍是過關當下，不為此動禁區的 `useGame`。
- **守門**：`PlayView.test.ts` 56 → 57 案（+1）：接續模式下未過關 `head` prop 非 null 且有 `.is-head`，過關後 `head` 為 null 且 `.is-head` 不存在。先確認未改實作時該案失敗。
- **遺留**：375 寬角落數字約 8px 偏小，已記 backlog 草稿。
