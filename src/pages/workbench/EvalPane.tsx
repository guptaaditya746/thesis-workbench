/**
 * Workbench pane: the evaluation (S5). Read-only over a run's eval.json (evqa/eval/prism.py). Totals per run (one
 * column per run when two are compared), where facts were lost (blame per layer, as a bar chart), and per question
 * the true facts with a tick per layer. Clicking a fact opens that question in the Run pane. A table per question
 * type, and a block for the questions the papers cannot answer (should say "not reported"). The optional human
 * review (ReviewPane): coverage per task next to the scores, and a button that opens the one-item-at-a-time queue.
 * Baseline runs (PaperQA2, long context; evqa/baselines) have no structured L2/L3/advisor ("—", does not apply);
 * they are compared on L1 and "L3 text", the answer text scored the same way for every system (`evqa eval --text`).
 */
import { Check, X } from "lucide-react"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { type Blame, type FactScore, type QuestionScore, type RunEval, type RunItem, isBaseline, isBroken, useRun,
  useRuns }
  from "@/api/evqaRuns"
import { type ReviewTask, useReviewSummary, useReviewTasks } from "@/api/evqaReview"
import { CardsSkeleton, ErrorState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig }
  from "@/components/ui/chart"
import { cn } from "@/lib/utils"

import { ReviewPane } from "./ReviewPane"

const BLAME: { key: Blame; label: string }[] = [
  { key: "L0", label: "not in paper" }, { key: "find", label: "Find" }, { key: "extract", label: "Extract" },
  { key: "answer", label: "Answer" }, { key: "none", label: "in answer" },
  { key: "unscored", label: "not scored yet" },
]
const BLAME_LABEL = Object.fromEntries(BLAME.map((b) => [b.key, b.label])) as Record<Blame, string>
const METRICS: { key: string; label: string; help: string }[] = [
  { key: "l0", label: "L0 in paper", help: "share of true facts the paper really states" },
  { key: "l1_paper", label: "L1 right papers", help: "share of the papers holding the answer that Find passed on" },
  { key: "l1", label: "L1 found", help: "share of facts whose passage Find kept" },
  { key: "l2_recall", label: "L2 read (recall)", help: "share of facts Extract read with the right value" },
  { key: "l2_complete", label: "L2 whole fact",
    help: "share of facts read with the right value and every label (drug, measure, comparator, dose, time, patients); patient labels in other words count as misses until checked" },
  { key: "l2_precision", label: "L2 right (precision)", help: "share of read rows that are true facts" },
  { key: "l3", label: "L3 answer", help: "how well the final answer matches the true answer (answerable questions)" },
  { key: "l3_text", label: "L3 text",
    help: "the answer text, scored the same way for every system (evqa and baselines); needs evqa eval --text" },
  { key: "advisor", label: "Advisor", help: "share of spec checks the advisor got right" },
]

const share = (v: number | undefined | null) => (v === undefined || v === null ? "—" : v.toFixed(2))
const TYPE_LABEL: Record<string, string> = {
  lookup: "look up a value", effect: "A vs B", best: "which is best", trend: "change over time or dose",
  list: "which studies", conflict: "papers disagree", absent: "not in the papers", near_miss: "close, but not there",
  out_of_scope: "off topic",
}

/** null / undefined: the layer does not apply (a baseline run has no Extract step). */
export function Tick({ on, label }: { on: boolean | null | undefined; label: string }) {
  if (on === null || on === undefined) return <span aria-label={`${label}: does not apply`} className="text-muted-foreground">—</span>
  return on
    ? <Check aria-label={`${label}: yes`} className="size-4 text-emerald-600" />
    : <X aria-label={`${label}: no`} className="size-4 text-destructive" />
}

export function BlameBadge({ blame }: { blame: Blame }) {
  return <Badge variant={blame === "none" ? "secondary" : "outline"}
    className={cn(blame !== "none" && "border-amber-600/60 text-amber-800 dark:text-amber-300")}>
    {blame === "none" ? "in answer" : blame === "unscored" ? "not scored yet" : `lost at ${BLAME_LABEL[blame] ?? blame}`}
  </Badge>
}

/** The true facts of one question: a tick per layer and where the fact was lost. */
export function FactTable({ q, other, onPick }: { q: QuestionScore; other?: QuestionScore; onPick?: () => void }) {
  const otherBlame = new Map((other?.facts ?? []).map((f) => [f.id, f.blame]))
  const cols = ["fact", "paper", "L0", "L1", "L2", "in answer", "lost at", ...(other ? ["other run"] : [])]
  return (
    <div className="overflow-x-auto rounded-md border">
      <table aria-label={`True facts of ${q.qid}`} className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>{cols.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {q.facts.map((f: FactScore) => (
            <tr key={f.id} onClick={onPick} className={cn("border-t", onPick && "cursor-pointer hover:bg-muted")}>
              <td className="px-2 py-1 font-mono text-xs">
                {onPick ? <button type="button" className="underline">{f.id}</button> : f.id}
              </td>
              <td className="px-2 py-1 font-mono text-xs">{f.paper}</td>
              <td className="px-2 py-1"><Tick on={f.l0} label="L0" /></td>
              <td className="px-2 py-1"><Tick on={f.l1} label="L1" /></td>
              <td className="px-2 py-1"><Tick on={f.l2} label="L2" /></td>
              <td className="px-2 py-1"><Tick on={f.in_answer} label="in answer" /></td>
              <td className="px-2 py-1"><BlameBadge blame={f.blame} /></td>
              {other && <td className="px-2 py-1">{otherBlame.has(f.id) ? <BlameBadge blame={otherBlame.get(f.id)!} /> : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** One line of scores for a question, and the advisor's failed checks. */
export function QuestionScores({ q }: { q: QuestionScore }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap gap-2">
        {[["L0", q.l0], ["L1", q.l1], ["L2 recall", q.l2?.recall], ["L2 precision", q.l2?.precision],
          ["L3", q.l3?.score], ["advisor", q.advisor?.score],
          ...(q.l3_text ? [["L3 text", q.l3_text.score]] : [])].map(([k, v]) => (
          <span key={k as string} className="rounded-md border px-2 py-0.5"><b>{k}</b> {share(v as number)}</span>
        ))}
        {q.l3?.exact && <Badge>{q.answerable === false ? "said not reported" : "exact answer"}</Badge>}
        {q.l3?.hallucination && <Badge variant="destructive">made up a value</Badge>}
        {q.l3?.near_miss_trap && <Badge variant="destructive">used a close but wrong fact</Badge>}
      </div>
      {(q.missing_files?.length ?? 0) > 0 &&
        <p className="text-xs text-destructive">Files missing: {q.missing_files!.join(", ")}</p>}
      {(q.advisor?.mismatches?.length ?? 0) > 0 && (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {q.advisor.mismatches.map((m) => <li key={m}>Advisor: {m}</li>)}
        </ul>
      )}
    </div>
  )
}

function BlameChart({ evals }: { evals: RunEval[] }) {
  const keys = evals.map((_, i) => `run${i}`)
  const config = Object.fromEntries(evals.map((e, i) => [keys[i],
    { label: e.config_name ?? e.run_id, color: `var(--chart-${i + 1})` }])) satisfies ChartConfig
  const used = BLAME.filter((b) => b.key !== "unscored" || evals.some((e) => (e.totals?.blame?.unscored ?? 0) > 0))
  const data = used.map((b) => ({ layer: b.label,
    ...Object.fromEntries(evals.map((e, i) => [keys[i], e.totals?.blame?.[b.key] ?? 0])) }))
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full max-w-xl" role="figure"
      aria-label="Facts lost per step">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="layer" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} interval={0} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip cursor={{ fillOpacity: 0.3 }} content={<ChartTooltipContent />} />
        {evals.length > 1 && <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />}
        {keys.map((k) => <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={[4, 4, 0, 0]} maxBarSize={28}
          isAnimationActive={false} />)}
      </BarChart>
    </ChartContainer>
  )
}

function Totals({ evals }: { evals: RunEval[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table aria-label="Totals" className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr><th className="px-2 py-1.5 font-medium">score</th>
            {evals.map((e) => <th key={e.run_id} className="px-2 py-1.5 font-medium">
              {e.config_name ?? e.run_id}{e.closed_book ? " (closed book)" : ""}
              {isBaseline(e.system) && <Badge variant="outline" className="ml-1">{e.system}</Badge>}</th>)}</tr>
        </thead>
        <tbody>
          {METRICS.map((m) => (
            <tr key={m.key} className="border-t">
              <td className="px-2 py-1" title={m.help}>{m.label}<div className="text-xs text-muted-foreground">{m.help}</div></td>
              {evals.map((e) => {
                const v = (e.totals as unknown as Record<string, number | null>)?.[m.key]
                return (
                  <td key={e.run_id} className="px-2 py-1 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-10">{share(v)}</span>
                      <div className="h-2 w-24 rounded bg-muted"><div className="h-2 rounded bg-primary"
                        style={{ width: `${Math.max(0, Math.min(1, v ?? 0)) * 100}%` }} /></div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="border-t text-muted-foreground">
            <td className="px-2 py-1">questions · true facts · exact answers</td>
            {evals.map((e) => <td key={e.run_id} className="px-2 py-1 font-mono">
              {e.totals?.questions ?? 0} · {e.totals?.facts ?? 0} · {e.totals?.l3_exact ?? 0}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** One row per question type: how many, the L3 score, exact answers (for the "not in the papers" kinds, L3 is the
 * share that said "not reported"). */
function TypeTable({ ev }: { ev: RunEval }) {
  const rows = Object.entries(ev.totals?.per_type ?? {})
  if (rows.length === 0) return null
  const text = rows.some(([, r]) => r.l3_text !== undefined)
  return (
    <div className="overflow-x-auto rounded-md border">
      <table aria-label="Scores per question type" className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>{["type", "questions", "L3", ...(text ? ["L3 text"] : []), "exact", "made up a value"].map((h) =>
            <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(([t, r]) => (
            <tr key={t} className="border-t">
              <td className="px-2 py-1"><span className="font-mono text-xs">{t}</span>
                <div className="text-xs text-muted-foreground">{TYPE_LABEL[t] ?? ""}</div></td>
              <td className="px-2 py-1 font-mono">{r.questions}</td>
              <td className="px-2 py-1 font-mono">{share(r.l3)}</td>
              {text && <td className="px-2 py-1 font-mono">{share(r.l3_text)}</td>}
              <td className="px-2 py-1 font-mono">{r.exact}</td>
              <td className="px-2 py-1 font-mono">{r.hallucination === undefined ? "" : share(r.hallucination)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Questions the papers cannot answer: did the system say "not reported", or make up a value? */
function NotReportedBlock({ ev }: { ev: RunEval }) {
  const nr = ev.totals?.not_reported
  if (!nr || nr.questions === 0) return null
  const items: [string, number | null, string][] = [
    ["said “not reported”", nr.accuracy, "higher is better"],
    ["made up a value", nr.hallucination, "lower is better"],
    ["used a close but wrong fact", nr.near_miss_trap, "near-miss questions only; lower is better"],
  ]
  return (
    <section aria-label="Not in the papers" className="space-y-1 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Questions the papers cannot answer ({nr.questions})</h3>
      <div className="flex flex-wrap gap-2 text-sm">
        {items.map(([k, v, help]) => <span key={k} title={help} className="rounded-md border px-2 py-0.5">
          {k} <b className="font-mono">{share(v)}</b></span>)}
      </div>
      <p className="text-xs text-muted-foreground">These questions have no true facts, so the fact steps (L1, L2) do
        not apply and are left out of the scores above.</p>
    </section>
  )
}

/** The same check on the answer text (`evqa eval --text`): the only one a baseline run has. */
function TextNotReportedBlock({ ev }: { ev: RunEval }) {
  const nr = ev.totals?.text_not_reported
  if (!nr || nr.questions === 0) return null
  return (
    <section aria-label="Not in the papers, answer text" className="space-y-1 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Same questions, judged on the answer text ({nr.questions})</h3>
      <div className="flex flex-wrap gap-2 text-sm">
        <span title="higher is better" className="rounded-md border px-2 py-0.5">
          said “not reported” <b className="font-mono">{share(nr.accuracy)}</b></span>
        <span title="lower is better" className="rounded-md border px-2 py-0.5">
          made up a value <b className="font-mono">{share(nr.hallucination)}</b></span>
      </div>
    </section>
  )
}

/** One review task: how much a person has checked so far ("awaiting optional review" before any label). */
function ReviewRow({ task, scope, onOpen }: { task: ReviewTask; scope: string; onOpen: () => void }) {
  const s = useReviewSummary(task.task, scope)
  const closed = s.isError
  const empty = s.data && s.data.items === 0
  const counts = s.data && s.data.labels > 0 ? task.choices.map((c) => `${c.label} ${s.data!.counts[c.id] ?? 0}`)
    .join(" · ") : ""
  return (
    <li className="flex flex-wrap items-center gap-3 border-t py-2 first:border-t-0">
      <div className="min-w-56 flex-1">
        <p className="text-sm font-medium">{task.title} <span className="font-normal text-muted-foreground">
          ({task.scope === "run" ? "this run" : "papers"})</span></p>
        <p className="text-xs text-muted-foreground">{task.question}</p>
      </div>
      <div className="text-sm">
        {closed && <span className="text-muted-foreground">not open for this {task.scope}</span>}
        {empty && <span className="text-muted-foreground">nothing to review{task.task === "population"
          ? " (run evqa eval --judge-population first)" : ""}</span>}
        {s.data && !empty && <>
          <span className="font-medium">{s.data.status}</span>
          {counts && <span className="block text-xs text-muted-foreground">{counts}
            {s.data.reviewers.length > 1 ? ` · ${s.data.reviewers.length} reviewers, ${s.data.disagreements} disagree` : ""}</span>}
        </>}
      </div>
      <Button variant="outline" size="sm" disabled={!s.data || !!empty} onClick={onOpen}>
        {s.data && s.data.labels > 0 ? "Continue review" : "Start review"}</Button>
    </li>
  )
}

function ReviewBlock({ domain, runId, onOpen }: { domain: string; runId: string
  onOpen: (task: ReviewTask, scope: string) => void }) {
  const tasks = useReviewTasks()
  if (!tasks.data) return null
  return (
    <section aria-label="Human review" className="space-y-1 rounded-md border p-3">
      <h2 className="text-base font-semibold">Human review (optional)</h2>
      <p className="text-xs text-muted-foreground">A person checks a small sample, one item at a time, whenever they
        have time. The scores above never wait for it; labels show up here as they arrive.</p>
      <ul>{tasks.data.map((t) => {
        const scope = t.scope === "run" ? runId : domain
        return scope ? <ReviewRow key={t.task} task={t} scope={scope} onOpen={() => onOpen(t, scope)} /> : null
      })}</ul>
    </section>
  )
}

function useEval(runId: string) {
  const q = useRun(runId)
  const ev = q.data?.eval
  return { q, ev: ev && !isBroken(ev) ? ev : null, broken: ev && isBroken(ev) ? ev._error : null }
}

function RunSelect({ runs, value, onChange, label, empty }: { runs: RunItem[]; value: string
  onChange: (v: string) => void; label: string; empty?: string }) {
  return (
    <label className="text-sm">{label}{" "}
      <select aria-label={label} className="rounded border bg-background p-2" value={value}
        onChange={(e) => onChange(e.target.value)}>
        {empty !== undefined && <option value="">{empty}</option>}
        {runs.map((r) => <option key={r.run_id} value={r.run_id}>
          {isBaseline(r.system) ? `[${r.system}] ` : ""}{r.name ?? r.run_id}{r.closed_book ? " (closed book)" : ""}{r.has_eval ? "" : " (no eval yet)"} · {r.run_id}
        </option>)}
      </select>
    </label>
  )
}

export function EvalPane({ runId, onRun, onOpen, domain = "" }: { runId: string; onRun: (runId: string) => void
  onOpen: (runId: string, qid: string) => void; domain?: string }) {
  const runs = useRuns()
  const [other, setOther] = useState("")
  const [reviewing, setReviewing] = useState<{ task: ReviewTask; scope: string } | null>(null)
  const list = runs.data ?? []
  const current = runId && list.some((r) => r.run_id === runId) ? runId
    : list.find((r) => r.has_eval)?.run_id ?? list[0]?.run_id ?? ""
  const a = useEval(current)
  const b = useEval(other)
  if (runs.isPending) return <CardsSkeleton count={2} />
  if (runs.isError) return <ErrorState error={runs.error} />
  if (list.length === 0) return <p className="text-sm">No runs yet: start one with <code>evqa run</code>.</p>
  const evals = [a.ev, other ? b.ev : null].filter((e): e is RunEval => !!e)
  if (reviewing) return <ReviewPane task={reviewing.task} scope={reviewing.scope} onBack={() => setReviewing(null)} />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <RunSelect runs={list} value={current} onChange={onRun} label="Run" />
        <RunSelect runs={list.filter((r) => r.run_id !== current)} value={other} onChange={setOther}
          label="Compare with" empty="(none)" />
      </div>
      {a.q.isPending && <CardsSkeleton count={1} />}
      {a.q.isError && <ErrorState error={a.q.error} />}
      {a.broken && <p className="text-sm text-destructive">eval.json could not be read: {a.broken}</p>}
      {a.ev && isBaseline(a.ev.system) && a.ev.totals?.l3_text === undefined &&
        <p className="rounded-md border border-dashed p-3 text-sm">This baseline run has no answer-text score yet, so its
          facts show “not scored yet”. Make one with <code>evqa eval --text runs/evqa/{current}</code>.</p>}
      {a.q.data && !a.ev && !a.broken && <p className="rounded-md border border-dashed p-3 text-sm">
        This run has no score yet. Make one with <code>python -m evqa.eval.prism runs/evqa/{current}</code>.</p>}
      {other && b.q.data && !b.ev && <p className="text-sm text-muted-foreground">The run to compare has no score yet.</p>}
      {evals.length > 0 && a.ev && <>
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-base font-semibold">Scores (0 = none, 1 = all)</h2>
            <Totals evals={evals} />
            <NotReportedBlock ev={a.ev} />
            <TextNotReportedBlock ev={a.ev} />
            <TypeTable ev={a.ev} />
            <ReviewBlock domain={a.ev.domain ?? domain} runId={current}
              onOpen={(task, scope) => setReviewing({ task, scope })} />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold">Where the true facts got lost</h2>
            <BlameChart evals={evals} />
            <p className="text-xs text-muted-foreground">Each fact counts once, at the first step that lost it.
              “in answer” means nothing lost it.</p>
          </div>
        </section>
        {(a.ev.unknown_questions?.length ?? 0) > 0 && <p className="text-xs text-muted-foreground">
          Questions without a true answer (not scored): {a.ev.unknown_questions!.join(", ")}</p>}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Per question (click a fact to see the run)</h2>
          {Object.entries(a.ev.questions ?? {}).map(([qid, q]) => (
            <div key={qid} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="font-mono text-sm font-semibold underline"
                  onClick={() => onOpen(current, qid)}>{qid}</button>
                <Badge variant="secondary">{q.type}</Badge>
              </div>
              <QuestionScores q={q} />
              {q.facts.length > 0 &&
                <FactTable q={q} other={b.ev?.questions?.[qid]} onPick={() => onOpen(current, qid)} />}
            </div>
          ))}
        </section>
      </>}
    </div>
  )
}
