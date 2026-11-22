/**
 * Workbench pane: one run (S4). Read-only over runs/evqa/<run_id>/ (evqa/contracts.py). Left: the runs (newest
 * first) and the run's questions. Right: the seven steps for the chosen question, top to bottom: question and
 * intent card, Spec, Find, Extract, Answer, events, the score if eval.json exists, and (8, closed until opened) the
 * rows drawn inside the question's piece of the seed graph (QuestionGraph). A missing file shows as
 * "not written yet", so a half-written run still opens. Clicking a quote or a passage opens the paper with it marked.
 * Each question has a "why" link: per true fact, right or wrong, the step that lost it, the passage, the row and its
 * quote, in plain words (GET .../explain/{qid}, backend/evqa/explain.py; practice runs only).
 * A baseline run (PaperQA2, long context; evqa/baselines) has no Spec, Extract or structured Answer: its steps are the
 * question, what it read (find.jsonl), its answer text with citations, and the claims read from that text.
 */
import { type ReactNode, useState } from "react"

import { useQuestion } from "@/api/evqaQuestions"
import { type Answer, type ExplainFact, type FindHit, type Passage, type Row, type RunDetail, type RunEvent, type Spec,
  type TextAnswer, type TextClaims, isBaseline, isBroken, ok, useExplain, useRun, useRuns } from "@/api/evqaRuns"
import { CardsSkeleton, ErrorState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { FactTable, QuestionScores } from "./EvalPane"
import { PaperDrawer, type PaperSpan } from "./PaperDrawer"
import { QuestionGraph } from "./QuestionGraph"

type Open = (s: PaperSpan) => void
const unitName = (u: string | undefined) => (u ? (u.split(/[#/]/).pop() ?? u) : "")
const SCREEN: Record<string, string> = {
  yes: "border-emerald-600/50 text-emerald-800 dark:text-emerald-300",
  no: "border-red-600/50 text-red-800 dark:text-red-300",
  unsure: "border-amber-600/50 text-amber-800 dark:text-amber-300",
}

function Step({ n, title, status, children }: { n: number; title: string; status?: ReactNode; children: ReactNode }) {
  return (
    <details open className="group rounded-md border" aria-label={`Step ${n}: ${title}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{status}</span>
      </summary>
      <div className="space-y-3 border-t p-3">{children}</div>
    </details>
  )
}

const Missing = ({ file, broken }: { file: string; broken?: string | null }) => (
  <p className={cn("text-sm", broken ? "text-destructive" : "text-muted-foreground")}>
    {broken ? `${file} could not be read: ${broken}` : `${file} is not written yet.`}
  </p>
)

function Table({ head, label, children }: { head: string[]; label: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table aria-label={label} className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- 1 question
function QuestionStep({ domain, qid, spec }: { domain: string; qid: string; spec: Spec | null }) {
  const q = useQuestion(domain, qid)
  return (
    <Step n={1} title="Question and intent card">
      <p className="text-lg font-medium">{q.data?.question ?? spec?.question ?? qid}</p>
      {q.isPending && <CardsSkeleton count={1} />}
      {q.isError && <p className="text-sm text-muted-foreground">No intent card found for {qid}.</p>}
      {q.data && (
        <dl className="grid gap-2 sm:grid-cols-[minmax(0,200px)_1fr]">
          {q.data.intent_card.map((e) => (
            <div key={e.point} className="contents">
              <dt className="text-sm font-medium">{e.label}<div className="text-xs font-normal text-muted-foreground">{e.ask}</div></dt>
              <dd className="text-sm">{e.answer}</dd>
            </div>
          ))}
        </dl>
      )}
    </Step>
  )
}

// ---------------------------------------------------------------- 2 spec
function NameLine({ role, n }: { role: string; n: { label: string; synonyms?: string[]; definition?: string; known?: boolean } }) {
  return (
    <li>
      <span className="text-muted-foreground">{role}:</span> <b>{n.label}</b>{" "}
      {n.known === false && <Badge variant="outline" className="border-amber-600/60">not known</Badge>}
      {(n.synonyms?.length ?? 0) > 0 && <span className="text-muted-foreground"> · also: {n.synonyms!.join(", ")}</span>}
      {n.definition && <div className="text-xs text-muted-foreground">{n.definition}</div>}
    </li>
  )
}

function SpecStep({ spec, broken }: { spec: Spec | null; broken: string | null }) {
  return (
    <Step n={2} title="Spec: what exactly is asked" status={spec ? `${spec.type}${spec.locked ? ", locked" : ""}` : "missing"}>
      {!spec ? <Missing file="spec.json" broken={broken} /> : <>
        <ul className="space-y-1 text-sm">
          {spec.subjects.map((s) => <NameLine key={s.label} role={spec.type === "best" ? "option" : "subject"} n={s} />)}
          {spec.comparator && <NameLine role="compared with" n={spec.comparator} />}
          <NameLine role="measure" n={spec.measure} />
        </ul>
        {Object.keys(spec.fixed ?? {}).length > 0 && (
          <p className="text-sm"><span className="text-muted-foreground">Fixed by the question:</span>{" "}
            {Object.entries(spec.fixed!).map(([k, v]) => <Badge key={k} variant="secondary" className="mr-1">{k}: {v}</Badge>)}</p>
        )}
        {(spec.open_points?.length ?? 0) > 0 && (
          <Table label="Open points" head={["point", "asked", "choice", "from"]}>
            {spec.open_points!.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td className="px-2 py-1 font-mono text-xs">{p.id}</td>
                <td className="px-2 py-1">{p.question}</td>
                <td className="px-2 py-1">{p.choice.trim().toLowerCase() === "all" ? <Badge>all</Badge> : p.choice}</td>
                <td className="px-2 py-1 text-xs text-muted-foreground">{p.source}</td>
              </tr>
            ))}
          </Table>
        )}
        <p className="text-sm"><span className="text-muted-foreground">Answer columns:</span>{" "}
          {spec.columns?.length ? spec.columns.join(", ") : "none (one value)"}
          {spec.type === "best" && <> · best by {spec.best_by ?? "?"}, {spec.higher_is_better === null || spec.higher_is_better === undefined
            ? "direction unknown" : spec.higher_is_better ? "higher is better" : "lower is better"}</>}
        </p>
        {(spec.dialogue?.length ?? 0) > 0 && (
          <div className="space-y-1 text-sm">
            <div className="text-muted-foreground">Talk with the user:</div>
            {spec.dialogue!.map((d, i) => (
              <div key={i} className="rounded border p-2">
                {Object.entries(d).map(([k, v]) => <div key={k}><b>{k}:</b> {v}</div>)}
              </div>
            ))}
          </div>
        )}
      </>}
    </Step>
  )
}

// ---------------------------------------------------------------- 3 find
function Details({ d }: { d: Record<string, unknown> }) {
  const regex = (d.regex ?? {}) as Record<string, number>
  const terms = (d.terms ?? {}) as Record<string, number>
  const agent = (Array.isArray(d.agent) ? d.agent : []) as string[]
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">
        How it was found: {Object.keys(regex).length} name hits
        {Object.keys(terms).length ? `, search words: ${Object.keys(terms).join(", ")}` : ""}
        {agent.length ? `, agent terms: ${agent.join(", ")}` : ""}
      </summary>
      <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted/40 p-2">{JSON.stringify(d, null, 2)}</pre>
    </details>
  )
}

function PassageItem({ p, paper, open }: { p: Passage; paper: string; open: Open }) {
  return (
    <li className="rounded border p-2 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-1 text-xs">
        {p.section && <span className="font-medium">{p.section}</span>}
        <Badge variant="outline">{p.kind ?? "text"}</Badge>
        {p.role && <Badge variant={p.role === "value" ? "secondary" : "outline"}>{p.role === "value" ? "has values" : "context"}</Badge>}
        {(p.columns ?? []).map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
        {(p.subjects?.length ?? 0) > 0 && <span className="text-muted-foreground">for {p.subjects!.join(", ")}</span>}
      </div>
      <button type="button" className="w-full text-left hover:bg-muted" title="Open the paper here"
        onClick={() => open({ paper, start: p.start, end: p.end, label: `Find passage${p.section ? ` (${p.section})` : ""}` })}>
        <span className="line-clamp-3 whitespace-pre-wrap font-mono text-xs">{p.text}</span>
      </button>
      {p.quote && <div className="mt-1 text-xs text-muted-foreground">Marked: “{p.quote}”</div>}
    </li>
  )
}

function FindStep({ hits, closedBook, open, n = 3, title = "Find: papers and passages" }: {
  hits: (FindHit | { _error: string })[]; closedBook: boolean; open: Open; n?: number; title?: string }) {
  const good = hits.filter((h): h is FindHit => !isBroken(h))
  const kept = good.filter((h) => h.screen !== "no").length
  return (
    <Step n={n} title={title} status={`${good.length} papers, ${kept} not screened out`}>
      {good.length === 0 && <p className="text-sm text-muted-foreground">
        {closedBook ? "Closed book run: Find reads no papers." : "No papers found (or find.jsonl is not written yet)."}</p>}
      {hits.length > good.length && <p className="text-sm text-destructive">{hits.length - good.length} lines could not be read.</p>}
      {good.map((h) => (
        <div key={h.paper} className={cn("space-y-2 rounded-md border p-2", h.screen === "no" && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm font-semibold">{h.paper}</span>
            {(h.sources ?? []).map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
            <Badge variant="outline" className={SCREEN[h.screen ?? "unsure"]}>screen: {h.screen ?? "unsure"}</Badge>
          </div>
          {h.screen_reason && <p className="text-sm text-muted-foreground">{h.screen_reason}</p>}
          <ul className="space-y-1">{(h.passages ?? []).map((p, i) => <PassageItem key={i} p={p} paper={h.paper} open={open} />)}</ul>
          {h.details && Object.keys(h.details).length > 0 && <Details d={h.details} />}
        </div>
      ))}
    </Step>
  )
}

// ---------------------------------------------------------------- 4 extract
function ExtractStep({ rows, open }: { rows: (Row | { _error: string })[]; open: Open }) {
  const live = rows.filter((r) => !isBroken(r) && !r.dropped).length
  return (
    <Step n={4} title="Extract: values read from the papers" status={`${live} rows used, ${rows.length - live} dropped`}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No rows (or rows.jsonl is not written yet).</p> : (
        <Table label="Extracted rows" head={["#", "paper", "subject", "group", "dose", "time", "value", "paper says", "quote", "note"]}>
          {rows.map((r, i) => isBroken(r)
            ? <tr key={i} className="border-t"><td className="px-2 py-1">{i}</td><td colSpan={9} className="px-2 py-1 text-destructive">{r._error}</td></tr>
            : (
              <tr key={i} className={cn("border-t align-top", r.dropped && "text-muted-foreground opacity-60")}>
                <td className="px-2 py-1 font-mono text-xs">{i}</td>
                <td className="px-2 py-1 font-mono text-xs">{r.paper}</td>
                <td className="px-2 py-1">{r.subject}</td>
                <td className="px-2 py-1 text-xs">{r.patient_group ?? "—"}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.dose ?? "—"}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.time_point ?? "—"}</td>
                <td className="px-2 py-1 whitespace-nowrap font-mono">{r.std ? `${r.std.value} ${unitName(r.std.unit)}` : "can't read"}</td>
                <td className="px-2 py-1">{r.raw}</td>
                <td className="px-2 py-1">
                  <Badge variant="outline" className={r.quote_ok ? SCREEN.yes : SCREEN.no}>{r.quote_ok ? "quote ok" : "quote not checked"}</Badge>
                  <button type="button" disabled={(r.quote_start ?? -1) < 0} title="Open the paper here"
                    className="mt-1 block text-left text-xs underline disabled:no-underline"
                    onClick={() => open({ paper: r.paper, start: r.quote_start ?? -1, end: r.quote_end ?? -1, label: `Quote of row ${i}` })}>
                    “{r.quote.length > 90 ? `${r.quote.slice(0, 90)}…` : r.quote}”
                  </button>
                </td>
                <td className="px-2 py-1 text-xs">{r.dropped ? <span>dropped: {r.dropped}</span> : null}{r.note}</td>
              </tr>
            ))}
        </Table>
      )}
    </Step>
  )
}

// ---------------------------------------------------------------- 5 answer
function AnswerStep({ ans, broken }: { ans: Answer | null; broken: string | null }) {
  return (
    <Step n={5} title="Answer" status={ans ? (ans.not_reported ? "not reported" : `${ans.table?.length ?? 0} values`) : "missing"}>
      {!ans ? <Missing file="answer.json" broken={broken} /> : <>
        {ans.sentence && <p className="font-medium">{ans.sentence}</p>}
        {(ans.table?.length ?? 0) > 0 && (
          <Table label="Answer table" head={[...(ans.columns ?? []), "value", "from rows"]}>
            {ans.table!.map((r, i) => (
              <tr key={i} className="border-t">
                {(ans.columns ?? []).map((c) => <td key={c} className="px-2 py-1">{r.cells[c] ?? "—"}</td>)}
                <td className="px-2 py-1 whitespace-nowrap font-mono">{r.value} {unitName(r.unit)}</td>
                <td className="px-2 py-1 font-mono text-xs">{(r.rows ?? []).join(", ")}</td>
              </tr>
            ))}
          </Table>
        )}
        {(ans.groups ?? []).map((g, i) => (
          <div key={i} className="rounded-md border p-2 text-sm">
            <div className="font-medium">{Object.values(g.group ?? {}).join(", ") || "Everything asked"}</div>
            {g.status === "winner" && <p>Winner: <b>{g.winner}</b>{g.margin ? `, ahead by ${g.margin}` : ""}.</p>}
            {g.status === "tie" && <p>Tie{g.margin ? ` (gap ${g.margin})` : ""}.</p>}
            {g.status === "not_reported" && <p>No winner: not reported{(g.missing?.length ?? 0) > 0 ? ` for ${g.missing!.join(", ")}` : ""}.</p>}
            {g.note && <p className="text-xs text-muted-foreground">{g.note}</p>}
            <ol className="list-decimal pl-5 text-muted-foreground">
              {(g.ranking ?? []).map((r, j) => (
                <li key={j}>{r.candidate}{r.cells && Object.values(r.cells).length ? ` (${Object.values(r.cells).join(", ")})` : ""}:{" "}
                  <span className="font-mono">{r.value} {unitName(r.unit)}</span></li>
              ))}
            </ol>
          </div>
        ))}
      </>}
    </Step>
  )
}

// ---------------------------------------------------------------- baseline: answer text and claims
function TextAnswerStep({ n, ta, broken, domain, open }: { n: number; ta: TextAnswer | null; broken: string | null
  domain: string; open: Open }) {
  const tokens = Object.values(ta?.tokens ?? {}).reduce((a, b) => a + b, 0)
  return (
    <Step n={n} title="Answer text" status={ta ? `${ta.citations?.length ?? 0} papers cited` : "missing"}>
      {!ta ? <Missing file="answer_text.json" broken={broken} /> : <>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {ta.cannot_answer && <Badge variant="outline" className={SCREEN.unsure}>said it cannot answer</Badge>}
          {ta.error && <Badge variant="destructive">error: {ta.error}</Badge>}
          <span className="text-muted-foreground">{tokens} tokens · {(ta.seconds ?? 0).toFixed(1)} s</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{ta.text || "(empty)"}</p>
        {(ta.citations?.length ?? 0) > 0 && (
          <p className="flex flex-wrap items-center gap-1 text-sm"><span className="text-muted-foreground">Cites:</span>
            {ta.citations!.map((c) => <button key={c} type="button" title={`Open ${c} (${domain})`}
              onClick={() => open({ paper: c, start: -1, end: -1, label: "Cited by the answer" })}
              className="rounded-md border px-2 py-0.5 font-mono text-xs hover:bg-muted">{c}</button>)}</p>
        )}
      </>}
    </Step>
  )
}

const CLAIM_COLS = ["value", "subject", "measure", "time", "dose", "patient group", "paper"] as const

function ClaimsStep({ n, tc, broken }: { n: number; tc: TextClaims | null; broken: string | null }) {
  return (
    <Step n={n} title="Claims read from the answer text" status={tc ? `${tc.claims.length} kept, ${tc.dropped.length} dropped` : "not read yet"}>
      {!tc ? (broken ? <Missing file="claims.json" broken={broken} />
        : <p className="text-sm text-muted-foreground">Not read yet: run <code>evqa eval --text</code> on this run.</p>) : <>
        <p className="text-xs text-muted-foreground">Read by {tc.model}. Each claim is one value the answer states.</p>
        {tc.claims.length > 0 && (
          <Table label="Claims" head={[...CLAIM_COLS]}>
            {tc.claims.map((c, i) => (
              <tr key={i} className="border-t align-top" title={c.quote}>
                <td className="px-2 py-1 font-mono">{c.value_text}</td>
                <td className="px-2 py-1">{c.subject || "—"}</td>
                <td className="px-2 py-1">{c.measure || "—"}</td>
                <td className="px-2 py-1 whitespace-nowrap">{c.time_point || "—"}</td>
                <td className="px-2 py-1 whitespace-nowrap">{c.dose || "—"}</td>
                <td className="px-2 py-1 text-xs">{c.patient_group || "—"}</td>
                <td className="px-2 py-1 font-mono text-xs">{c.paper || "—"}</td>
              </tr>
            ))}
          </Table>
        )}
        {tc.dropped.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Dropped claims ({tc.dropped.length})</summary>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {tc.dropped.map((d, i) => <li key={i}><span className="font-mono">{d.claim?.value_text}</span>: {d.why}</li>)}
            </ul>
          </details>
        )}
      </>}
    </Step>
  )
}

// ---------------------------------------------------------------- 6 events
const num = (x: unknown) => (typeof x === "number" ? x : 0)

function EventsStep({ events, n = 6 }: { events: RunEvent[]; n?: number }) {
  const ends = events.filter((e) => e.kind === "end")
  const llm = ends.reduce((acc, e) => {
    const l = (e.data?.llm ?? {}) as Record<string, unknown>
    return { requests: acc.requests + num(l.requests), hits: acc.hits + num(l.cache_hits) }
  }, { requests: 0, hits: 0 })
  const problems = events.filter((e) => e.kind === "problem")
  return (
    <Step n={n} title="Events and LLM calls" status={`${llm.requests} LLM calls (${llm.hits} from cache), ${problems.length} problems`}>
      {events.length === 0 ? <p className="text-sm text-muted-foreground">No events for this question (the API sends only the last 200 lines).</p> : (
        <Table label="Events" head={["step", "what", "seconds", "count", "LLM calls", "from cache", "more"]}>
          {events.map((e, i) => {
            const d = e.data ?? {}
            const l = (d.llm ?? {}) as Record<string, unknown>
            const rest = Object.fromEntries(Object.entries(d).filter(([k]) => !["seconds", "count", "llm"].includes(k)))
            return (
              <tr key={i} className={cn("border-t", e.kind === "problem" && "text-destructive")}>
                <td className="px-2 py-1">{e.step}</td>
                <td className="px-2 py-1">{e.kind}</td>
                <td className="px-2 py-1 font-mono">{d.seconds !== undefined ? String(d.seconds) : ""}</td>
                <td className="px-2 py-1 font-mono">{d.count !== undefined ? String(d.count) : ""}</td>
                <td className="px-2 py-1 font-mono">{l.requests !== undefined ? String(l.requests) : ""}</td>
                <td className="px-2 py-1 font-mono">{l.cache_hits !== undefined ? String(l.cache_hits) : ""}</td>
                <td className="px-2 py-1 font-mono text-xs">{Object.keys(rest).length ? JSON.stringify(rest) : ""}</td>
              </tr>
            )
          })}
        </Table>
      )}
    </Step>
  )
}

// ---------------------------------------------------------------- 8 graph
/** Closed at first: the graph is fetched and drawn only when opened (Cytoscape needs a visible box). */
function GraphStep({ runId, qid, open }: { runId: string; qid: string; open: Open }) {
  const [shown, setShown] = useState(false)
  return (
    <details className="rounded-md border" aria-label="Step 8: Graph" onToggle={(e) => setShown(e.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">8</span>
        <h3 className="font-semibold">Graph: the answer inside the seed</h3>
        <span className="text-xs text-muted-foreground">visual only, no score; click to open</span>
      </summary>
      {shown && <div className="border-t p-3"><QuestionGraph runId={runId} qid={qid} open={open} /></div>}
    </details>
  )
}

// ---------------------------------------------------------------- why (error analysis)
function WhyFact({ f, n, total, open }: { f: ExplainFact; n: number; total: number; open: Open }) {
  return (
    <li className="space-y-1 rounded-md border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">Fact {n} of {total}</span>
        <span className="font-mono text-xs">{f.id} in {f.paper}</span>
        <Badge variant="outline" className={f.right ? SCREEN.yes : SCREEN.no}>{f.right ? "right" : `wrong, lost at ${f.lost_at}`}</Badge>
      </div>
      <p><span className="text-muted-foreground">Truth:</span> {f.truth}</p>
      <p><span className="text-muted-foreground">Why:</span> {f.why}</p>
      <p className="text-muted-foreground">{f.find}</p>
      {f.passage && (
        <button type="button" className="w-full rounded bg-muted/40 p-1 text-left font-mono text-xs hover:bg-muted" title="Open the paper here"
          onClick={() => open({ paper: f.paper, start: f.passage!.start, end: f.passage!.end, label: `Find passage for ${f.id}` })}>
          “{f.passage.text}”
        </button>
      )}
      {!f.passage && f.in_paper && <p className="font-mono text-xs">The fact is here in the paper: “{f.in_paper}”</p>}
      {f.rows.map((r) => (
        <div key={r.index} className="space-y-0.5 border-l-2 pl-2">
          <div>Extract row {r.index}: {r.row} <span className="text-xs text-muted-foreground">({r.quote_ok ? "quote checked" : "quote not checked"})</span></div>
          <div className="text-xs text-muted-foreground">quote: “{r.quote}”</div>
          {(r.problems ?? []).map((p) => <div key={p} className="text-xs text-destructive">problem: {p}</div>)}
          <div className="text-xs">{(r.used_by_answer?.length ?? 0) > 0
            ? `Answer used row ${r.index} as: ${r.used_by_answer!.join("; ")}` : `Answer did not use row ${r.index}.`}</div>
        </div>
      ))}
      {f.rows.length === 0 && !["L0", "find"].includes(f.blame) && (
        <p className="text-xs text-muted-foreground">Extract made no row with the true value at this place.
          {(f.near_rows ?? []).map((r) => ` Row ${r.index} read here instead: ${r.row}.`).join("")}</p>
      )}
    </li>
  )
}

function WhyBox({ runId, qid, open, onClose }: { runId: string; qid: string; open: Open; onClose: () => void }) {
  const why = useExplain(runId, qid)
  const d = why.data
  return (
    <section aria-label={`Why: ${qid}`} className="space-y-2 rounded-md border border-primary/50 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Why is {qid} right or wrong?</h3>
        <button type="button" className="ml-auto text-xs underline" onClick={onClose}>close</button>
      </div>
      {why.isPending && <CardsSkeleton count={1} />}
      {why.isError && <ErrorState error={why.error} title="Could not explain this question" />}
      {d && <>
        {!d.scored && <p className="text-sm text-muted-foreground">This question has no score in eval.json yet.</p>}
        {d.score !== null && d.score !== undefined && (
          <p className="text-sm">Score {d.score} of 1{d.exact ? " (exact)" : ""}. {d.right} of {d.facts.length} true facts shown right.</p>
        )}
        {d.not_reported && <p className="text-sm">{d.not_reported.why}
          {d.not_reported.rows.map((r) => ` The value came from Extract row ${r.index}: ${r.row} (quote: “${r.quote}”).`).join("")}</p>}
        {d.note && <p className="text-xs text-muted-foreground">Note: {d.note}</p>}
        <ol className="space-y-2">
          {d.facts.map((f, i) => <WhyFact key={f.id} f={f} n={i + 1} total={d.facts.length} open={open} />)}
        </ol>
        {(d.spec_mismatches?.length ?? 0) > 0 && (
          <div className="text-xs text-muted-foreground">How Spec read the question differs from the true intent:
            <ul className="list-disc pl-5">{d.spec_mismatches!.map((m) => <li key={m}>{m}</li>)}</ul></div>
        )}
      </>}
    </section>
  )
}

// ---------------------------------------------------------------- the pane
function QuestionView({ run, qid, domain, open, why, onCloseWhy }: { run: RunDetail; qid: string; domain: string
  open: Open; why: boolean; onCloseWhy: () => void }) {
  const item = run.questions[qid] ?? { spec: null, answer: null, find: [], rows: [] }
  const spec = ok<Spec>(item.spec)
  const ans = ok<Answer>(item.answer)
  const ev = ok(run.eval)
  const score = ev?.questions?.[qid]
  const scoreStep = (n: number) => (
    <Step n={n} title="Score against the true answer" status={score ? (score.l3_text
      ? `L3 text ${score.l3_text.score ?? 0}` : `L3 ${score.l3?.score ?? 0}`) : "no score"}>
      {score ? <><QuestionScores q={score} /><FactTable q={score} /></>
        : <p className="text-sm text-muted-foreground">
          {run.eval && isBroken(run.eval) ? `eval.json could not be read: ${run.eval._error}`
            : run.eval ? "This question is not scored in eval.json." : "This run has no eval.json yet."}</p>}
    </Step>
  )
  if (isBaseline(run.config.system)) return (
    <div className="min-w-0 space-y-3">
      <p className="text-sm text-muted-foreground">Baseline run: <Badge variant="outline">{String(run.config.system)}</Badge>.
        It has no Spec, Extract or structured answer, only the papers it read and its answer text.</p>
      <QuestionStep domain={domain} qid={qid} spec={null} />
      <FindStep n={2} title="What it read: papers and passages" hits={item.find ?? []} closedBook={false} open={open} />
      <TextAnswerStep n={3} ta={ok<TextAnswer>(item.answer_text)} domain={domain} open={open}
        broken={isBroken(item.answer_text) ? item.answer_text._error : null} />
      <ClaimsStep n={4} tc={ok<TextClaims>(item.claims)} broken={isBroken(item.claims) ? item.claims._error : null} />
      <EventsStep n={5} events={(run.events ?? []).filter((e) => e.qid === qid)} />
      {scoreStep(6)}
    </div>
  )
  return (
    <div className="min-w-0 space-y-3">
      {why && <WhyBox runId={run.run_id} qid={qid} open={open} onClose={onCloseWhy} />}
      <QuestionStep domain={domain} qid={qid} spec={spec} />
      <SpecStep spec={spec} broken={isBroken(item.spec) ? item.spec._error : null} />
      <FindStep hits={item.find ?? []} closedBook={!!run.config.closed_book} open={open} />
      <ExtractStep rows={item.rows ?? []} open={open} />
      <AnswerStep ans={ans} broken={isBroken(item.answer) ? item.answer._error : null} />
      <EventsStep events={(run.events ?? []).filter((e) => e.qid === qid)} />
      {scoreStep(7)}
      <GraphStep key={`${run.run_id}/${qid}`} runId={run.run_id} qid={qid} open={open} />
    </div>
  )
}

export function RunPane({ domain, runId, qid, onPick }: { domain: string; runId: string; qid: string
  onPick: (runId: string, qid: string) => void }) {
  const runs = useRuns()
  const list = runs.data ?? []
  const current = runId && list.some((r) => r.run_id === runId) ? runId : list[0]?.run_id ?? ""
  const run = useRun(current)
  const [span, setSpan] = useState<PaperSpan | null>(null)
  const [why, setWhy] = useState("")
  if (runs.isPending) return <CardsSkeleton count={2} />
  if (runs.isError) return <ErrorState error={runs.error} />
  if (list.length === 0) return <p className="text-sm">No runs yet: start one with <code>evqa run</code>.</p>
  const cfg = run.data?.config ?? {}
  const qids = run.data ? [...new Set([...Object.keys(run.data.questions),
    ...((Array.isArray(cfg.questions) ? cfg.questions : []) as string[])])].sort() : []
  const q = qid && qids.includes(qid) ? qid : qids[0] ?? ""
  const runDomain = typeof cfg.domain === "string" && cfg.domain ? cfg.domain : domain
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Runs ({list.length}), newest first</h2>
          {list.map((r) => (
            <button key={r.run_id} type="button" onClick={() => onPick(r.run_id, "")}
              className={cn("min-h-11 w-full space-y-1 rounded-md border p-2 text-left text-sm",
                r.run_id === current ? "border-primary bg-primary/5" : "hover:bg-muted")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{r.name ?? "(no config)"}</span>
                {isBaseline(r.system) && <Badge variant="outline">{r.system}</Badge>}
                {r.closed_book && <Badge variant="outline">closed book</Badge>}
                {r.has_eval ? <Badge variant="secondary">scored</Badge> : <Badge variant="outline">not scored</Badge>}
              </div>
              <div className="font-mono text-xs text-muted-foreground">{r.run_id}</div>
              <div className="text-xs text-muted-foreground">{new Date(r.mtime * 1000).toLocaleString()}</div>
            </button>
          ))}
        </div>
        {run.data && (
          <div className="space-y-2">
            <h2 className="text-base font-semibold">Questions ({qids.length})</h2>
            {qids.map((x) => (
              <div key={x} className="flex items-stretch gap-1">
                <button type="button" onClick={() => onPick(current, x)}
                  className={cn("min-h-11 min-w-0 flex-1 rounded-md border p-2 text-left font-mono text-sm",
                    x === q ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                  {x}{!run.data.questions[x] && <span className="ml-2 font-sans text-xs text-muted-foreground">not started</span>}
                </button>
                {run.data.questions[x] && !isBaseline(cfg.system) && (
                  <button type="button" aria-label={`Why: ${x}`} title="Why is this answer right or wrong?"
                    onClick={() => { onPick(current, x); setWhy(`${current}/${x}`) }}
                    className="min-h-11 rounded-md border px-2 text-xs underline hover:bg-muted">why</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        {run.isPending && <CardsSkeleton count={2} />}
        {run.isError && <ErrorState error={run.error} />}
        {run.data && !q && <p className="text-sm text-muted-foreground">This run has no questions yet.</p>}
        {run.data && q && <QuestionView run={run.data} qid={q} domain={runDomain} open={setSpan}
          why={why === `${current}/${q}`} onCloseWhy={() => setWhy("")} />}
      </div>
      <PaperDrawer domain={runDomain} span={span} onClose={() => setSpan(null)} />
    </div>
  )
}
