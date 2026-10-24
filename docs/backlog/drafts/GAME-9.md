## 新增

- 【設計・低】進階提示數可能全數卡在 ADV_FLOOR=6：C1 試跑 id 1–3 的 greedy 結果都是 6 個提示（floor 綁住），進階難度張與張之間沒有提示數差異。D4 跑完看 hintCount 分布；若幾乎全是 6，再決定是否接受或調 floor（調參要升 `generator` 版本字串並重跑）。
- 【文件・低】spec §4.4 的 easy 丟棄率估計偏低：試跑湊 3 個通過 easy 唯一的候選用了 9–22 次 attempt（丟棄率約 65–85%，spec 估 20–50%）。目前 `maxAttemptsPerLevel = 200` 仍有餘裕，但 spec §4.4／§4.7 的數字應以 D4 實測更新。
- 【流程・低】`src/data/levels.meta.jsonl` 是否 commit 未定：它是續跑與 `--recompute` 的依據，也記錄每張的候選與耗時；D4 決定 commit 進 repo 或加進 `.gitignore`（`.gitignore` 不在 C1 的 Files 清單內）。

## 結案

- 無
