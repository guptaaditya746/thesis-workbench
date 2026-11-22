/** The Workbench: 1 Dataset · 2 Run · 3 Evaluation (mockup https://claude.ai/artifact/7rXgofLwWtzYNfgbqtvdMo). */
import { useState } from "react"

import { useDomains } from "@/api/evqa"
import { PageHeader } from "@/components/layout/PageHeader"
import { ErrorState } from "@/components/states"
import { cn } from "@/lib/utils"

import { DatasetPane } from "./DatasetPane"
import { EvalPane } from "./EvalPane"
import { PaperPane } from "./PaperPane"
import { QuestionsPane } from "./QuestionsPane"
import { RunPane } from "./RunPane"

const PANES = [
  { id: "dataset", label: "1 · Dataset", ready: true },
  { id: "questions", label: "1b · Questions", ready: true },
  { id: "paper", label: "1c · Papers", ready: true },
  { id: "run", label: "2 · Run", ready: true },
  { id: "eval", label: "3 · Evaluation", ready: true },
] as const

export default function WorkbenchPage() {
  const domains = useDomains()
  const [pane, setPane] = useState<string>("dataset")
  const [domain, setDomain] = useState("")
  const [runId, setRunId] = useState("")
  const [qid, setQid] = useState("")
  const pick = (r: string, q: string) => { setRunId(r); setQid(q) }
  const all = domains.data ?? []
  const current = domain || all[0] || ""
  return (
    <div className="space-y-4">
      <PageHeader title="Workbench" description="Made-up papers with a known truth: the seed graph, the run, the layered evaluation." />
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Workbench panes">
        {PANES.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pane === p.id} disabled={!p.ready}
            onClick={() => setPane(p.id)}
            className={cn("min-h-11 rounded-md border px-4 text-sm disabled:opacity-50",
              pane === p.id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted")}>
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          {all.length > 1 && (
            <label>Domain{" "}
              <select className="rounded border bg-background p-2" value={current}
                onChange={(e) => setDomain(e.target.value)}>
                {all.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>
      {domains.isError && <ErrorState error={domains.error} />}
      {pane === "dataset" && current && <DatasetPane domain={current} />}
      {pane === "questions" && current && <QuestionsPane domain={current} />}
      {pane === "paper" && current && <PaperPane domain={current} />}
      {pane === "run" && <RunPane domain={current} runId={runId} qid={qid} onPick={pick} />}
      {pane === "eval" && <EvalPane domain={current} runId={runId} onRun={(r) => pick(r, "")}
        onOpen={(r, q) => { pick(r, q); setPane("run") }} />}
      {domains.data?.length === 0 && <p className="text-sm">No seed yet: run <code>evqa seed build medical</code>.</p>}
    </div>
  )
}
