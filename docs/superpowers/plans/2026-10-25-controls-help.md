# Prime Trail 操作提示實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依 `docs/superpowers/specs/2026-10-25-controls-help.md` 加入首次操作提示卡（依裝置與模式、玩家成功填格即消失）與頂列「？」完整操作說明。

**Architecture:** 一層一任務（H1）。功能雖小，但同時要改 `usePlaySession.ts`（新增玩家填入通知）、`PlayView.vue`（提示卡、頂列「？」、說明對話框）、`HomeView.vue`（改用共用 ui 偏好 helper）與 e2e 共用預設；這些共用檔拆成平行任務必衝突，所以不拆。

**Tech Stack:** Vue 3 + TypeScript、Bootstrap 5 SCSS（精簡版，無 alert／button-group／helpers partial）、Vitest + @vue/test-utils、Playwright。

**Spec:** `docs/superpowers/specs/2026-10-25-controls-help.md`（上位：主 spec §7.3、§9；UI spec §3、§4.1）

## Global Constraints

- CJK 字串只能放 `src/i18n/zh-TW/<ns>.ts`；新命名空間 `help.ts`，在 `src/i18n/zh-TW/index.ts` 登錄。
- 顏色只用 `--pt-*` token；新前景／背景對比 ≥ 4.5:1，登記 `scripts/check-contrast.ts`。
- 不用未匯入的 Bootstrap partial class（`src/styles/__tests__/bootstrap-partials.test.ts` 必須維持綠）；不改 `src/styles/main.scss`。
- 觸控目標 ≥ 44×44px；動畫 150–300ms ease-out，`prefers-reduced-motion: reduce` 停用。
- 不改 `src/core/**`、`src/data/**`、`src/pdf/**`、路由、操作語意、局存檔格式。
- 題庫凍結；遇 `levels.json not found` 先刪 `node_modules/.vitest-cache`。
- 草稿寫 `docs/CLAUDE.LOG/drafts/GAME-<n>.md`、`docs/backlog/drafts/GAME-<n>.md`。

## Review Focus

1. 提示按鈕代填、接續模式撤回／拖回／Backspace、重新開始、恢復存檔都**不得**讓提示消失或觸發「玩家填入」通知（PlayView 測試逐一驗）。
2. 拖曳連填一次會連續 place 多格：通知可重複觸發，提示只寫入一次 storage、不報錯（單元測試）。
3. `prime-trail:v1:ui` 共存：首頁收合規則卡後進遊戲頁看過提示，回首頁規則卡仍收合；storage 為非物件 JSON 時兩邊都不崩（helper 測試）。
4. 320px 寬顯示提示卡時：無水平捲動、棋盤底緣未裁切、頂列「？」與「首頁」仍 ≥ 44px、標題可截斷（e2e）。
5. 說明對話框開著時按方向鍵不會移動棋盤；關閉後焦點回「？」（e2e）。

---

## 工作流與相依

| 層 | 任務 | 相依 |
|---|---|---|
| H | H1 | 無 |

---

## 層 H

### Task H1: 首次操作提示與「？」操作說明

**Files:**
- Create: `src/composables/useUiPrefs.ts`、`src/composables/__tests__/useUiPrefs.test.ts`、`src/components/help/ControlsHint.vue`、`src/components/help/ControlsHelp.vue`、`src/components/help/__tests__/ControlsHint.test.ts`、`src/components/help/__tests__/ControlsHelp.test.ts`、`src/i18n/zh-TW/help.ts`、`e2e/14-controls-help.spec.ts`
- Modify: `src/composables/usePlaySession.ts`（新增通知，見 Interfaces）、`src/composables/__tests__/usePlaySession.test.ts`、`src/views/PlayView.vue`、`src/views/__tests__/PlayView.test.ts`、`src/views/HomeView.vue`（改用 `useUiPrefs`，行為不變）、`src/i18n/zh-TW/index.ts`、`scripts/check-contrast.ts`、`playwright.config.ts` 或 `e2e/helpers.ts`（全域預設「已看過」）、受版面影響的既有 e2e（只在必要時）
- 草稿：`docs/CLAUDE.LOG/drafts/GAME-<n>.md`、`docs/backlog/drafts/GAME-<n>.md`

**禁區：** `src/core/**`、`src/data/**`、`src/pdf/**`、`src/styles/**`、`src/router/**`、`scripts/gen-*`、`scripts/lib/**`、`docs/backlog.md`、`docs/CLAUDE.LOG/2026*.md`、`CLAUDE.md`

**Interfaces（Produces）：**
- `src/composables/useUiPrefs.ts`：
  - `export const UI_KEY = 'prime-trail:v1:ui'`
  - `export interface UiPrefs { rulesCollapsed?: boolean; controlsHintSeen?: boolean }`
  - `export function readUiPrefs(): UiPrefs`（讀不到或非物件回 `{}`）
  - `export function mergeUiPrefs(patch: UiPrefs): void`（先讀再合併寫回；寫入失敗吞掉）
- `usePlaySession` 的 `Session` 新增 `playerFills: Ref<number>`：玩家**自己**成功填入一格時 +1，觸發點只有 `trailPress`／`trailStep` 回傳 `'placed'`、`confirmPending()` 回傳 `true`；`hint()`、`undo`、`backspace`、`'retreated'`、reset、恢復存檔不變動。
- `ControlsHint.vue`：props `{ device: 'touch' | 'pointer'; mode: InputMode }`，emits `dismiss`；根元素 `data-controls-hint`、`role="note"`；關閉鈕 `data-action="dismissHint"`。
- `ControlsHelp.vue`：props `{ device: 'touch' | 'pointer' }`，以 `BsModal` 呈現（`v-model:show` 或與既有 modal 相同慣例），內容兩段 `data-help-section="touch"`／`"pointer"`，`device` 那段在前；鍵名用 `<kbd>` 並以 scoped token 樣式。
- PlayView：頂列最右 `data-action="help"`；裝置判斷 `matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer'`（ready 時判斷一次，`matchMedia` 不存在時視為 `'pointer'`）。

**Consumes：** `BsModal`、`usePlaySession` 既有 `state.steps`／`state.inputMode`／`status`、spec §4.1 的顯示條件。

- [ ] **Step 1：寫失敗測試**
  - `useUiPrefs.test.ts`：`mergeUiPrefs({ controlsHintSeen: true })` 後 `rulesCollapsed` 保留；storage 內容為 `"[1]"`、`"x"` 時 `readUiPrefs()` 為 `{}`；`setItem` 丟錯時 `mergeUiPrefs` 不丟。
  - `usePlaySession.test.ts`：trail press 填格 → `playerFills` 1；拖曳連填 3 格 → 3；`hint()` 後不變；trail Backspace、`undo()`、`'retreated'` 不變；direct 確認 → +1；被拒（shake）不變；恢復存檔後為 0。
  - `ControlsHint.test.ts`：四種 device×mode 組合各顯示對應 i18n 文字（觸控接續含「拖曳」、鍵盤接續含 `<kbd>` 方向鍵）；按 × emit `dismiss`。
  - `ControlsHelp.test.ts`：`device="touch"` 時第一段是 touch，`"pointer"` 時第一段是 pointer；兩段都存在。
  - `PlayView.test.ts`：無 storage → 顯示提示；玩家填一格 → 消失且 storage `controlsHintSeen === true`；按提示按鈕 → 仍顯示；按 × → 消失並寫入；點 `data-action="help"` → 提示消失並寫入、對話框開；`controlsHintSeen: true` → 不顯示；恢復存檔 `steps > 0` → 不顯示並寫入；已過關 → 不顯示；mock `matchMedia` coarse → 觸控文字；切到指定模式 → 文字切換。
- [ ] **Step 2：跑測試確認失敗**：`pnpm vitest run src/composables/__tests__/useUiPrefs.test.ts src/composables/__tests__/usePlaySession.test.ts src/components/help src/views/__tests__/PlayView.test.ts`，預期新增案例 FAIL。
- [ ] **Step 3：實作**：`useUiPrefs`（HomeView 改用、HomeView 既有測試不改也要綠）；`playerFills`；兩個元件與 `help.ts`；PlayView 接線（提示卡在 `<header class="pt-play-topbar">` 與 `.pt-play__board-wrap` 之間）；對比腳本登記新色對。
- [ ] **Step 4：e2e**
  - 全域預設：所有既有 spec 不逐檔修改即以「已看過」開始（建議 `playwright.config.ts` 的 `use.storageState` 或共用 fixture；兩個 baseURL origin 都要涵蓋）。
  - `e2e/14-controls-help.spec.ts` 清空預設後：desktop 看到鍵盤版、聚焦棋盤按方向鍵延伸一格後提示消失、reload 不再出現；mobile（`isMobileProject`）看到拖曳版、拖曳一格後消失；`data-action="help"` 以 Enter 開、Esc 關、焦點回按鈕、開著時方向鍵不改盤面；320px 寬提示顯示時 `scrollWidth === innerWidth` 且棋盤底緣在 wrap 內。
  - Playwright 埠與其他 worktree 衝突時，用暫時 config 換埠（不 commit）。
- [ ] **Step 5：驗收與 Commit**
  - `pnpm vitest run src/composables/__tests__/useUiPrefs.test.ts src/composables/__tests__/usePlaySession.test.ts src/components/help src/views/__tests__/PlayView.test.ts src/views/__tests__/HomeView.test.ts`
  - `pnpm test:e2e`（全綠，含 14）
  - `pnpm exec tsx scripts/check-contrast.ts`
  - `pnpm typecheck && pnpm test && pnpm build`
  - 375／1280 px 截圖（首次提示 desktop／mobile、說明對話框）存 scratchpad，不 commit。

**完成證據：** 上列指令輸出尾段、截圖路徑、草稿。
