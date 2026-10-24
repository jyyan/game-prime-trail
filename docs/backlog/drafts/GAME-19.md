## 新增

- 【測試・低】E2E 未涵蓋三條使用者裁定：spec §7.3「過關即鎖盤」「pending 不因換格或切模式清空」與 §8「填滿有錯時 toast『還有 n 格有錯』，n 為紅格數」目前只有 Vitest 單元／元件測試，§12.3 的情境清單沒有列；要在真瀏覽器守住，需先在 spec §12.3 增列情境再補 e2e。
- 【測試・低】`playwright.config.ts` 的兩個 webServer 每次 `pnpm test:e2e` 都會啟動，只跑 desktop project 也要先 `pnpm build` 並起 `wrangler dev`（本機約多 5–10 s）；若嫌慢，可改成以環境變數控制是否啟用 wrangler webServer／project。
