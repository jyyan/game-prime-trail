## 2026-10-24 C5 PDF 產生、字型子集與 usePdfExport（spec：docs/superpowers/specs/2026-10-24-prime-trail-design.md）

- **起因**：taskboard GAME-13（plan Task C5）。D1 的 PDF 匯出需要一個不依賴 Vue 的 renderer、匯出時才載入的中文子集字型，以及包住「載字型→產生→下載→失敗退回」流程的 composable。
- **裁定（使用者）**：無（照 plan 與 spec §6.9 的規劃者決定）。
- **做法**：
  - **字型來源**：`https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf`（Google Fonts 版 Noto Sans TC，可變字型，下載時 SHA-256 `864727d2…46bd44f`），快取到 `.cache/fonts/NotoSansTC-wght.ttf`。不用 noto-cjk release 的 Regular：那是 CFF 外框的 OTF，harfbuzz 子集後仍是 CFF，jsPDF 只吃 `glyf` 外框的 TTF。可變字型以 `subset-font` 的 `variationAxes: { wght: 400 }` 釘成 Regular 靜態 TTF（比對過「一」字的 bbox 與 wght=400 instance 相同、`usWeightClass=400`）。
  - **字元集**：`zhTW.pdf` 與 `zhTW.difficulty` 所有葉節點字元 ∪ `0-9#:・.- Prime Trail`，共 95 字元，子集檔 37.1 KB（38 028 bytes）。字元集函式 `pdfFontCharset()` 放在 `src/pdf/labels.ts`，生成腳本與覆蓋率測試共用同一份，不會兩邊漂移；placeholder（`{id}` 等）的字母也一起收，成本可忽略、少一個要維護的規則。
  - **i18n**：`pdf.ts` 加兩鍵：`docTitle`（PDF 頁首「Prime Trail」；既有 `pdf.title`「匯出 PDF」留給 C6 對話框標題）與 `exportFailed`（匯出例外的 danger toast）。其他鍵未動。
  - **`PdfLabels` 保留 placeholder**：`level` 存 `地圖 #{id}`、`difficulty` 存 `難度：{difficulty}`，由 renderer 補零 id、填 `difficultyName`。labels 只依難度、不依關卡，`pdfLabelsFromI18n(difficulty)` 的介面因此不用帶 id。
  - **灰階解讀**：「龍頭 55% 灰、質數格 85% 灰」解讀為亮度 55%／85%（RGB 140／217），與畫面上龍頭較深（#9e9e9e）、質數格較淺（#e0e0e0）一致；若解讀為墨量，質數格會比龍頭深，與 §9 顏色相反。
  - **字型失敗的兩層退回**：`loadPdfFont` 非 2xx／例外回 null；拿到資料但 jsPDF 解析失敗也算失敗。jsPDF 是延遲解析 TTF，所以 `renderPuzzlePdfDoc` 在 `addFont` 後立刻 `setFont` + `getTextWidth` 試量一次，讓壞字型在繪製前就丟錯；`usePdfExport` 接到錯誤就清掉字型快取、改用 `PDF_LABELS_EN` + Helvetica 重畫並 toast `pdf.fontFallback`。
  - **jsPDF 動態 import**：`usePdfExport` 在 `exportPdf` 內 `await import('../pdf/renderPuzzlePdf')`，jsPDF（數百 KB）不進主 bundle，只在第一次匯出時載入。
  - 解答頁：路徑折線 0.6 mm 穿過格心，數字縮小放格子左上角，避免折線壓字。三角形在解答頁也畫（同 §6.3 規則）。
- **守門**：新增 3 個測試檔、22 案（renderPuzzlePdf 10、pdf-font-coverage 3、usePdfExport 9）；`pnpm test` 164 → 186 案、21 檔全綠。覆蓋率測試另含「真字型實際嵌入 jsPDF 產生 PDF」一案，防止日後換字型來源變成 CFF 而只在瀏覽器才壞。`pnpm typecheck`、`pnpm build` 綠；`public/fonts/` 由 Vite 複製到 `dist/fonts/`。人工以 sips 把含中文字型的 PDF 第一頁轉 PNG 目視，中文標籤、龍頭三角形、灰階、圖例正常。
- **流程**：implement-layer workflow 層 C 的 C5 任務，worktree 分支 `layer-C/C5`，基底 `eb3d315`。草稿檔名依 taskboard 治理用 `GAME-13.md`（plan 寫的是 `drafts/C5.md`）。
- **踩坑**：`tsconfig.app.json` 的 `types` 只有 `vite/client`，src 底下的測試要用 `node:fs` 得在檔頭加 `/// <reference types="node" />`。`subset-font` 沒有型別宣告，腳本以 `createRequire` 載入並在本地寫函式簽名，不新增 `.d.ts`（不在可動檔案內）。
- **遺留**：見 `docs/backlog/drafts/GAME-13.md`。
