## 新增

- 【技術債・中】確認題庫為獨立 chunk：目前沒有 view 引用 `useLevelStore`，build 產物不含 levels chunk（題庫被 tree-shake 掉）。UI 接上載入後，需跑 `pnpm build` 檢查 `dist/assets` 出現含題庫的獨立 chunk（約 150 KB）且主 bundle（目前 index JS 97 kB）沒有膨脹。

## 結案

- R13：levels.meta.jsonl 依 plan D4 commit 進 repo（GAME-18）
