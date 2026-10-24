## 新增

- 【測試・低】e2e 12 的「找不到題庫」案例靠 dev server 動態 import 同一個 `useLevelStore` 單例並 `__setLoader(null)` 模擬缺檔：只在 Vite dev（`VITE_E2E=1 pnpm dev`）成立，wrangler／build 版跑不了。若要在正式 build 驗缺檔，需在 `src/e2e-hooks.ts` 提供正式的測試鉤子（該檔不在 GAME-25 可動範圍）。來源 GAME-25。

## 結案

- R30：GAME-25 結案。`LevelPicker` 空白欄位只停用「開始」、不顯示紅框與錯誤字；欄位有值且不在 1…count 時，blur 或按 Enter 之後才顯示錯誤，重新輸入時先收起（UI refresh spec §4.4）。單元測試與 `e2e/12-home-ui.spec.ts` 覆蓋（Review Focus 4）。
