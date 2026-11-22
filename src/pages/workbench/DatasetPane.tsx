/**
 * Workbench pane 1: the dataset. Read-only. Papers on the left, the seed rows of the chosen paper in the middle,
 * one knowledge graph of the chosen paper, the S1 checks on top, and the folder tree with file text below.
 */
import { useState } from "react"

import { type SeedCheck, useDatasetFile, useDatasetFiles, useSeed } from "@/api/evqa"
import { CardsSkeleton, ErrorState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { PaperGraph } from "./PaperGraph"

const ROLE: Record<string, string> = {
  hub: "a thing many papers share", series: "one curve split over papers",
  near_miss: "looks right, one part is different", filler: "background paper",
}

function Checks({ check }: { check: SeedCheck | null }) {
  if (!check) return <p className="text-sm text-muted-foreground">No check.json yet: run <code>evqa seed check</code>.</p>
  const items = [
    { ok: check.shapes.conforms, label: "Shapes (SHACL)", value: check.shapes.conforms ? "conform" : "fail" },
    { ok: check.name_clashes.count === 0, label: "Name clashes with MeSH/ChEBI", value: String(check.name_clashes.count) },
    { ok: check.split_overlap.count === 0, label: "Practice/test overlap", value: String(check.split_overlap.count) },
  ]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((c) => (
          <div key={c.label} className={cn("rounded-md border px-3 py-1.5 text-sm",
            c.ok ? "border-emerald-600/40 bg-emerald-600/10" : "border-destructive/50 bg-destructive/10")}>
            <span className="font-medium">{c.ok ? "✓" : "✗"} {c.label}:</span> {c.value}
          </div>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">How each made-up name was checked</summary>
        <table className="mt-2 text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="pr-4">name</th><th className="pr-4">code</th><th className="pr-4">closest real label</th>
            <th className="pr-4">similarity (clash ≥ 85)</th><th>result</th></tr></thead>
          <tbody>{check.name_clashes.names.map((n) => (
            <tr key={n.name}><td className="pr-4 font-mono">{n.name}</td><td className="pr-4 font-mono">{n.code}</td>
              <td className="pr-4">{n.nearest.label} <span className="text-muted-foreground">({n.nearest.source})</span></td>
              <td className="pr-4">{n.nearest.score}</td><td>{n.ok ? "ok" : n.problems.join("; ")}</td></tr>
          ))}</tbody>
        </table>
        <p className="mt-1 text-xs text-muted-foreground">{check.name_clashes.mode}</p>
      </details>
      {check.shapes.report && <pre className="max-h-60 overflow-auto rounded border p-2 text-xs">{check.shapes.report}</pre>}
    </div>
  )
}

function Files() {
  const files = useDatasetFiles()
  const [path, setPath] = useState("")
  const file = useDatasetFile(path)
  if (files.isError) return <ErrorState error={files.error} />
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
      <ul className="space-y-0.5 font-mono text-xs">
        {(files.data ?? []).map((f) => (
          <li key={f.path}>
            <button type="button" onClick={() => setPath(f.path)}
              className={cn("flex min-h-8 w-full items-center justify-between gap-2 rounded px-2 text-left hover:bg-muted",
                path === f.path && "bg-muted font-semibold")}>
              <span className="truncate">{f.path.replace(/^data\//, "")}</span>
              {f.made_by && <Badge variant="outline" className="shrink-0 font-sans">{f.made_by}</Badge>}
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0 space-y-2">
        {!path && <p className="text-sm text-muted-foreground">Pick a file to read it.</p>}
        {file.data && <>
          <p className="text-sm"><span className="font-mono">{file.data.path}</span> — {file.data.what}</p>
          <pre className="max-h-[480px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{file.data.text}</pre>
          {file.data.truncated && <p className="text-xs text-muted-foreground">Cut at 400 kB.</p>}
        </>}
      </div>
    </div>
  )
}

export function DatasetPane({ domain }: { domain: string }) {
  const seed = useSeed(domain)
  const [paper, setPaper] = useState("")
  const [row, setRow] = useState("")
  const papers = seed.data?.papers ?? []
  const current = paper || papers[0]?.id || ""
  if (seed.isPending) return <CardsSkeleton count={2} />
  if (seed.isError) return <ErrorState error={seed.error} />
  const rows = seed.data.rows.filter((r) => r.paper === current)
  const sel = papers.find((p) => p.id === current)
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Checks</h2>
        <Checks check={seed.data.check} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Papers ({papers.length})</h2>
          {papers.map((p) => (
            <button key={p.id} type="button" onClick={() => { setPaper(p.id); setRow("") }}
              className={cn("w-full space-y-1 rounded-md border p-2 text-left text-sm min-h-11",
                p.id === current ? "border-primary bg-primary/5" : "hover:bg-muted")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs">{p.id}</span>
                <Badge variant="secondary">{p.role.replace("_", " ")}</Badge>
                <Badge variant={p.split === "test" ? "outline" : "default"}>{p.split}</Badge>
                <span className="text-xs text-muted-foreground">{p.rows} rows</span>
              </div>
              <div>{p.title}</div>
            </button>
          ))}
        </div>
        <div className="min-w-0 space-y-3">
          {sel && <p className="text-sm"><span className="font-mono">{sel.id}</span> is a <b>{sel.role.replace("_", " ")}</b> paper
            ({ROLE[sel.role]}), {sel.kind}, in the <b>{sel.split}</b> split. Click a row to light it up in the graph below.</p>}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>{["row", "subject", "vs", "measure", "who", "dose", "time", "value", "where"].map((h) =>
                  <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setRow(r.id === row ? "" : r.id)}
                    className={cn("cursor-pointer border-t hover:bg-muted/50", r.id === row && "bg-primary/10")}>
                    <td className="px-2 py-1 font-mono text-xs">
                      <button type="button" className="underline-offset-2 hover:underline"
                        onClick={(e) => { e.stopPropagation(); setRow(r.id === row ? "" : r.id) }}>{r.id}</button>
                    </td>
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
          <p className="text-xs text-muted-foreground">
            Values are {rows[0]?.statistic ?? "differences"}; "where" says if the paper must state it in a table or a sentence.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Graph of {current}</h2>
        <PaperGraph rows={rows} title={sel?.title ?? ""} selected={row} onSelect={setRow} />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">What is in the folder</h2>
        <Files />
      </section>
    </div>
  )
}
