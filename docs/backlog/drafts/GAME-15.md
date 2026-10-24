## 新增

- 【技術債・低】題庫雜湊與檔案格式兩處定義：C7 的 `src/data/__tests__/helpers.ts`（純 TS `sha256Hex`、`parseHashFile`）和 C1 的 `scripts/lib/assemble.ts`（`sha256Hex`、`writeLevelFiles` 的兩行格式）各自實作。C1 合併後應補一個跨邊界測試，斷言兩邊對同一字串的雜湊相同，並確認 C1 寫出的 hash 檔能被 `parseHashFile` 解析；或讓兩邊共用同一實作（`src/` 下的純 TS 版本可讓 scripts import）。
- 【技術債・低】慢測的生成參數寫成字面值：`src/data/__slow__/*.test.ts` 的 backbite 步數、端點上限、easy／advanced 預算、`ADV_FLOOR`、挑戰預算抄自 `scripts/gen-config.ts`。C1 合併後改為 import `GEN_CONFIG`，避免調參換 `generator` 字串時慢測沒有跟著改。
