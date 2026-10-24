Status: inventory and reference checks are finished, and I'm writing the report now. The files are only being read; I haven't changed anything.

# Prompt audit: game-prime-trail Claude Code configuration

## Assumptions

- **Scope:** the Claude Code configuration that loads into sessions in this project. Two in-project files are in that scope:
  - `CLAUDE.md` (90 lines). It imports nothing.
  - `.claude/commands/rules-audit.md` (69 lines).

  The project has no `CLAUDE.local.md`, `AGENTS.md`, nested `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, `.claude/agents/` or `.claude/output-styles/`.
- **Couldn't read (session permissions only cover the project directory), so these are not audited:**
  - `~/.claude/CLAUDE.md`. It is not in this session's loaded context, so it probably doesn't exist.
  - `~/.claude/{rules,skills,commands,agents,output-styles}/`. The session lists the user-level or plugin skills `repo-governance` and `taskboard-project-add`, but I couldn't open them.
  - Instruction files in ancestor directories (none are loaded in this session).
  - A managed-policy `CLAUDE.md`.
  - Plugin-provided skills, commands and subagents.

  Settings files, `.mcp.json` and `~/.claude.json` were deliberately not read.
- **Outside the requested file types:** `.claude/workflows/implement-layer.js`. I only confirmed that it exists, because `CLAUDE.md:87` names it.
- **Target model:** Claude Opus 5.5 (`claude-opus-5-5`), the model running this session. Neither audited file pins its own model.
- **Non-Anthropic provider markers:** none.

## Summary

The surface is mostly sound. The emphasis in `CLAUDE.md`, such as "不可跳過確認直接寫碼", "禁止兩個 agent 共用同一個 checkout" and the three 鐵則, guards process and safety rules. Almost every one gives its reason next to it (merge conflicts, overwritten uncommitted work, taskboard re-verification). Those are fragile operations, so they stay.

The two real findings are stale facts that the repository contradicts. Both come from commit `ef03f33`:

- `CLAUDE.md:7` says the gameplay is still waiting for the first spec.
- `CLAUDE.md:26` says the overall spec doesn't exist yet and tells the reader to add a row once it does.

But `docs/superpowers/specs/2026-10-24-prime-trail-design.md` was committed in `9159ae7`, which is *before* `ef03f33`. An agent reading `CLAUDE.md` would treat the game as undefined and never be pointed at the spec. The authority table it's told to read before planning also leaves the spec out.

| Group | Findings |
|---|---|
| 1 Dated prompt text | 0 |
| 2 Config files | 2 high, 1 low (flag only) |
| 3 Tool descriptions | not applicable (no tool definitions) |
| 4 Request config / architecture | not applicable: there is no request-building code and no subagent roster |

## Findings

### P1: stale project description (high)

- **Location:** `CLAUDE.md:7`
- **Evidence:** "game-prime-trail：網頁遊戲，玩法與目標玩家待第一份 spec 定義。"
- **Pattern:** Group 2, volatile specifics (a claim the repository contradicts)
- **Why obsolete:** `docs/superpowers/specs/2026-10-24-prime-trail-design.md` exists. It defines the game: a single-player puzzle on a 10×10 board, filling 1…100, with primes as the clues. The spec's own status is "草稿，待使用者確認".
- **Action:** `rewrite` to point at the spec, rather than copying its content into `CLAUDE.md`. This is proposed only: per the Group 2 rule, confirm it before applying.

### P2: authority table doesn't list the existing spec (high)

- **Location:** `CLAUDE.md:17-26`
- **Evidence:** "總規格與架構決策文件尚未建立；第一份 spec 產出後在上表加列。"
- **Pattern:** Group 2, volatile specifics (the pending condition has already happened)
- **Why obsolete:** the first spec has been produced, but the table wasn't updated. The "權威文件（規劃與實作前必讀）" table therefore leaves out the one spec that exists.
- **Action:** `rewrite`: add the row and keep only the part that is still true (no architecture-decision document yet).
- **Assumption:** this spec is the "總規格" the line means. If you'd rather keep it as an ordinary feature spec, take only the row.
- Proposed only.

### P3: hardcoded version gate (low, flag)

- **Location:** `.claude/commands/rules-audit.md:17,20`
- **Evidence:** "（Claude Code 2.1.283 起）" and "`claude --version   # 需 ≥ 2.1.283`"
- **Pattern:** Group 2, volatile specifics (a version pin)
- **Why:** the version belongs to an installed tool, so the repository can't contradict it. It is a working gate today. If the minimum version or the subcommand name changes, nothing will catch it.
- **Action:** `flag` only, no edit.

### Checked and clean

Every path these files name exists:

- `docs/backlog.md`, which includes R1.
- `docs/CLAUDE.LOG/README.md` and its `drafts/` folder.
- `docs/backlog/drafts/`.
- `docs/audits/routine-checklist.md` and `docs/audits/prompt-inventory.md`.
- `docs/superpowers/{repo-governance.md (§7 present), plan-template.md (args section at the end present), dispatch-prompt.md, specs/, plans/}`.
- `.claude/workflows/implement-layer.js`.
- `/rules-audit`.

`wrangler.jsonc` and the npm scripts don't exist yet, but the file itself explains that (R1 isn't done), so that isn't a contradiction. The `studio-devops` script path points outside the project, so I didn't check it.

The duplicated rules are repeats that agree with each other, so I left them:

- "不經確認不寫碼" (lines 43 and 55).
- "不碰主分支、不 push" (lines 57 and 88).

## Proposed diff

These hunks are not applied. They are proposed only, for you to confirm.

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -7 +7 @@  (P1)
-game-prime-trail：網頁遊戲，玩法與目標玩家待第一份 spec 定義。技術棧為 Vue 3 + TypeScript + Vite + Bootstrap 5，…
+game-prime-trail：網頁遊戲，玩法與範疇見 `docs/superpowers/specs/2026-10-24-prime-trail-design.md`（草稿，待使用者確認）。技術棧為 Vue 3 + TypeScript + Vite + Bootstrap 5，…
```

(The rest of line 7 is unchanged.)

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -24,3 +24,4 @@  (P2)
 | `docs/superpowers/repo-governance.md` | 本 repo 的 agent 治理操作指南（角色、補段落方法、日常節奏、`implement-layer`、`/rules-audit`、踩坑） |
+| `docs/superpowers/specs/2026-10-24-prime-trail-design.md` | Prime Trail 總體設計 spec（草稿，§15 開放問題待裁定） |
 
-總規格與架構決策文件尚未建立；第一份 spec 產出後在上表加列。
+架構決策文件尚未建立。
```
