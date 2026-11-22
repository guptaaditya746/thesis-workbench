/**
 * Workbench pane: the questions (S2). Read-only. Questions on the left; for the chosen one: the question, the
 * intent card (what the user answers for each open point), the SPARQL query, the seed rows it finds, the answer.
 */
import { Fragment, type ReactNode, useState } from "react"

import type { SeedRow } from "@/api/evqa"
import { type BestGroup, type ConflictGroup, type GoldAnswer, type QuestionDetail, useQuestion, useQuestions }
  from "@/api/evqaQuestions"
import { CardsSkeleton, ErrorState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const TYPE: Record<string, string> = {
  lookup: "find the numbers", effect: "does A beat B, per study", best: "pick the best option",
  trend: "how it changes over time or dose", list: "which studies", conflict: "two papers disagree",
  absent: "not reported: a fact no paper gives", near_miss: "not reported: close, but wrong group or dose",
  out_of_scope: "not reported: drug or topic not in the corpus",
}
const TYPES = Object.keys(TYPE)

// A tiny SPARQL colouring: keywords, ?variables, prefixed names, strings, numbers and # comments.
const TOKEN = /(#[^\n]*)|("[^"]*")|(\?\w+)|\b(PREFIX|SELECT|WHERE|FILTER|NOT|EXISTS|VALUES|ORDER|BY|a)\b|([A-Za-z]+:[\w-]*)|(-?\d+(?:\.\d+)?)/g
const TOKEN_CLASS = ["text-muted-foreground italic", "text-emerald-700 dark:text-emerald-400",
  "text-sky-700 dark:text-sky-400", "font-semibold text-fuchsia-700 dark:text-fuchsia-400",
  "text-amber-700 dark:text-amber-400", "text-orange-700 dark:text-orange-400"]

function Sparql({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0
    if (i > last) parts.push(text.slice(last, i))
    const group = m.slice(1).findIndex((g) => g !== undefined)
    parts.push(<span key={i} className={TOKEN_CLASS[group]}>{m[0]}</span>)
    last = i + m[0].length
  }
  parts.push(text.slice(last))
  return (
    <pre aria-label="SPARQL query" className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
      {parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}
    </pre>
  )
}

function Rows({ rows, highlight }: { rows: SeedRow[]; highlight: Set<string> }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>{["row", "paper", "subject", "vs", "measure", "who", "dose", "time", "value", "where"].map((h) =>
            <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={cn("border-t", highlight.has(r.id) && "bg-primary/10 font-medium")}>
              <td className="px-2 py-1 font-mono text-xs">{r.id}</td>
              <td className="px-2 py-1 font-mono text-xs">{r.paper}</td>
              <td className="px-2 py-1">{r.subject}</td>
              <td className="px-2 py-1">{r.comparator ?? "—"}</td>
              <td className="px-2 py-1">{r.measure}</td>
              <td className="px-2 py-1 text-xs">{r.context}</td>
              <td className="px-2 py-1 whitespace-nowrap">{r.condition ?? "—"}</td>
              <td className="px-2 py-1 whitespace-nowrap">{r.time ?? "—"}</td>
              <td className="px-2 py-1 whitespace-nowrap font-mono">{r.value} {r.unit}</td>
              <td className="px-2 py-1">{r.placement}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GoldTable({ answer }: { answer: GoldAnswer }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table aria-label="True answer table" className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>{[...answer.columns.map((c) => c.label), "value", "row"].map((h) =>
            <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {answer.table.map((r, i) => (
            <tr key={`${r.row}-${i}`} className="border-t">
              {answer.columns.map((c) => <td key={c.key} className="px-2 py-1">{r.cells[c.key]}</td>)}
              <td className="px-2 py-1 whitespace-nowrap font-mono">{r.value} {r.unit}
                {r.verdict && <span className="ml-1 font-sans text-xs text-muted-foreground">({r.verdict})</span>}</td>
              <td className="px-2 py-1 font-mono text-xs">{r.row}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Groups({ answer }: { answer: GoldAnswer }) {
  const split = answer.split_by ?? []
  const own = answer.own ?? []
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">
        {split.length ? `One winner for each ${split.map((c) => c.label).join(" and ")}. ` : ""}
        {own.length ? `Each option counts with its best ${own.map((c) => c.label).join(" and ")}. ` : ""}
        Values are rounded to {answer.rounding_step}, so a win must be bigger than that
        ({answer.higher_is_better ? "higher" : "lower"} is better here).
      </p>
      <ul className="space-y-2">
        {((answer.groups ?? []) as BestGroup[]).map((g, i) => (
          <li key={i} className="rounded-md border p-2">
            <div className="font-medium">{Object.values(g.cells).join(", ") || "Everything asked"}</div>
            {g.status === "winner" && <p>Winner: <b>{g.winner}</b>, ahead by {g.margin}.</p>}
            {g.status === "tie" && <p>Tie: the gap ({g.margin}) is not bigger than the rounding.</p>}
            {g.status === "not reported" && <p>No winner: not reported for {g.missing.join(", ")}.</p>}
            <ol className="list-decimal pl-5 text-muted-foreground">
              {g.ranking.map((r) => (
                <li key={r.candidate}>{r.candidate}{Object.values(r.cells).length ? ` (${Object.values(r.cells).join(", ")})` : ""}:{" "}
                  <span className="font-mono">{r.value} {r.unit}</span></li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Trend({ answer }: { answer: GoldAnswer }) {
  return (
    <ul aria-label="Trend" className="space-y-1 text-sm">
      {(answer.series ?? []).map((s, i) => (
        <li key={i} className="rounded-md border p-2">
          <span className="font-medium">{Object.values(s.cells).join(", ") || "Everything asked"}</span>
          {" "}({answer.axis?.label}): {s.points.map((p) => `${p.at} ${p.value}`).join(" → ")}{" "}
          <Badge variant="secondary">{s.direction}</Badge>
        </li>
      ))}
    </ul>
  )
}

function Conflicts({ answer }: { answer: GoldAnswer }) {
  return (
    <ul aria-label="Conflicts" className="space-y-1 text-sm">
      {((answer.groups ?? []) as ConflictGroup[]).map((g, i) => (
        <li key={i} className={cn("rounded-md border p-2", g.status === "conflict" && "border-destructive")}>
          <span className="font-medium">{Object.values(g.cells).join(", ") || "Everything asked"}</span>:{" "}
          <b>{g.status}</b>{g.status !== "single" && ` (spread ${g.spread})`} —{" "}
          {g.rows.map((r) => `${r.paper} ${r.value} ${r.unit}`).join(" vs ")}
        </li>
      ))}
    </ul>
  )
}

function Papers({ answer }: { answer: GoldAnswer }) {
  return (
    <ul aria-label="Studies" className="list-disc space-y-1 pl-5 text-sm">
      {(answer.papers ?? []).map((p) => (
        <li key={p.paper}><span className="font-mono text-xs">{p.paper}</span> {p.title}
          <span className="text-muted-foreground"> ({p.rows.length} rows)</span></li>
      ))}
    </ul>
  )
}

function NotReported({ q }: { q: QuestionDetail }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">True answer: not reported</h3>
      <p className="rounded-md border border-amber-500/60 bg-amber-500/10 p-2 text-sm">{q.why ?? q.answer.why}</p>
      {q.absence_check && <p className="text-xs text-muted-foreground">
        Checked by code: {q.absence_check.terms.join(", ")} found in none of {q.absence_check.papers_checked} papers
        and not in the seed.</p>}
      {(q.near_rows ?? []).length > 0 && <>
        <h4 className="text-sm font-medium">Closest real rows (a system that answers with these is wrong)</h4>
        <Rows rows={q.near_rows ?? []} highlight={new Set()} />
      </>}
    </section>
  )
}

function Detail({ q }: { q: QuestionDetail }) {
  const answerable = q.answerable !== false
  const winners = new Set((q.type === "best" ? (q.answer.groups ?? []) as BestGroup[] : []).flatMap((g) =>
    g.status === "winner" ? g.ranking.filter((r) => r.candidate === g.winner).map((r) => r.row) : []))
  return (
    <div className="min-w-0 space-y-5">
      <section className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs">{q.qid}</span>
          <Badge variant="secondary">{q.type}</Badge>
          <Badge variant={q.split === "test" ? "outline" : "default"}>{q.split}</Badge>
          {!answerable && <Badge variant="destructive">not reported</Badge>}
        </div>
        <p className="text-lg font-medium">{q.question}</p>
        {q.wording && q.wording.text !== q.wording.template &&
          <p className="text-xs text-muted-foreground">Code's template: {q.wording.template}</p>}
        {q.wording?.source === "template" && q.wording.attempts.length > 0 &&
          <p className="text-xs text-muted-foreground">LLM rewording rejected ({q.wording.attempts.length} tries);
            the template is used.</p>}
        <p className="text-sm text-muted-foreground">{q.notes}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Intent card: what the user answers when asked</h3>
        <p className="text-xs text-muted-foreground">The question leaves these points open on purpose. The answers are
          fixed before any run, and the baselines get the same words.</p>
        <dl className="grid gap-2 sm:grid-cols-[minmax(0,200px)_1fr]">
          {q.intent_card.map((e) => (
            <Fragment key={e.point}>
              <dt className="text-sm font-medium">{e.label}<div className="text-xs font-normal text-muted-foreground">{e.ask}</div></dt>
              <dd className="text-sm">{e.answer}</dd>
            </Fragment>
          ))}
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">The query that finds the true answer in the seed</h3>
        <Sparql text={q.sparql} />
        <p className={cn("text-xs", q.rerun_matches ? "text-muted-foreground" : "text-destructive")}>
          {q.rerun_matches ? "Run again just now: it still finds the same rows." : "Run again just now: it finds different rows than the frozen answer!"}
          {" "}Without the intent card it would find {q.rows_without_card} rows.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Rows it finds ({q.rows.length})</h3>
        <Rows rows={q.rows} highlight={winners} />
        {winners.size > 0 && <p className="text-xs text-muted-foreground">Rows of the winners are marked.</p>}
      </section>

      {answerable ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">True answer: every value, one column per open point</h3>
          <p className="text-sm text-muted-foreground">{q.answer.text}</p>
          <GoldTable answer={q.answer} />
          {q.type === "best" && <Groups answer={q.answer} />}
          {q.type === "trend" && <Trend answer={q.answer} />}
          {q.type === "conflict" && <Conflicts answer={q.answer} />}
          {q.type === "list" && <Papers answer={q.answer} />}
        </section>
      ) : <NotReported q={q} />}
    </div>
  )
}

export function QuestionsPane({ domain }: { domain: string }) {
  const list = useQuestions(domain)
  const [qid, setQid] = useState("")
  const [type, setType] = useState("")
  const [split, setSplit] = useState("")
  const all = list.data?.questions ?? []
  const shown = all.filter((q) => (!type || q.type === type) && (!split || q.split === split))
  const current = qid && shown.some((q) => q.qid === qid) ? qid : shown[0]?.qid || ""
  const detail = useQuestion(domain, current)
  if (list.isPending) return <CardsSkeleton count={2} />
  if (list.isError) return <ErrorState error={list.error} />
  const { frozen } = list.data
  const questions = shown
  const typeCount = (t: string) => all.filter((q) => q.type === t && (!split || q.split === split)).length
  return (
    <div className="space-y-4">
      <p className={cn("text-sm", frozen.problems.length ? "text-destructive" : "text-muted-foreground")}>
        {frozen.problems.length
          ? `The frozen files changed: ${frozen.problems.join("; ")}`
          : <>Frozen: questions and answers match the manifest (sha256 <span className="font-mono">{frozen.set_sha256?.slice(0, 12)}</span>).</>}
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Questions ({questions.length} of {all.length})</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <label className="flex items-center gap-1">Type
              <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}
                className="min-h-9 rounded-md border bg-background px-2">
                <option value="">all ({all.filter((q) => !split || q.split === split).length})</option>
                {TYPES.filter((t) => typeCount(t) > 0).map((t) =>
                  <option key={t} value={t}>{t} ({typeCount(t)})</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">Split
              <select aria-label="Filter by split" value={split} onChange={(e) => setSplit(e.target.value)}
                className="min-h-9 rounded-md border bg-background px-2">
                <option value="">all</option>
                <option value="test">test</option>
                <option value="practice">practice</option>
              </select>
            </label>
          </div>
          {type && <p className="text-xs text-muted-foreground">{TYPE[type]}</p>}
          {questions.map((q) => (
            <button key={q.qid} type="button" onClick={() => setQid(q.qid)}
              className={cn("min-h-11 w-full space-y-1 rounded-md border p-2 text-left text-sm",
                q.qid === current ? "border-primary bg-primary/5" : "hover:bg-muted")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs">{q.qid}</span>
                <Badge variant="secondary" title={TYPE[q.type]}>{q.type}</Badge>
                <Badge variant={q.split === "test" ? "outline" : "default"}>{q.split}</Badge>
                {q.answerable === false && <Badge variant="destructive">not reported</Badge>}
              </div>
              <div>{q.question}</div>
              {q.open_points.length > 0 &&
                <div className="text-xs text-muted-foreground">Left open: {q.open_points.join(", ")}</div>}
            </button>
          ))}
        </div>
        {detail.isPending && current && <CardsSkeleton count={2} />}
        {detail.isError && <ErrorState error={detail.error} />}
        {detail.data && <Detail q={detail.data} />}
      </div>
    </div>
  )
}
