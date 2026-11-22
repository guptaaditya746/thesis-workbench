/**
 * The optional human review queue: one item at a time, one plain question, a few answer buttons. The automated
 * verdict appears only after the reviewer saves a label (evqa/eval/review.py). Skip moves on without saving;
 * coming back later opens the first item this reviewer has not labelled yet.
 */
import { useState } from "react"

import { usePaper } from "@/api/evqaPapers"
import { type Evidence, type ReviewItem, type ReviewTask, useAddLabel, useReviewItems } from "@/api/evqaReview"
import { CardsSkeleton, ErrorState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const NAME_KEY = "evqa-reviewer"

function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? "" } catch { return "" }
}
function saveName(v: string) {
  try { localStorage.setItem(NAME_KEY, v) } catch { /* private window: the name lasts this visit only */ }
}

/** text[a, b) with the marked values highlighted. */
function Marked({ text, a, b, marks }: { text: string; a: number; b: number; marks: [number, number][] }) {
  const cuts = marks.filter(([s, e]) => s < b && e > a).sort((x, y) => x[0] - y[0])
  const out: React.ReactNode[] = []
  let at = a
  cuts.forEach(([s, e], i) => {
    const s1 = Math.max(s, at)
    if (s1 > at) out.push(text.slice(at, s1))
    out.push(<mark key={i} className="rounded bg-amber-200 px-0.5 font-semibold text-foreground dark:bg-amber-700">
      {text.slice(s1, Math.min(e, b))}</mark>)
    at = Math.min(e, b)
  })
  if (at < b) out.push(text.slice(at, b))
  return <>{out}</>
}

/** A table excerpt (caption, header row, separator, value row) drawn as a small table. */
function TableExcerpt({ ev }: { ev: Evidence }) {
  const lines: { start: number; text: string }[] = []
  let pos = 0
  for (const line of ev.text.split("\n")) { lines.push({ start: pos, text: line }); pos += line.length + 1 }
  const isRow = (l: string) => l.includes("|")
  const isSep = (l: string) => /^\s*\|?\s*:?-{3,}/.test(l)
  const caption = lines.filter((l) => !isRow(l.text))
  const rows = lines.filter((l) => isRow(l.text) && !isSep(l.text))
  /** [start, end) of each cell in ev.text; the empty pieces outside a leading or trailing "|" are dropped. */
  const cells = (l: { start: number; text: string }) => {
    const out: [number, number][] = []
    let s = 0
    for (let i = 0; i <= l.text.length; i++) {
      if (i === l.text.length || l.text[i] === "|") { out.push([l.start + s, l.start + i]); s = i + 1 }
    }
    if (l.text.trimStart().startsWith("|")) out.shift()
    if (l.text.trimEnd().endsWith("|")) out.pop()
    return out
  }
  return (
    <div className="overflow-x-auto">
      {caption.map((c) => <p key={c.start} className="mb-1 text-sm font-medium">{c.text}</p>)}
      <table className="w-full border text-sm">
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.start} className={cn("border-t", ri === 0 && "bg-muted/50 font-medium")}>
              {cells(r).map(([a, b]) => <td key={a} className="border-l px-2 py-1">
                <Marked text={ev.text} a={a} b={b} marks={ev.marks} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EvidenceBlock({ ev }: { ev: Evidence }) {
  return (
    <div className="rounded-md border bg-background p-3">
      {ev.kind === "table" ? <TableExcerpt ev={ev} />
        : <p className="text-sm leading-relaxed"><Marked text={ev.text} a={0} b={ev.text.length} marks={ev.marks} /></p>}
    </div>
  )
}

function FullPaper({ domain, paper }: { domain: string; paper: string }) {
  const [open, setOpen] = useState(false)
  const p = usePaper(open ? domain : "", paper)
  return (
    <details className="text-sm" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-muted-foreground">Show the whole paper ({paper})</summary>
      {p.isPending && open && <p className="text-xs">Loading…</p>}
      {p.data?.paper && <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded border p-2 text-xs">
        {p.data.paper}</pre>}
    </details>
  )
}

function Shown({ task, item, scope }: { task: ReviewTask; item: ReviewItem; scope: string }) {
  const s = item.show
  if (task.task === "population") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">The system wrote</p>
          <p className="text-base">{s.label}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">The true patient group</p>
          <p className="text-base">{s.conditions}</p></div>
        <p className="text-xs text-muted-foreground sm:col-span-2">Used for {s.facts} value{s.facts === 1 ? "" : "s"} in this run.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div>
        <h3 className="mb-1 text-sm font-semibold">The claim</h3>
        <table className="text-sm"><tbody>
          {(s.claim ?? []).map((c) => <tr key={c.part}><td className="pr-4 text-muted-foreground">{c.part}</td>
            <td className="font-medium">{c.value}</td></tr>)}
        </tbody></table>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">What the paper says <span className="font-normal text-muted-foreground">
          (highlighted: where the checker found the number)</span></h3>
        {(s.evidence ?? []).length === 0 && <p className="text-sm">The checker found no place for this number. Open the
          whole paper below to look yourself.</p>}
        {(s.evidence ?? []).map((ev, i) => <EvidenceBlock key={i} ev={ev} />)}
      </div>
      {s.paper && <FullPaper domain={scope} paper={s.paper} />}
    </div>
  )
}

function Automated({ task, auto }: { task: ReviewTask; auto: Record<string, unknown> }) {
  const yes = (v: unknown) => (v ? "yes" : "no")
  const lines = task.task === "population"
    ? [`LLM judge (${String(auto.judge_model ?? "?")}): ${String(auto.judge)}`, String(auto.reason ?? "")]
    : [`Checker (L0) found the number: ${String(auto.l0)} · in the planned place: ${yes(auto.l0_in_planned_place)}` +
        ` · matched ambiguously: ${yes(auto.l0_ambiguous)}`,
       `Writer check: ${auto.writer == null ? "no report" : String(auto.writer)}`,
       `Why this item was picked: ${(auto.why_sampled as string[] | undefined)?.join("; ") ?? ""}`]
  return (
    <div role="status" className="rounded-md border border-dashed p-3 text-sm">
      <p className="font-medium">What the automatic checks said</p>
      {lines.filter(Boolean).map((l) => <p key={l} className="text-muted-foreground">{l}</p>)}
    </div>
  )
}

/** One item and the reviewer's answer; keyed by item id, so its state starts from the item's saved label. */
function ItemCard({ task, item, scope, name, onSaved, onNext, onPrev }: { task: ReviewTask; item: ReviewItem
  scope: string; name: string; onSaved: () => void; onNext: () => void; onPrev?: () => void }) {
  const add = useAddLabel(task.task, scope)
  const [choice, setChoice] = useState(item.label?.choice ?? "")
  const [parts, setParts] = useState<string[]>(item.label?.parts ?? [])
  const [note, setNote] = useState(item.label?.note ?? "")
  const [revealed, setRevealed] = useState<Record<string, unknown> | null>(item.automated ?? null)
  const needParts = task.parts.length > 0 && (choice === "partly" || choice === "unsupported")
  const save = () => add.mutate({ scope, item_id: item.id, item_version: item.version, reviewer: name, choice,
    parts: needParts ? parts : [], note }, { onSuccess: (r) => { onSaved(); setRevealed(r.automated) } })
  return (
    <section aria-label="Review item" className="space-y-4 rounded-md border p-4">
      <h3 className="text-lg font-semibold">{task.question}</h3>
      <Shown task={task} item={item} scope={scope} />
      <fieldset className="space-y-2" disabled={add.isPending}>
        <legend className="text-sm font-semibold">Your answer</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {task.choices.map((c) => (
            <button key={c.id} type="button" aria-pressed={choice === c.id} onClick={() => setChoice(c.id)}
              className={cn("min-h-11 rounded-md border p-3 text-left text-sm",
                choice === c.id ? "border-primary bg-primary/10" : "hover:bg-muted")}>
              <span className="font-semibold">{c.label}</span>
              <span className="block text-xs text-muted-foreground">{c.help}</span>
            </button>
          ))}
        </div>
        {needParts && (
          <div className="flex flex-wrap items-center gap-2 text-sm"><span>Which part? (optional)</span>
            {task.parts.map((p) => (
              <button key={p} type="button" aria-pressed={parts.includes(p)}
                onClick={() => setParts(parts.includes(p) ? parts.filter((x) => x !== p) : [...parts, p])}
                className={cn("rounded-full border px-3 py-1", parts.includes(p) && "border-primary bg-primary/10")}>
                {p}</button>
            ))}
          </div>
        )}
        <details className="text-sm" open={!!note}>
          <summary className="cursor-pointer text-muted-foreground">Add a note (optional)</summary>
          <Textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
        </details>
      </fieldset>
      {add.isError && <ErrorState error={add.error} />}
      {revealed && <Automated task={task} auto={revealed} />}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} variant={revealed ? "outline" : "default"} disabled={!choice || add.isPending}>
          {revealed ? "Save changed answer" : "Save answer"}</Button>
        <Button variant={revealed ? "default" : "outline"} onClick={onNext}>{revealed ? "Next item" : "Skip"}</Button>
        {onPrev && <Button variant="ghost" onClick={onPrev}>Previous</Button>}
      </div>
    </section>
  )
}

export function ReviewPane({ task, scope, onBack }: { task: ReviewTask; scope: string; onBack: () => void }) {
  const [name, setName] = useState(loadName)
  const [draft, setDraft] = useState(name)
  const items = useReviewItems(task.task, scope, name)
  const [pos, setPos] = useState<number | null>(null)     // null: the first item without this reviewer's label
  const list = items.data ?? []
  const done = list.filter((i) => i.label).length
  const firstOpen = list.findIndex((i) => !i.label)
  const at = pos ?? (firstOpen < 0 ? list.length : firstOpen)
  const item = at < list.length ? list[at] : null

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={onBack}>← Back to scores</Button>
      <h2 className="text-base font-semibold">{task.title}</h2>
      {name && <span className="text-sm text-muted-foreground">reviewer: {name} ·{" "}
        <button type="button" className="underline" onClick={() => { setName(""); setPos(null) }}>change</button></span>}
    </div>
  )
  if (!name) {
    return (
      <div className="space-y-4">{header}
        <form className="max-w-sm space-y-2" onSubmit={(e) => {
          e.preventDefault(); const v = draft.trim(); if (v) { saveName(v); setName(v); setPos(null) } }}>
          <label className="block text-sm">Your name (kept in this browser, saved with each label)
            <input aria-label="Reviewer name" className="mt-1 w-full rounded border bg-background p-2" value={draft}
              onChange={(e) => setDraft(e.target.value)} /></label>
          <Button type="submit" disabled={!draft.trim()}>Start</Button>
        </form>
      </div>
    )
  }
  if (items.isPending) return <div className="space-y-4">{header}<CardsSkeleton count={1} /></div>
  if (items.isError) return <div className="space-y-4">{header}<ErrorState error={items.error} /></div>
  if (list.length === 0) return <div className="space-y-4">{header}<p className="text-sm">Nothing to review here yet.</p></div>
  if (!item) {
    return (
      <div className="space-y-4">{header}
        <p className="rounded-md border p-3 text-sm">You have labelled {done} of {list.length} items. Thank you.{" "}
          {done < list.length && <button type="button" className="underline" onClick={() => setPos(null)}>
            Go to the ones you skipped</button>}</p>
        <Button variant="outline" onClick={() => setPos(0)}>Look through your answers</Button>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {header}
      <p className="text-sm text-muted-foreground">Item {at + 1} of {list.length} · {done} labelled by you</p>
      <ItemCard key={item.id} task={task} item={item} scope={scope} name={name} onSaved={() => setPos(at)}
        onNext={() => setPos(at + 1)}
        onPrev={at > 0 ? () => setPos(at - 1) : undefined} />
    </div>
  )
}
