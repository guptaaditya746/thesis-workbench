/**
 * The Workbench run and evaluation panes' API (/api/evqa/runs, backend/webapp/evqa_runs_api.py). S4, S5.
 * Files are read as raw JSON by the backend, never validated: a half-written run has missing (null / []) parts,
 * and a broken file comes back as `{ _error }`. Shapes follow backend/evqa/contracts.py and evqa/eval/prism.py.
 */
import { useQuery } from "@tanstack/react-query"

import { getJson } from "./client"

/** system: "evqa" or a baseline (evqa/baselines): "paperqa2-rag", "paperqa2-agent", "long-context". */
export type RunItem = { run_id: string; name: string | null; domain: string | null; system?: string
  closed_book: boolean; mtime: number; has_eval: boolean }
export const isBaseline = (system: unknown): boolean => typeof system === "string" && system !== "" && system !== "evqa"

export type Name = { label: string; synonyms?: string[]; definition?: string; known?: boolean }
export type OpenPoint = { id: string; question: string; choice: string; source?: string }
export type Spec = {
  qid: string; question: string; type: "lookup" | "best"; subjects: Name[]; comparator?: Name | null; measure: Name
  fixed?: Record<string, string>; open_points?: OpenPoint[]; columns?: string[]; higher_is_better?: boolean | null
  best_by?: string | null; dialogue?: Record<string, string>[]; locked?: boolean; sha256?: string
}
/** start/end: character offsets in paper.md (Unicode code points). */
export type Passage = { start: number; end: number; text: string; kind?: "table" | "text"; columns?: string[]
  role?: "value" | "context"; subjects?: string[]; section?: string; quote?: string }
export type FindHit = { paper: string; sources?: string[]; screen?: "yes" | "no" | "unsure"; screen_reason?: string
  passages?: Passage[]; details?: Record<string, unknown> }
export type StdValue = { value: string; unit: string; decimals: number; sign_basis?: string; low?: string | null
  high?: string | null }
export type Row = { paper: string; subject: string; comparator?: string | null; measure: string
  patient_group?: string | null; dose?: string | null; time_point?: string | null; statistic?: string
  std?: StdValue | null; raw: string; quote: string; quote_start?: number; quote_end?: number; quote_ok?: boolean
  unit_text?: string; also?: string[]; note?: string; dropped?: string | null }
export type AnswerRow = { cells: Record<string, string>; value: string; unit: string; rows?: number[] }
export type Ranked = { candidate: string; value: string; unit: string; cells?: Record<string, string>; rows?: number[] }
export type BestGroup = { group?: Record<string, string>; winner?: string | null; margin?: string | null
  status?: "winner" | "tie" | "not_reported"; note?: string; ranking?: Ranked[]; missing?: string[] }
export type Answer = { qid: string; type: string; columns?: string[]; table?: AnswerRow[]
  groups?: BestGroup[]; sentence?: string; not_reported?: boolean }
export type RunEvent = { ts: number; qid?: string | null; step: string; kind: string; data?: Record<string, unknown> }

export type Broken = { _error: string }
/** A baseline run's answer_text.json and claims.json (backend/evqa/contracts.py TextAnswer, TextClaims). */
export type TextAnswer = { qid: string; system: string; text: string; cannot_answer?: boolean; citations?: string[]
  tokens?: Record<string, number>; seconds?: number; error?: string | null }
export type TextClaim = { value_text: string; subject?: string; comparator?: string; measure?: string
  time_point?: string; dose?: string; patient_group?: string; paper?: string; quote?: string }
export type TextClaims = { qid: string; text_sha256: string; model: string; claims: TextClaim[]
  dropped: { claim: TextClaim; why: string }[] }
export type RunQuestion = { spec: Spec | Broken | null; answer: Answer | Broken | null
  find: (FindHit | Broken)[]; rows: (Row | Broken)[]
  answer_text?: TextAnswer | Broken | null; claims?: TextClaims | Broken | null }

/** unscored: a baseline fact Find found, before `evqa eval --text` says whether the answer states it. */
export type Blame = "L0" | "find" | "extract" | "answer" | "none" | "unscored"
export type FactScore = { id: string; paper: string; l0: boolean; l1: boolean; l2: boolean | null; name_ok?: boolean
  quote_ok?: boolean; rows?: number[]; in_answer: boolean; blame: Blame }
/** null = does not apply (a question the papers cannot answer has no true facts). */
export type QuestionScore = {
  qid: string; type: string; answerable?: boolean; missing_files?: string[]; facts: FactScore[]
  l0: number | null; l1: number | null
  l2: { recall: number | null; precision: number | null; name_ok?: number | null; rows?: number; dropped?: number
    matched_rows?: number }
  l3: { recall?: number; precision?: number; exact?: boolean; score: number | null; answer_rows?: number; gold_rows?: number
    groups?: { cells: Record<string, string>; gold_status: string; gold_winner?: string | null; found: boolean
      status?: string; winner?: string | null; ok: boolean }[]
    said_not_reported?: boolean | null; hallucination?: boolean | null; near_miss_trap?: boolean | null }
  advisor: { score: number | null; checks: number; mismatches: string[] }
  /** the answer text, scored the same way for every system (`evqa eval --text`); claims = how many were kept */
  l3_text?: { score: number | null; exact?: boolean; claims?: number }
  blame: Record<Blame, number>
}
export type TypeTotals = { questions: number; l3: number | null; exact: number; advisor?: number | null
  l1?: number | null; l2_recall?: number | null; said_not_reported?: number; hallucination?: number | null
  near_miss_trap?: number | null; l3_text?: number | null }
export type NotReportedTotals = { questions: number; accuracy: number | null; hallucination: number | null
  near_miss_trap: number | null; near_miss_questions?: number }
export type EvalTotals = { questions: number; answerable?: number; facts: number; l0: number | null
  l1: number | null; l2_recall: number | null; l2_precision: number | null; l2_name_ok?: number | null
  l3: number | null; l3_exact?: number; advisor: number | null; blame: Record<Blame, number>
  not_reported?: NotReportedTotals; per_type?: Record<string, TypeTotals>
  l1_paper?: number | null; l2_complete?: number | null; l2_complete_upper?: number | null
  l0_missing_facts?: number; counts?: Record<string, unknown>
  l3_text?: number | null; l3_text_exact?: number
  text_not_reported?: { questions: number; accuracy: number | null; hallucination: number | null } }
export type RunEval = { run_id: string; domain?: string; config_name?: string; closed_book?: boolean
  system?: string; text_eval?: { version?: string; reader?: string; judge?: string }
  intervals?: Record<string, unknown>
  unknown_questions?: string[]; totals: EvalTotals; questions: Record<string, QuestionScore> }

export type RunDetail = { run_id: string; config: Record<string, unknown>; questions: Record<string, RunQuestion>
  events: RunEvent[]; eval: RunEval | Broken | null }

export const isBroken = (x: unknown): x is Broken =>
  typeof x === "object" && x !== null && "_error" in x
export const ok = <T>(x: T | Broken | null | undefined): T | null => (x == null || isBroken(x) ? null : x)

const key = (...parts: string[]) => ["evqa", "runs", ...parts]

export const useRuns = () => useQuery({ queryKey: key(),
  queryFn: ({ signal }) => getJson<RunItem[]>("/api/evqa/runs", undefined, signal) })
export const useRun = (runId: string) => useQuery({ queryKey: key(runId), enabled: !!runId,
  queryFn: ({ signal }) => getJson<RunDetail>(`/api/evqa/runs/${runId}`, undefined, signal) })

/** GET /api/evqa/runs/{run_id}/graph/{qid} (backend/evqa/eval/qgraph.py): the question's rows drawn inside its piece
 * of the seed graph, as Cytoscape elements. Status: found (green), missed (red), wrong / extra (orange), context
 * (grey); entity nodes are "gold" when a gold fact uses them, "extra" when only run rows name them. */
export type GraphStatus = "found" | "missed" | "wrong" | "extra" | "context" | "gold"
export type GraphKind = "fact" | "row" | "paper" | "drug" | "comparator" | "group" | "dose" | "time" | "measure"
export type GraphNodeData = { id: string; label: string; kind: GraphKind; status: GraphStatus; parent?: string
  value?: string; unit?: string; paper?: string; fact?: string | null; row?: number | null; rows?: number[]
  quote?: string; start?: number; end?: number; span_from?: "row" | "seed"; blame?: Blame; in_answer?: boolean
  subject?: string | null; comparator?: string | null; measure?: string | null; group?: string | null
  dose?: string | null; week?: string | null; note?: string; names?: Record<string, Record<string, boolean> | null> }
export type GraphEdgeData = { id: string; source: string; target: string; label: string; status: string }
export type QuestionGraph = { run_id: string; qid: string; domain: string; type?: string; closed_book?: boolean
  counts: Record<"found" | "missed" | "wrong" | "extra" | "context", number>; truncated: number
  elements: { nodes: { data: GraphNodeData }[]; edges: { data: GraphEdgeData }[] } }

export const useRunGraph = (runId: string, qid: string, enabled = true) => useQuery({ queryKey: key(runId, "graph", qid),
  enabled: enabled && !!runId && !!qid,
  queryFn: ({ signal }) => getJson<QuestionGraph>(`/api/evqa/runs/${runId}/graph/${qid}`, undefined, signal) })

/** GET /api/evqa/runs/{run_id}/explain/{qid} (backend/evqa/explain.py): why each true fact is right or wrong, in plain
 * words. 403 for runs that are not practice runs (their per-question outputs stay closed). */
export type ExplainRow = { index: number; row: string; quote: string; quote_ok?: boolean; problems?: string[]
  used_by_answer?: string[] }
export type ExplainFact = { id: string; paper: string; truth: string; right: boolean; blame: Blame | string
  lost_at: string; why: string; find: string; passage: { start: number; end: number; section?: string | null; text: string } | null
  in_paper?: string | null; rows: ExplainRow[]; near_rows?: ExplainRow[] }
export type Explain = { run_id: string; qid: string; question?: string | null; type?: string | null; scored: boolean
  score?: number | null; exact?: boolean | null; answer_sentence?: string | null; facts: ExplainFact[]; right: number
  note?: string; spec_mismatches?: string[]; not_reported?: { right: boolean; why: string; rows: ExplainRow[] } }

export const useExplain = (runId: string, qid: string, enabled = true) => useQuery({ queryKey: key(runId, "explain", qid),
  enabled: enabled && !!runId && !!qid, retry: false,
  queryFn: ({ signal }) => getJson<Explain>(`/api/evqa/runs/${runId}/explain/${qid}`, undefined, signal) })
