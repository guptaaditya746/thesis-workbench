/**
 * Workbench "Paper" pane (S3). Read-only. Left: the papers. Middle: the written paper.md as a page, with every seed
 * fact marked green (red when the paper has it with the wrong sign or unit) and numbers the writer added marked
 * amber. Right: the list of seed facts: found, in the planned place, missing. Before paper.md exists it shows the
 * two files the writer gets (idea_sparse.md, experimental_log.md).
 */
import { type ComponentProps, useState } from "react"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { type L0Fact, type L0Result, usePaper, usePaperList } from "@/api/evqaPapers"
import { CardsSkeleton, ErrorState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type MarkKind = "fact" | "misplaced" | "near" | "extra"
/** `style` overrides the kind's colour (the run pane marks a picked quote or passage). */
export type Mark = { start: number; end: number; kind: MarkKind; title: string; style?: string }

const MARK_STYLE: Record<MarkKind, string> = {
  fact: "bg-emerald-500/25 ring-1 ring-emerald-600/50",
  misplaced: "bg-sky-500/20 ring-1 ring-sky-600/60",
  near: "bg-red-500/20 ring-1 ring-red-600/60",
  extra: "bg-amber-400/30 ring-1 ring-amber-600/60",
}
const MARK_HELP: Record<MarkKind, string> = {
  fact: "seed fact, in the planned place",
  misplaced: "seed fact, but in the wrong place (table vs sentence)",
  near: "almost a seed fact: wrong sign or % instead of percentage points",
  extra: "number the writer added (not in the seed)",
}
const PLACE = { table: "in a table", text: "in a sentence" }

/** "measure, dose, week N", leaving out the parts a fact has not got (paperfactory facts have no dose or week). */
function factWhere(f: L0Fact): string {
  return [f.measure, f.dose_text, f.week !== null ? `week ${f.week}` : null].filter(Boolean).join(", ")
}

/** Every mark of the L0 result, one per span (a fact beats a near miss beats an extra number at the same place). */
function marksOf(l0: L0Result): Mark[] {
  const rank: Record<MarkKind, number> = { fact: 0, misplaced: 0, near: 1, extra: 2 }
  const all: Mark[] = []
  for (const f of l0.facts) {
    for (const s of f.spans) {
      all.push({ start: s.start, end: s.end, kind: s.where === f.placement ? "fact" : "misplaced",
        title: `${f.id}: ${factWhere(f)}${f.value ? ` = ${f.value} ${f.unit_text}` : ""}` })
    }
    for (const s of f.near) all.push({ start: s.start, end: s.end, kind: "near", title: `${f.id}? ${s.why}` })
  }
  for (const s of l0.extra) all.push({ start: s.start, end: s.end, kind: "extra", title: "not a seed fact" })
  const best = new Map<number, Mark>()
  for (const m of all) {
    const old = best.get(m.start)
    if (!old || rank[m.kind] < rank[old.kind]) best.set(m.start, m)
  }
  return [...best.values()].sort((a, b) => a.start - b.start)
}

/** paper.md with each mark turned into a link `[raw](#evqa-mark-N)`; the link renderer draws it as a highlight.
 *  Offsets from the backend count Unicode code points, so the text is cut as an array of code points. */
function markedMarkdown(text: string, marks: Mark[]): string {
  const chars = Array.from(text)
  let out = ""
  let pos = 0
  marks.forEach((m, i) => {
    if (m.start < pos) return
    out += chars.slice(pos, m.start).join("") + `[${chars.slice(m.start, m.end).join("")}](#evqa-mark-${i})`
    pos = m.end
  })
  return out + chars.slice(pos).join("")
}

const BASE: Components = {
  h1: (p) => <h1 className="mb-3 text-xl font-semibold" {...p} />,
  h2: (p) => <h2 className="mt-5 mb-2 text-lg font-semibold" {...p} />,
  h3: (p) => <h3 className="mt-4 mb-2 font-semibold" {...p} />,
  p: (p) => <p className="my-2 leading-relaxed" {...p} />,
  ul: (p) => <ul className="my-2 list-disc pl-6" {...p} />,
  ol: (p) => <ol className="my-2 list-decimal pl-6" {...p} />,
  table: (p) => <div className="my-3 overflow-x-auto"><table className="text-sm" {...p} /></div>,
  th: (p) => <th className="border bg-muted/50 px-2 py-1 text-left font-medium" {...p} />,
  td: (p) => <td className="border px-2 py-1" {...p} />,
  code: (p) => <code className="rounded bg-muted px-1 text-xs" {...p} />,
}

export function MarkedPaper({ text, marks }: { text: string; marks: Mark[] }) {
  const components: Components = {
    ...BASE,
    a: ({ href, children, ...rest }: ComponentProps<"a">) => {
      const n = href?.startsWith("#evqa-mark-") ? Number(href.slice("#evqa-mark-".length)) : NaN
      const m = marks[n]
      if (!m) return <a href={href} className="underline" {...rest}>{children}</a>
      return <mark id={`evqa-mark-${n}`} data-kind={m.kind} title={m.title}
        className={cn("rounded px-0.5 text-foreground", m.style ?? MARK_STYLE[m.kind])}>{children}</mark>
    },
  }
  return <Markdown remarkPlugins={[remarkGfm]} components={components}>{markedMarkdown(text, marks)}</Markdown>
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {(Object.keys(MARK_STYLE) as MarkKind[]).map((k) => (
        <span key={k} className="flex items-center gap-1">
          <mark className={cn("rounded px-1 text-foreground", MARK_STYLE[k])}>1.2</mark>{MARK_HELP[k]}
        </span>
      ))}
    </div>
  )
}

function FactList({ l0, marks }: { l0: L0Result; marks: Mark[] }) {
  const jump = (f: L0Fact) => {
    const n = marks.findIndex((m) => m.start === f.spans[0]?.start)
    document.getElementById(`evqa-mark-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }
  const groups = [
    { title: "Missing", facts: l0.facts.filter((f) => f.status === "missing"), tone: "text-destructive" },
    { title: "Found, but in the wrong place", facts: l0.facts.filter((f) => f.status === "found" && !f.in_planned_place),
      tone: "text-sky-700 dark:text-sky-400" },
    { title: "Found in the planned place", facts: l0.facts.filter((f) => f.in_planned_place),
      tone: "text-emerald-700 dark:text-emerald-400" },
  ]
  return (
    <div className="space-y-3 text-sm">
      {groups.map((g) => g.facts.length > 0 && (
        <div key={g.title}>
          <h3 className={cn("font-semibold", g.tone)}>{g.title} ({g.facts.length})</h3>
          <ul className="mt-1 space-y-1">
            {g.facts.map((f) => (
              <li key={f.id}>
                <button type="button" disabled={f.status === "missing"} onClick={() => jump(f)}
                  className="w-full rounded px-1 py-0.5 text-left hover:bg-muted disabled:cursor-default">
                  <span className="font-mono text-xs">{f.id}</span>{" "}
                  <b className="font-mono">{f.value} {f.unit_text}</b>{" "}
                  <span className="text-muted-foreground">
                    {factWhere(f)}; should be {PLACE[f.placement]}
                  </span>
                  {f.near.length > 0 && <span className="block text-xs text-destructive">
                    almost: “{f.near[0].raw}” ({f.near[0].why})</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <h3 className="font-semibold text-amber-700 dark:text-amber-400">Numbers the writer added ({l0.extra.length})</h3>
        {l0.extra.length === 0 ? <p className="text-muted-foreground">None.</p> : (
          <ul className="mt-1 flex flex-wrap gap-1">
            {l0.extra.map((e) => <li key={e.start}><Badge variant="outline" className="font-mono">{e.raw}</Badge></li>)}
          </ul>
        )}
      </div>
      <details>
        <summary className="cursor-pointer text-muted-foreground">
          Numbers that are not results ({l0.ignored.length}): years, doses, weeks, counts, p-values
        </summary>
        <ul className="mt-1 flex flex-wrap gap-1 text-xs">
          {l0.ignored.map((e) => <li key={e.start}><Badge variant="secondary">{e.raw} · {e.kind}</Badge></li>)}
        </ul>
      </details>
    </div>
  )
}

function Brief({ name, text }: { name: string; text: string | null }) {
  return (
    <section className="min-w-0 rounded-md border p-3">
      <h3 className="font-mono text-sm font-semibold">{name}</h3>
      {text === null ? <p className="text-sm text-muted-foreground">Not made yet.</p>
        : <div className="text-sm"><Markdown remarkPlugins={[remarkGfm]} components={BASE}>{text}</Markdown></div>}
    </section>
  )
}

function Summary({ l0 }: { l0: L0Result }) {
  const s = l0.summary
  const items = [
    { label: "seed facts", value: s.facts, ok: true },
    { label: "found", value: s.found, ok: s.found === s.facts },
    { label: "in the planned place", value: s.in_planned_place, ok: s.in_planned_place === s.facts },
    { label: "missing", value: s.missing, ok: s.missing === 0 },
    { label: "numbers added", value: s.extra, ok: s.extra === 0 },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) => (
        <div key={c.label} className={cn("rounded-md border px-3 py-1.5 text-sm",
          c.ok ? "border-emerald-600/40 bg-emerald-600/10" : "border-amber-600/50 bg-amber-500/10")}>
          <span className="font-medium">{c.label}:</span> {c.value}
        </div>
      ))}
    </div>
  )
}

function PaperView({ domain, id }: { domain: string; id: string }) {
  const q = usePaper(domain, id)
  if (q.isPending) return <CardsSkeleton count={1} />
  if (q.isError) return <ErrorState error={q.error} />
  const p = q.data
  const briefs = (["idea_sparse.md", "experimental_log.md"] as const).map((b) =>
    <Brief key={b} name={b} text={p.briefs[b]} />)
  if (p.paper === null || p.l0 === null) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-dashed p-3 text-sm">
          <b>Paper not written yet.</b> The writer (PaperOrchestra) will turn these two files into{" "}
          <span className="font-mono">{p.folder}/paper.md</span>. They are made by code from the seed.
        </p>
        <div className="grid gap-3 xl:grid-cols-2">{briefs}</div>
      </div>
    )
  }
  const marks = marksOf(p.l0)
  return (
    <div className="space-y-3">
      <Summary l0={p.l0} />
      <Legend />
      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,360px)]">
        <article aria-label={`Paper ${p.id}`} className="min-w-0 rounded-md border p-4">
          <MarkedPaper text={p.paper} marks={marks} />
        </article>
        <aside aria-label="Seed facts" className="min-w-0 space-y-2">
          <h2 className="text-base font-semibold">Seed facts</h2>
          <FactList l0={p.l0} marks={marks} />
        </aside>
      </div>
      <p className="text-xs text-muted-foreground">
        Check {p.l0.stored ? "read from the saved L0 file" : "run now (no saved L0 file for this paper.md yet)"}.
      </p>
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground">What the writer was given</summary>
        <div className="mt-2 grid gap-3 xl:grid-cols-2">{briefs}</div>
      </details>
    </div>
  )
}

export function PaperPane({ domain }: { domain: string }) {
  const list = usePaperList(domain)
  const [picked, setPicked] = useState("")
  if (list.isPending) return <CardsSkeleton count={2} />
  if (list.isError) return <ErrorState error={list.error} />
  const current = picked || list.data[0]?.id || ""
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Papers ({list.data.length})</h2>
        {list.data.map((p) => (
          <button key={p.id} type="button" onClick={() => setPicked(p.id)}
            className={cn("min-h-11 w-full space-y-1 rounded-md border p-2 text-left text-sm",
              p.id === current ? "border-primary bg-primary/5" : "hover:bg-muted")}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs">{p.id}</span>
              <Badge variant={p.split === "test" ? "outline" : "default"}>{p.split}</Badge>
              {p.has_paper ? <Badge variant="secondary">written</Badge> : <Badge variant="outline">not written</Badge>}
            </div>
            <div>{p.title}</div>
            {p.l0 && <div className="text-xs text-muted-foreground">
              {p.l0.found}/{p.l0.facts} facts found, {p.l0.missing} missing, {p.l0.extra} numbers added</div>}
          </button>
        ))}
      </div>
      <div className="min-w-0">{current && <PaperView domain={domain} id={current} />}</div>
    </div>
  )
}
