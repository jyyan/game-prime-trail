## 2026-10-25 GAME-27 棋盤下緣裁切、輔助徽章對比、模式切換寬度（spec：docs/superpowers/specs/2026-10-25-ui-refresh.md §3、§4、§5.1）

- **起因**：使用者在 1038×843 的 `/play/257/advanced` 截圖指出三件事：棋盤底部陰影被切平、「輔助中・不列入最佳紀錄」徽章幾乎看不見、模式切換按鈕沒有和上下兩列對齊。
- **共同根因：精簡版 Bootstrap 沒引入的元件 class 仍被元件使用。** `main.scss` 只 import 用得到的 Bootstrap 部分，沒有 `helpers`（`.text-bg-*`）也沒有 `button-group`。所以 `badge text-bg-warning` 實際只剩 `.badge` 的白字、沒有底色，落在白色資訊列上量得 `rgb(255,255,255)` 對 `rgb(255,255,255)`＝1.00:1；`btn-group w-100` 只是一般 block，按鈕停在內容寬（desktop 兩顆合計 180px，父層 558px）。修法放在元件的 scoped style、只引用 spec §3 token，比照 WinModal 新紀錄徽章與首頁卡片的既有做法；不為此把 Bootstrap partial 加回全域，因為那會帶回 Bootstrap 自己的黃色而不是 token，也和「元件只引用 token」相違。
- **棋盤裁切：選「移除 overflow」而非「保留 overflow 加內距」。** `.pt-play__board-wrap { overflow-x: auto }` 會讓 overflow-y 跟著變 auto，把 `--pt-shadow-clay`（0 6px 0、0 10px 24px）裁掉。GAME-22 後棋盤在約 302px 寬就放得下，捲動容器已無用途；保留它就得在四周加至少 24px、底部 34px 的內距，再用負 margin 抵銷版面位移，負 margin 在 320px 視窗反而可能撐出水平捲動。box-shadow 不計入 scrollWidth，移除後 e2e/10（320px 無水平捲動）仍綠。
- **輔助徽章配色：`--pt-text` 字配 `--pt-prime` 底（11.75:1）。** 深字淺黃保留「警示」語意又和質數格同色系；這一對已登記在 `scripts/check-contrast.ts`（given number on prime cell），不用改腳本。沒選白字配 `--pt-danger`：輔助不是錯誤，紅底太重。
- **模式切換：grid 兩等分、無間距、相鄰邊角歸零。** 驗收要求兩顆合計 ≥ 父層寬 − 2px，所以不能照操作列留 gap；改成接合的分段控制，視覺上仍是「二選一」，最小高度 44px 和操作列一致。保留 `btn-group` class，因為 PlayView 單元測試以它定位按鈕。
- **守門**：新增 `e2e/13-layout-polish.spec.ts` 3 案 × desktop／mobile，修正前 6 案全紅（棋盤底緣 +30px 超出 wrap 30px；徽章 1.00:1；按鈕合計 180 對 558／394），修正後全綠；StatusBar、InputModeToggle 單元測試各加 1 案。截圖（1038×843 與 375px，含徽章）存 scratchpad `uiux/game27-*.png`，未 commit。
- **遺留**：SolutionView 的「參考解／你的解」切換也用 `btn-group btn-group-sm w-100`，同樣沒有 button-group 樣式，不在本任務可動範圍，寫進 backlog 草稿。
