/**
 * One question of a run drawn inside its piece of the seed graph (Cytoscape.js + fcose; data from
 * /api/evqa/runs/{run}/graph/{qid}, built by backend/evqa/eval/qgraph.py). Facts are the hubs, each inside a box for
 * its paper; the drug, comparator, patient group, dose, week and measure sit around them. Colours: green = gold fact
 * found and right, red = gold fact missed, orange = extra or wrong run row, grey = seed context the question does not
 * need. Click a node (or a line of the list) for its value, quote and paper; "Open in paper" marks the quote.
 */
import cytoscape, { type Core, type ElementDefinition } from "cytoscape"
import fcose from "cytoscape-fcose"
import { useEffect, useMemo, useRef, useState } from "react"

import { type GraphNodeData, type QuestionGraph as Graph, useRunGraph } from "@/api/evqaRuns"
import { CardsSkeleton, ErrorState } from "@/components/states"
import { cn } from "@/lib/utils"

import type { PaperSpan } from "./PaperDrawer"

cytoscape.use(fcose)

const COLOR = { found: "#16a34a", missed: "#dc2626", orange: "#ea580c", context: "#94a3b8", gold: "#334155" }
const LEGEND: [string, string][] = [
  [COLOR.found, "found and right"], [COLOR.missed, "gold fact missed"], [COLOR.orange, "extra or wrong row"],
  [COLOR.context, "seed context, not needed"],
]
const KIND_NAME: Record<string, string> = { fact: "gold fact", row: "run row", paper: "paper", drug: "drug",
  comparator: "compared with", group: "patient group", dose: "dose", time: "week", measure: "measure" }
const STATUS_TEXT: Record<string, string> = { found: "found and right", missed: "gold fact missed",
  wrong: "wrong row: same value and place as a gold fact, but a wrong name", extra: "extra row: matches no gold fact",
  context: "seed context, not needed by the question", gold: "used by the question's gold facts" }
const BLAME: Record<string, string> = { L0: "the paper does not state it", find: "lost at Find", extract: "lost at Extract",
  answer: "lost at Answer", none: "in the answer" }

const fill = (status: string) => status === "found" ? COLOR.found : status === "missed" ? COLOR.missed
  : status === "wrong" || status === "extra" ? COLOR.orange : status === "context" ? COLOR.context : COLOR.gold

const STYLE: cytoscape.StylesheetJson = [
  { selector: "node", style: {
    label: "data(label)", "font-size": 10, color: "#1e293b", "text-valign": "bottom", "text-margin-y": 4,
    "text-wrap": "wrap", "text-max-width": "120px", "text-background-color": "#ffffff", "text-background-opacity": 0.85,
    "text-background-padding": "1px", "background-color": "#ffffff", "border-width": 2, "border-color": "data(color)",
    width: 26, height: 26 } },
  { selector: 'node[kind = "fact"], node[kind = "row"]', style: {
    shape: "round-rectangle", width: 54, height: 24, "background-color": "data(color)", "border-color": "#ffffff",
    color: "#ffffff", "text-valign": "center", "text-margin-y": 0, "text-background-opacity": 0,
    "font-family": "monospace", "font-weight": "bold" } },
  { selector: 'node[kind = "row"]', style: { "border-style": "dashed", "border-color": "#7c2d12", "border-width": 2 } },
  { selector: 'node[kind = "drug"]', style: { shape: "ellipse", width: 34, height: 34, "font-weight": "bold" } },
  { selector: 'node[kind = "comparator"]', style: { shape: "ellipse" } },
  { selector: 'node[kind = "group"]', style: { shape: "round-hexagon", width: 32, height: 30 } },
  { selector: 'node[kind = "dose"]', style: { shape: "diamond" } },
  { selector: 'node[kind = "time"]', style: { shape: "round-triangle" } },
  { selector: 'node[kind = "measure"]', style: { shape: "round-rectangle", width: 30, height: 22 } },
  { selector: ":parent", style: {
    shape: "round-rectangle", "background-color": "#f8fafc", "background-opacity": 0.6, "border-width": 1,
    "border-color": "data(color)", "border-style": "dashed", "text-valign": "top", "text-halign": "center",
    "text-margin-y": -4, "font-size": 11, "font-weight": "bold", "text-max-width": "260px", padding: "12px" } },
  { selector: '[status = "context"]', style: { opacity: 0.55 } },
  { selector: "edge", style: { width: 1.2, "line-color": "data(color)", "curve-style": "bezier", opacity: 0.7 } },
  { selector: 'edge[status = "wrong"]', style: { "line-style": "dashed", width: 2.5, "target-arrow-shape": "triangle",
    "target-arrow-color": COLOR.orange } },
  { selector: ".faded", style: { opacity: 0.1 } },
  { selector: "node.lit", style: { "border-color": "#0f172a", "border-width": 3 } },
  { selector: "edge.lit", style: { width: 2.5, label: "data(label)", "font-size": 9, "text-rotation": "autorotate",
    "text-background-color": "#ffffff", "text-background-opacity": 1, opacity: 1 } },
]

function elements(g: Graph, showContext: boolean): ElementDefinition[] {
  const nodes = g.elements.nodes.filter((n) => showContext || n.data.status !== "context")
  const keep = new Set(nodes.map((n) => n.data.id))
  const edges = g.elements.edges.filter((e) => keep.has(e.data.source) && keep.has(e.data.target))
  const edgeColor = (s: string) => s === "context" ? "#cbd5e1" : s === "gold" ? "#64748b" : COLOR.orange
  return [
    ...nodes.map((n) => ({ data: { ...n.data, parent: n.data.parent && keep.has(n.data.parent) ? n.data.parent : undefined,
      color: fill(n.data.status) } })),
    ...edges.map((e) => ({ data: { ...e.data, color: edgeColor(e.data.status) } })),
  ]
}

function Canvas({ els, selected, onSelect, label }: {
  els: ElementDefinition[]; selected: string; onSelect: (id: string) => void; label: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const cy = useRef<Core | null>(null)
  const pick = useRef(onSelect)
  useEffect(() => { pick.current = onSelect }, [onSelect])

  useEffect(() => {
    if (!box.current) return
    const c = cytoscape({ container: box.current, elements: els, style: STYLE, wheelSensitivity: 0.3,
      layout: { name: "fcose", animate: false, randomize: true, nodeRepulsion: () => 6000, idealEdgeLength: () => 70,
        nestingFactor: 0.4, nodeSeparation: 60, packComponents: true } as cytoscape.LayoutOptions })
    c.on("tap", "node", (e) => pick.current(e.target.id()))
    c.on("tap", (e) => { if (e.target === c) pick.current("") })
    cy.current = c
    return () => { c.destroy(); cy.current = null }
  }, [els])

  useEffect(() => {   // light up the chosen node and its neighbours
    const c = cy.current
    if (!c) return
    c.elements().removeClass("faded lit")
    if (!selected) return
    const n = c.getElementById(selected)
    if (n.empty()) return
    const hood = n.closedNeighborhood()
    c.elements().not(hood).not(hood.parents()).addClass("faded")
    hood.addClass("lit")
  }, [selected, els])

  return (
    <div className="relative rounded-md border bg-white">
      <div ref={box} className="h-[560px] w-full" role="img" aria-label={label} />
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button type="button" onClick={() => cy.current?.fit(undefined, 30)}
          className="h-9 rounded-md border bg-white px-3 text-xs text-slate-800">Fit</button>
        <button type="button" onClick={() => cy.current?.layout({ name: "fcose", animate: true } as cytoscape.LayoutOptions).run()}
          className="h-9 rounded-md border bg-white px-3 text-xs text-slate-800">Re-arrange</button>
      </div>
    </div>
  )
}

function Field({ name, value }: { name: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null
  return <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="text-muted-foreground">{name}</dt><dd className="break-words">{value}</dd></div>
}

function Side({ n, open }: { n: GraphNodeData | null; open: (s: PaperSpan) => void }) {
  if (!n) return <p className="text-sm text-muted-foreground">Click a node to see its value, quote and paper.</p>
  const value = n.kind === "fact" || n.kind === "row"
  const wrongNames = Object.entries(n.names ?? {}).flatMap(([fact, names]) =>
    Object.entries(names ?? {}).filter(([, okName]) => !okName).map(([slot]) => `${slot} (vs ${fact})`))
  const canOpen = !!n.paper && typeof n.start === "number" && typeof n.end === "number" && n.start >= 0 && n.end > n.start
  return (
    <div className="space-y-3 text-sm" aria-label="Chosen node">
      <div className="flex items-center gap-2">
        <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: fill(n.status) }} />
        <span className="font-semibold">{value ? `${n.value ?? ""} ${n.unit ?? ""}` : n.label}</span>
        <span className="text-xs text-muted-foreground">{KIND_NAME[n.kind] ?? n.kind}</span>
      </div>
      <p className="text-xs">{STATUS_TEXT[n.status] ?? n.status}</p>
      <dl className="space-y-1 text-xs">
        <Field name="paper" value={n.paper} />
        <Field name="gold fact" value={n.fact} />
        <Field name="run row" value={n.rows?.length ? n.rows.map((r) => `#${r}`).join(", ") : null} />
        <Field name="where lost" value={n.blame ? BLAME[n.blame] ?? n.blame : null} />
        {value && <>
          <Field name="drug" value={n.subject} />
          <Field name="compared with" value={n.comparator} />
          <Field name="patients" value={n.group} />
          <Field name="dose" value={n.dose} />
          <Field name="week" value={n.week} />
          <Field name="measure" value={n.measure} />
        </>}
        <Field name="wrong names" value={wrongNames.join(", ")} />
        <Field name="note" value={n.note} />
      </dl>
      {n.quote && <blockquote className="border-l-2 pl-2 text-xs italic">“{n.quote}”
        <span className="ml-1 not-italic text-muted-foreground">({n.span_from === "seed" ? "where the paper states it" : "the row's quote"})</span>
      </blockquote>}
      {canOpen && (
        <button type="button" className="h-9 rounded-md border px-3 text-xs hover:bg-muted"
          onClick={() => open({ paper: n.paper!, start: n.start!, end: n.end!,
            label: `${KIND_NAME[n.kind] ?? n.kind} ${n.fact ?? (n.row != null ? `#${n.row}` : "")}: ${n.value ?? ""} ${n.unit ?? ""}` })}>
          Open in paper
        </button>
      )}
    </div>
  )
}

export function QuestionGraph({ runId, qid, open }: { runId: string; qid: string; open: (s: PaperSpan) => void }) {
  const q = useRunGraph(runId, qid)
  const [showContext, setShowContext] = useState(true)
  const [selected, setSelected] = useState("")
  const els = useMemo(() => (q.data ? elements(q.data, showContext) : []), [q.data, showContext])
  if (q.isPending) return <CardsSkeleton count={1} />
  if (q.isError) return <ErrorState error={q.error} />
  const g = q.data
  const byId = new Map(g.elements.nodes.map((n) => [n.data.id, n.data]))
  const chosen = byId.get(selected) ?? null
  const values = g.elements.nodes.filter((n) => (n.data.kind === "fact" || n.data.kind === "row")
    && (showContext || n.data.status !== "context"))
  const c = g.counts
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {LEGEND.map(([color, name]) => (
          <span key={name} className="flex items-center gap-1">
            <span className="inline-block size-3 rounded-sm" style={{ background: color }} />{name}
          </span>
        ))}
        <label className="ml-auto flex min-h-9 items-center gap-1.5">
          <input type="checkbox" checked={showContext} onChange={(e) => setShowContext(e.target.checked)} />
          Show grey context
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {c.found} found, {c.missed} missed, {c.wrong + c.extra} extra or wrong rows, {c.context} context facts
        {g.truncated > 0 && ` (${g.truncated} more context facts left out to keep the graph small)`}.
        Facts sit in a box per paper; dashed boxes are run rows.
      </p>
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <Canvas els={els} selected={selected} onSelect={setSelected} label={`Answer graph of ${qid}`} />
        <div className="rounded-md border p-3"><Side n={chosen} open={open} /></div>
      </div>
      <details className="rounded-md border">
        <summary className="cursor-pointer p-2 text-xs">List of facts and rows ({values.length})</summary>
        <ul className="flex flex-wrap gap-1 p-2" aria-label={`Facts and rows of ${qid}`}>
          {values.map((n) => (
            <li key={n.data.id}>
              <button type="button" onClick={() => setSelected(n.data.id)}
                className={cn("min-h-9 rounded-md border px-2 font-mono text-xs", selected === n.data.id && "ring-2 ring-primary")}
                style={{ borderLeft: `6px solid ${fill(n.data.status)}` }}>
                {n.data.kind === "row" ? `row #${n.data.row}` : n.data.fact} · {n.data.label}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
