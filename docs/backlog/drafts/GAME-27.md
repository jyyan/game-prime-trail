## 新增

- 【UI・低】SolutionView 切換鈕沒有 button-group 樣式：`src/components/game/SolutionView.vue` 用 `btn-group btn-group-sm w-100`，但 `src/styles/main.scss` 沒有 import Bootstrap 的 `button-group`（也沒有 `helpers` 的 `.text-bg-*`），兩顆按鈕停在內容寬、互不相接。GAME-27 已在 InputModeToggle 以 scoped grid 修正，SolutionView 可比照；或統一決定是否把 `button-group` partial 加回全域。順帶建議加一條防漂移檢查：元件用到的 Bootstrap class 必須有對應 partial。來源 GAME-27。

## 結案

（無）
