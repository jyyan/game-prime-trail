export const meta = {
  name: 'implement-layer',
  description: 'Implement one dependency layer of a plan: implement in worktrees, verify, adversarial review, fix; never merges',
  whenToUse: 'After the plan for a layer is approved and args JSON is prepared from docs/superpowers/plan-template.md',
  phases: [
    { title: 'Implement', detail: 'one worktree per task' },
    { title: 'Verify', detail: 'rerun acceptance and DoD, trust nothing' },
    { title: 'Review', detail: 'three lenses try to reject' },
    { title: 'Fix', detail: 'at most two rounds' },
  ],
}

// ---- 參數檢查：第一個 agent() 之前就要擋下 ----
const a = args || {}
for (const k of ['spec', 'plan', 'layer', 'base', 'dod', 'tasks']) {
  if (a[k] === undefined || a[k] === null) throw new Error(`args.${k} is required`)
}
if (!Array.isArray(a.tasks) || a.tasks.length === 0) throw new Error('args.tasks must be a non-empty array')
for (const t of a.tasks) {
  for (const k of ['id', 'title', 'files', 'acceptance', 'planSection']) {
    if (t[k] === undefined) throw new Error(`task ${t.id || '?'} is missing ${k}`)
  }
  if (!Array.isArray(t.acceptance) || t.acceptance.length === 0) throw new Error(`task ${t.id} needs at least one acceptance command`)
}
const models = Object.assign({ implement: 'sonnet', verify: 'haiku', review: 'haiku', fix: 'sonnet' }, a.models || {})
const MAX_FIX = 2
const branchOf = (t) => `layer-${a.layer}/${t.id}`

// ---- schema ----
const RESULT = {
  type: 'object',
  properties: {
    branch: { type: 'string' }, commit: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    testsAdded: { type: 'integer' },
    outputs: { type: 'array', items: { type: 'string' } },
    notDone: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['done', 'blocked'] },
  },
  required: ['branch', 'commit', 'files', 'outputs', 'notDone', 'status'],
}
const VERIFY = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, outputs: { type: 'array', items: { type: 'string' } }, failures: { type: 'array', items: { type: 'string' } } },
  required: ['pass', 'outputs', 'failures'],
}
const REVIEW = {
  type: 'object',
  properties: {
    reject: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'integer' }, problem: { type: 'string' } }, required: ['file', 'problem'] } },
  },
  required: ['reject', 'issues'],
}

// ---- prompt 組裝：欄位順序與 docs/superpowers/dispatch-prompt.md 一致 ----
const list = (xs) => (xs && xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- （無）')
function dispatchPrompt(t) {
  return [
    '你在獨立的 git worktree 內實作一個任務，只做這個任務，做完回報。',
    `1. 任務：${t.id} ${t.title}`,
    `   - spec：${a.spec}`,
    `   - plan：${a.plan} 的 ${t.planSection}（先讀這段，再讀 spec 中它引用的章節）`,
    `2. 基底：先執行 git merge --ff-only ${a.base}，再執行 git rev-parse HEAD 並寫進回報；若 HEAD 不等於 ${a.base}，執行 git checkout --detach ${a.base} 後再建分支。在分支 ${branchOf(t)} 上工作（git checkout -B ${branchOf(t)}）。`,
    `3. 可動檔案：\n${list(t.files)}\n   禁區：\n${list(t.forbidden)}\n   碰到禁區就停下回報。`,
    '4. 本 repo 慣例：以 CLAUDE.md 為準，特別是「完成定義」與「開發流程規範」兩段。',
    `5. 驗收：逐條執行並貼輸出尾段：\n   任務驗收：\n${list(t.acceptance)}\n   DoD：\n${list(a.dod)}`,
    '6. 回報格式：分支與 commit hash（commit 後執行 git checkout --detach 釋放分支）、改動檔案清單、新增測試案例數與檔名、每條驗收與 DoD 指令的輸出尾段、沒做的事與原因。不得宣稱未執行的結果；跑不動就寫跑不動與錯誤訊息。status 只有在所有驗收與 DoD 都實際通過時才填 done。',
  ].join('\n')
}
function verifyPrompt(t, impl) {
  return [
    `你是獨立驗證者。不要相信前一個 agent 的回報，自己重跑。`,
    `執行 git checkout --detach ${impl.commit}（分支 ${impl.branch} 可能仍被實作 worktree 佔用，所以用 commit 切換），確認 git rev-parse HEAD 以 ${impl.commit.slice(0, 7)} 開頭。`,
    `逐條執行以下指令並貼輸出尾段：\n任務驗收：\n${list(t.acceptance)}\nDoD：\n${list(a.dod)}`,
    '任何一條非零結束或輸出顯示失敗，pass 為 false，failures 列出指令與關鍵錯誤行。不得修改任何檔案。',
  ].join('\n')
}
const LENSES = [
  { key: 'correctness', text: '正確性：邏輯是否有錯、邊界與錯誤路徑是否處理；找得到具體錯誤才反對。' },
  { key: 'scope', text: '範圍：是否偷工（plan 要求的沒做、用 stub 或 skip 混過）或超出範圍（動了可動檔案以外的檔、順手重構）。' },
  { key: 'tests', text: '測試真實性：新增的測試是否真的會因實作錯誤而失敗，是否只是斷言常數、mock 掉被測物、或根本沒被執行。' },
]
function reviewPrompt(t, impl, lens) {
  return [
    `你是審查者，視角只有一個：${lens.text}`,
    `任務 ${t.id} ${t.title}；plan 章節 ${t.planSection}（${a.plan}）；可動檔案：${(t.files || []).join(', ')}；禁區：${(t.forbidden || []).join(', ') || '無'}。`,
    `你在主 checkout 內工作：只審 git diff ${a.base}..${impl.branch} 的已提交範圍，忽略工作樹的未提交改動；不得執行 git checkout、git switch、git stash、不得執行測試或修改任何檔案。`,
    `執行 git diff ${a.base}..${impl.branch} 審查。預設立場是反對，只有在這個視角找不到任何具體問題時 reject 才為 false。`,
    '每個問題附檔案與行號與一句話。不得修改任何檔案。',
  ].join('\n')
}
function fixPrompt(t, impl, problems) {
  return [
    `你要修正任務 ${t.id} ${t.title} 的分支 ${impl.branch}。先 git checkout ${impl.branch}；若回報分支已被其他 worktree 佔用，改 git checkout --detach ${impl.commit}，修改並 commit 後 git branch -f ${impl.branch} HEAD。`,
    `必須處理的問題：\n${list(problems)}`,
    `只動可動檔案：\n${list(t.files)}\n禁區：\n${list(t.forbidden)}`,
    `修完逐條執行並貼輸出尾段：\n${list(t.acceptance)}\n${list(a.dod)}`,
    'commit 到同一分支後 git checkout --detach。回報格式同實作任務；不得宣稱未執行的結果。',
  ].join('\n')
}

// ---- 一個任務的完整生命週期 ----
function blockedEntry(t, reason) {
  return { id: t.id, branch: branchOf(t), commit: '', files: [], evidence: [], review: [], notDone: [reason], status: 'blocked' }
}
async function verifyAndReview(t, impl) {
  // verify 要 checkout 分支並執行測試，所以保留 worktree 隔離；review 只讀 git diff，不需要。
  const v = await agent(verifyPrompt(t, impl), { label: `verify:${t.id}`, phase: 'Verify', schema: VERIFY, model: models.verify, isolation: 'worktree' })
  const problems = []
  const verifyPassed = !!(v && v.pass)
  if (!verifyPassed) problems.push(...((v && v.failures.length ? v.failures : ['驗證 agent 未回報通過']).map((f) => `驗證失敗：${f}`)))
  const raw = await parallel(LENSES.map((lens) => () =>
    agent(reviewPrompt(t, impl, lens), { label: `review:${t.id}:${lens.key}`, phase: 'Review', schema: REVIEW, model: models.review })
  ))
  const votes = raw.map((v, i) => v && { lens: LENSES[i].key, ...v }).filter(Boolean)
  const rejects = votes.filter((r) => r.reject)
  const noReview = votes.length === 0
  const thinReview = votes.length < 2  // 有效票不足兩張，多數決沒有意義
  const rejected = thinReview || rejects.length >= 2
  if (noReview) problems.push('審查未執行（所有審查 agent 未回傳）')
  else if (thinReview) problems.push(`審查不足（有效票 ${votes.length} 張）`)
  else if (rejected) {
    const before = problems.length
    for (const r of rejects) for (const i of r.issues) problems.push(`審查：${i.file}${i.line ? ':' + i.line : ''} ${i.problem}`)
    if (problems.length === before) problems.push('審查多數反對但未列問題')
  }
  return { ok: verifyPassed && !rejected, problems, verify: v, votes }
}

async function runTask(t) {
  let impl = await agent(dispatchPrompt(t), { label: `implement:${t.id}`, phase: 'Implement', schema: RESULT, model: models.implement, isolation: 'worktree' })
  if (!impl) return blockedEntry(t, '實作 agent 未回傳結果')
  if (impl.status === 'blocked') {
    // 實作自己都說做不完，不浪費 verify／review／fix
    return {
      id: t.id, branch: impl.branch, commit: impl.commit, files: impl.files,
      evidence: [...impl.outputs], review: [], notDone: [...impl.notDone, '實作 agent 自報 blocked'], status: 'blocked',
    }
  }
  let check = await verifyAndReview(t, impl)
  let round = 0
  while (!check.ok && round < MAX_FIX) {
    round += 1
    log(`${t.id}: 修正第 ${round} 輪，${check.problems.length} 個問題`)
    const fixed = await agent(fixPrompt(t, impl, check.problems), { label: `fix:${t.id}:${round}`, phase: 'Fix', schema: RESULT, model: models.fix, isolation: 'worktree' })
    if (fixed) impl = fixed
    check = await verifyAndReview(t, impl)
  }
  const status = check.ok && impl.status === 'done' ? 'done' : 'blocked'
  return {
    id: t.id, branch: impl.branch, commit: impl.commit, files: impl.files,
    evidence: [...impl.outputs, ...((check.verify && check.verify.outputs) || [])],
    review: check.votes.map((v) => ({ lens: v.lens, reject: v.reject, issues: v.issues })),
    notDone: [...impl.notDone, ...check.problems],
    status,
  }
}

// ---- 主流程：每個任務獨立走完，無 barrier ----
log(`layer ${a.layer}: ${a.tasks.length} tasks, base ${a.base}, models ${JSON.stringify(models)}`)
const results = (await pipeline(a.tasks, (t) => runTask(t))).map((r, i) => r || blockedEntry(a.tasks[i], '任務執行中拋錯'))
const done = results.filter((r) => r.status === 'done')
const blocked = results.filter((r) => r.status !== 'done')
log(`layer ${a.layer}: ${done.length} done, ${blocked.length} blocked. 主 session 請逐一審 diff 後合併；本 workflow 未合併、未 push。`)
return { layer: a.layer, done, blocked }
