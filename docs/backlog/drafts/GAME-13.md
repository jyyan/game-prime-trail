## 新增

- 【可重現性・低】PDF 字型來源未釘版本：`scripts/gen-pdf-font.ts` 從 google/fonts 的 `main` 分支下載 `NotoSansTC[wght].ttf`，上游換版後重跑 `pnpm gen:pdf-font` 會得到不同位元的子集（字形可能微調）。之後改成釘 commit 的 raw URL 並在腳本內比對 SHA-256（目前快取檔 SHA-256 `864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f`）。
- 【整潔・低】子集字型的 `name` 表仍寫 `Noto Sans TC Thin`／`NotoSansTC-Thin`：可變字型的預設 instance 是 wght=100，harfbuzz 釘 wght=400 時只改外框與 `OS/2.usWeightClass`，不改名稱。jsPDF 以自訂 family `PrimeTrailZh` 引用，不影響輸出；若要乾淨可在腳本內用 fontkit／自寫 name 表改寫，或改用靜態 Regular TTF 來源。
- 【文件・低】spec §6.9 寫「`renderPuzzlePdf({ level, difficulty, includeSolution })`」與「fallback 為 `en.ts` 的 `pdf.*`」，實作依 plan C5 介面為 `renderPuzzlePdf({ level, difficulty, includeSolution, labels, font })`、英文標籤在 `src/pdf/labels-en.ts`；另 i18n `pdf` 命名空間新增 `docTitle`、`exportFailed` 兩鍵。spec 該段可同步。

## 結案

無
