/** The Workbench paper pane's API (/api/evqa/papers, backend/webapp/evqa_papers_api.py). S3: briefs, paper.md, L0. */
import { useQuery } from "@tanstack/react-query"

import { getJson } from "./client"

export type L0Summary = { facts: number; found: number; in_planned_place: number; missing: number; extra: number
  ignored: number }
export type PaperListItem = { id: string; title: string; role: string; split: string; facts: number
  has_brief: boolean; has_paper: boolean; l0: L0Summary | null }
/** start/end are character positions in paper.md counted in Unicode code points (Python string offsets). */
export type Span = { start: number; end: number; raw: string; where: "table" | "text" }
export type FactSpan = Span & { keys: Record<string, boolean>; score: number; ambiguous: boolean; unit_stated: boolean }
export type NearMiss = Span & { why: string }
export type L0Fact = { id: string; value: string; unit: string; unit_text: string; measure: string
  dose: string | null; dose_text: string | null; week: string | null; placement: "table" | "text"; status: "found" | "missing"; in_planned_place: boolean
  spans: FactSpan[]; near: NearMiss[] }
export type OtherNumber = Span & { value: Record<string, unknown>; kind?: string }
export type L0Result = { summary: L0Summary; facts: L0Fact[]; extra: OtherNumber[]; ignored: OtherNumber[]
  stored: boolean; paper_sha256: string }
export type PaperDetail = { id: string; title: string; split: string; role: string; folder: string
  briefs: Record<"idea_sparse.md" | "experimental_log.md", string | null>; paper: string | null; l0: L0Result | null }

const key = (...parts: string[]) => ["evqa", "papers", ...parts]

export const usePaperList = (domain: string) => useQuery({ queryKey: key(domain), enabled: !!domain,
  queryFn: ({ signal }) => getJson<PaperListItem[]>(`/api/evqa/papers/${domain}`, undefined, signal) })
export const usePaper = (domain: string, paper: string) => useQuery({ queryKey: key(domain, paper),
  enabled: !!domain && !!paper,
  queryFn: ({ signal }) => getJson<PaperDetail>(`/api/evqa/papers/${domain}/${paper}`, undefined, signal) })
