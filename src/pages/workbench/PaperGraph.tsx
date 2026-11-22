/**
 * One knowledge graph per paper (Cytoscape.js + fcose layout). The paper links to its drug, comparator and
 * patients; each fact links to its measure, dose and time point, so shared parts show as hubs.
 * Click a node to light up its neighbours (the fact's line is shown under the graph); click empty space to clear.
 */
import cytoscape, { type Core, type ElementDefinition } from "cytoscape"
import fcose from "cytoscape-fcose"
import { useEffect, useMemo, useRef } from "react"

import type { SeedRow } from "@/api/evqa"

cytoscape.use(fcose)

const TYPES: Record<string, { color: string; size: number; name: string }> = {
  paper: { color: "#7c3aed", size: 70, name: "paper" },
  drug: { color: "#16a34a", size: 64, name: "drug" },
  comparator: { color: "#0d9488", size: 56, name: "compared with" },
  patients: { color: "#9333ea", size: 56, name: "patients" },
  measure: { color: "#2563eb", size: 60, name: "measure" },
  dose: { color: "#d97706", size: 44, name: "dose" },
  time: { color: "#ea580c", size: 44, name: "time point" },
  fact: { color: "#64748b", size: 30, name: "fact (value)" },
}

function elements(rows: SeedRow[], title: string): ElementDefinition[] {
  const nodes = new Map<string, ElementDefinition>()
  const edges: ElementDefinition[] = []
  const node = (id: string, label: string, type: string) => {
    if (!nodes.has(id)) nodes.set(id, { data: { id, label, type, color: TYPES[type].color, size: TYPES[type].size } })
    return id
  }
  const edge = (source: string, target: string, label: string) =>
    edges.push({ data: { id: `${source}->${target}`, source, target, label } })
  const first = rows[0]
  if (!first) return []
  const paper = node(`paper:${first.paper}`, `${first.paper}\n${title}`, "paper")
  edge(paper, node(`drug:${first.subject}`, first.subject, "drug"), "tests")
  if (first.comparator) edge(paper, node(`cmp:${first.comparator}`, first.comparator, "comparator"), "against")
  edge(paper, node(`ctx:${first.context}`, first.context, "patients"), "in")
  for (const r of rows) {
    const f = node(r.id, `${r.value} ${r.unit}`, "fact")
    edge(paper, f, "reports")
    edge(f, node(`m:${r.measure}`, r.measure, "measure"), "measures")
    if (r.condition) edge(f, node(`d:${r.condition}`, r.condition, "dose"), "at dose")
    if (r.time) edge(f, node(`t:${r.time}`, r.time, "time"), "at time")
  }
  return [...nodes.values(), ...edges]
}

const STYLE: cytoscape.StylesheetJson = [
  { selector: "node", style: {
    "background-color": "data(color)", width: "data(size)", height: "data(size)", label: "data(label)",
    "font-size": 11, color: "#1e293b", "text-valign": "bottom", "text-margin-y": 5, "text-wrap": "wrap",
    "text-max-width": "140px", "text-background-color": "#ffffff", "text-background-opacity": 0.85,
    "text-background-padding": "2px", "border-width": 3, "border-color": "#ffffff" } },
  { selector: 'node[type = "fact"]', style: { "font-family": "monospace", "font-size": 10 } },
  { selector: 'node[type = "paper"]', style: { "font-weight": "bold", "text-max-width": "220px" } },
  { selector: "edge", style: {
    width: 1.5, "line-color": "#cbd5e1", "target-arrow-color": "#cbd5e1", "target-arrow-shape": "triangle",
    "curve-style": "bezier", "arrow-scale": 0.8 } },
  { selector: ".faded", style: { opacity: 0.12 } },
  { selector: "node.lit", style: { "border-color": "#0f172a", "border-width": 3 } },
  { selector: "edge.lit", style: {
    "line-color": "#475569", "target-arrow-color": "#475569", width: 2.5, label: "data(label)", "font-size": 10,
    "text-rotation": "autorotate", "text-background-color": "#ffffff", "text-background-opacity": 1 } },
]

export function PaperGraph({ rows, title, selected, onSelect }: {
  rows: SeedRow[]; title: string; selected: string; onSelect: (id: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const cy = useRef<Core | null>(null)
  const els = useMemo(() => elements(rows, title), [rows, title])
  const pick = useRef(onSelect)
  useEffect(() => { pick.current = onSelect }, [onSelect])

  useEffect(() => {
    if (!box.current) return
    const c = cytoscape({ container: box.current, elements: els, style: STYLE, wheelSensitivity: 0.3,
      layout: { name: "fcose", animate: false, randomize: true, nodeRepulsion: () => 9000,
        idealEdgeLength: () => 90, nodeSeparation: 80, packComponents: true } as cytoscape.LayoutOptions })
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
    c.elements().not(hood).addClass("faded")
    hood.addClass("lit")
  }, [selected, els])

  const used = [...new Set(els.filter((e) => !e.data.source).map((e) => e.data.type as string))]
  return (
    <div className="space-y-2">
      <div className="relative rounded-md border bg-white">
        <div ref={box} className="h-[640px] w-full" role="img" aria-label={`Knowledge graph of ${rows[0]?.paper ?? "paper"}`} />
        <div className="absolute left-2 top-2 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-800">
          {used.map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span className="inline-block size-3 rounded-full" style={{ background: TYPES[t].color }} />{TYPES[t].name}
            </span>
          ))}
        </div>
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button type="button" onClick={() => cy.current?.fit(undefined, 30)}
            className="h-9 rounded-md border bg-white px-3 text-xs text-slate-800">Fit</button>
          <button type="button" onClick={() => cy.current?.layout({ name: "fcose", animate: true } as cytoscape.LayoutOptions).run()}
            className="h-9 rounded-md border bg-white px-3 text-xs text-slate-800">Re-arrange</button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Drag to move, scroll to zoom. Click a circle (or a table row) to light up
        what it links to; click empty space to clear.</p>
    </div>
  )
}
