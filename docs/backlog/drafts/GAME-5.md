## 新增

- 【文件・低】generator 版本字串應涵蓋 solver 剪枝行為：節點數取決於剪枝強度（B3 已把 §5.4.2 換成較強的排序匹配形式），而 `EASY_BUDGET`／`ADV_BUDGET`／`CHAL_BUDGET` 與挑戰 `c` 值都以節點計，所以題庫凍結後改 solver 剪枝或候選排序，同一 seed 生成的題面與 `c` 可能改變。spec §4 目前只寫「改 gen-config 任一參數即改 generator 版本」，應補上「改 `src/core/solver.ts` 的搜尋行為也要升版」，C1 實作 generator 字串時一併處理。

## 結案

無
