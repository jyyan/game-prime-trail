---
description: 開發規範 audit：先以 headless 方式取得內建 `/doctor prompt-audit` 的報告，再審核它不看的非 Claude 規範檔（Cursor、Copilot、openspec、constitution、settings 權限與 hooks）與優先權不明、不可驗證、範圍漏洞、和治理段落的衝突；合併成一份報告與待裁定清單；使用者指定編號前只讀不改。
---

# /rules-audit

**預設只讀。** 第 1 到 4 步不修改任何規範檔；第 5 步只在使用者明確列出要套用的編號後才動檔。

## 1. 機械盤點

- 若 `docs/audits/prompt-inventory.md` 存在且檔頭時間在一小時內，直接讀它；否則執行 `<studio-devops>/scripts/repo-governance-init.sh --audit .`（studio-devops 在本機是 `~/codejobs/studio-devops`；找不到就自行依下列清單 `find`）。
- 盤點對象：`CLAUDE.md`（含子目錄）、`AGENTS.md`、`GEMINI.md`、`.cursorrules`、`.cursor/rules/*`、`.windsurfrules`、`.github/copilot-instructions.md`、`.claude/commands/*.md`、`.claude/skills/*/SKILL.md`、`.claude/settings*.json`、`openspec/config.yaml`、`openspec/LANGUAGE.md`、`.specify/memory/constitution.md`、`docs/*constitution*.md`、`CONTRIBUTING.md`。
- 另外讀 `~/.claude/CLAUDE.md`（使用者全域規範，若存在），它對所有 repo 都生效，而且 headless 的內建審查讀不到它。

## 2. 內建審查，headless 取得

內建 `/doctor prompt-audit`（Claude Code 2.1.283 起）涵蓋 `CLAUDE.md`、`CLAUDE.local.md`、`AGENTS.md` 與 `.claude/` 下 rules／skills／commands／subagents／output styles 的舊模型寫法、失效引用、矛盾，並提案 diff、不改檔。用 Bash 在 repo 根目錄執行，把報告存檔：

```bash
claude --version   # 需 ≥ 2.1.283
claude -p '/doctor prompt-audit' --output-format text > "docs/audits/prompt-audit-$(date +%Y-%m-%d).md"
```

- 這一步會跑數分鐘並花一次完整審查的 token，只在使用者執行本指令時做，安裝腳本不做。
- 從 Claude Code session 內呼叫 `claude -p` 可行，用同一組登入與同一個模型；要省錢可加 `--model sonnet`，審查深度會降，預設不加。
- 版本不足、`claude` 不在 PATH、或 bundled skill 被 `disableBundledSkills` 關閉時：跳過，在報告註明「內建審查未執行」，第 3 步改為六類全部自行分析。
- 讀存下來的報告，記下它的發現編號與 hunk；**不要套用它的 diff**，套用在第 5 步。

## 3. 規範一致性審查（本指令的增量）

完整讀第 1 步列出的每個檔案，建立規則表，每條能約束 agent 行為的句子一列：

| # | 檔案:行號 | 規則原文（縮到一行） | 適用對象（全部／某角色／某目錄） | 種類（必須／禁止／偏好／流程） |

`.claude/settings*.json` 的 `permissions` 與 `hooks` 也算規則（deny 某指令就是「禁止」）。

逐對比對，找六類問題；與第 2 步重疊的部分引用其編號，不重新推導：

| 類型 | 判準 | 與內建審查的分工 |
|---|---|---|
| 舊模型寫法 | 壓力語言、思考腳本、重複加強、觸發案例列舉 | 完全引用第 2 步；本指令不自行判斷 |
| 直接矛盾 | 兩條規則對同一件事一個說必須、一個說禁止；或同一檔案前後不一致 | 第 2 步已報者引用；只補非 Claude 規範檔與全域 `~/.claude/CLAUDE.md` 之間的矛盾 |
| 失效引用 | 規則指到的檔案、腳本、npm script、指令、章節不存在（用 `ls`、`grep`、`package.json` 查證，不憑印象） | 第 2 步已報者引用；只補非 Claude 規範檔 |
| 優先權不明 | 兩份檔案對同一主題都有規則且不同，沒有任何一處說衝突時以誰為準 | 本指令負責 |
| 不可驗證 | 規則是形容詞（「注重品質」「保持一致」）而沒有對應的指令、測試或 lint 能證明有做到 | 本指令負責 |
| 範圍漏洞 | 規則只約束某角色或某流程，但其他路徑（workflow、subagent）沒有閘門確保 | 本指令負責 |
| 與治理段落衝突 | 專案舊規則與 CLAUDE.md 的七段治理文字（開發流程規範、完成定義等）牴觸，例如「不要 TDD」對「先寫失敗測試」 | 本指令負責 |

每個問題附：嚴重度（高：agent 無論怎麼做都違反一條；中：會導致不一致產出；低：措辭問題）、兩邊的 檔案:行號、一句話原因、建議解法（通常是「刪一條」「加一句優先權」「把形容詞換成指令」）。

## 4. 合併報告

寫 `docs/audits/rules-audit-YYYY-MM-DD.md`：

1. 盤點檔案清單與各自行數；內建審查是否執行、報告路徑。
2. 規則表。
3. 問題表，依嚴重度排序，**統一編號**：內建的發現保留其原編號並加前綴 `P`（例如 `P3`），本指令的發現用 `R` 編號；內建提案的 hunk 原文附在對應項目下。
4. **需要使用者裁定**：每個高與中的問題一個問句，給兩到三個選項（通常是「套用建議 diff」「改寫成 …」「保留並註明理由」）。
5. 本次未能查證的項目（例如需要跑指令但環境沒有、headless 讀不到的路徑）。

在對話裡只列第 4 節，等使用者裁定。

## 5. 套用（只在使用者指定編號後）

- 使用者回覆形如「套用 P1 P2 R3」才動檔；沒列到的一律不動。
- 內建的 hunk 照原文套用；本指令的建議依裁定內容改寫。
- 每個編號一個 commit，或依使用者指示合成一個；commit 訊息列出套用的編號。
- 套用後重跑第 1 步的機械盤點確認失效引用已清，並把結果寫回報告的「已套用」段。
