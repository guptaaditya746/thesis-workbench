/** The Workbench questions pane API (/api/evqa/questions, backend/webapp/evqa_questions_api.py). S2. */
import { useQuery } from "@tanstack/react-query"

import type { SeedRow } from "./evqa"
import { getJson } from "./client"

export type CardEntry = { point: string; label: string; ask: string; answer: string }
/** type: lookup | effect | best | trend | list | conflict (answerable) or absent | near_miss | out_of_scope ("not reported"). */
export type QuestionItem = {
  qid: string; type: string; split: string; question: string; open_points: string[]; answerable?: boolean
}
export type QuestionList = {
  domain: string
  questions: QuestionItem[]
  counts?: Record<string, Record<string, number>>
  frozen: { set_sha256: string | null; problems: string[] }
  report?: Record<string, unknown> | null
}
export type Column = { key: string; label: string }
export type GoldRow = {
  row: string; paper: string; cells: Record<string, string>; value: string; unit: string; verdict?: string
}
export type TrendSeries = {
  cells: Record<string, string>; direction: string
  points: { at: string; value: string; unit: string; row: string }[]
}
export type ConflictGroup = {
  cells: Record<string, string>; status: "conflict" | "agree" | "single"; spread: string
  rows: { row: string; paper: string; value: string; unit: string }[]
}
export type ListedPaper = { paper: string; title: string; rows: string[] }
export type Ranked = { candidate: string; row: string; value: string; unit: string; cells: Record<string, string> }
export type BestGroup = {
  cells: Record<string, string>; status: "winner" | "tie" | "not reported"
  winner: string | null; margin: string | null; ranking: Ranked[]; missing: string[]
}
/** Gold as a table: one column per open point ("all" answers), then the value. Best questions add groups. */
export type GoldAnswer = {
  text: string; columns: Column[]; table: GoldRow[]
  split_by?: Column[]; own?: Column[]; groups?: BestGroup[] | ConflictGroup[]; rounding_step?: string
  higher_is_better?: boolean
  status?: "not_reported"; why?: string            // not-reported types
  comparator?: string                              // effect
  axis?: Column; series?: TrendSeries[]            // trend
  papers?: ListedPaper[]                           // list
  conflict?: boolean                               // conflict
}
export type Wording = {
  template: string; source: "llm" | "template"; text: string
  attempts: { attempt: number; text: string; problems: string[] }[]
}
export type QuestionDetail = {
  qid: string; domain: string; split: string; type: string; question: string
  intent_card: CardEntry[]; intent_text: string
  sparql: string; slots: Record<string, unknown>; rows: SeedRow[]; answer: GoldAnswer
  open_columns: string[]; rows_without_card: number; notes: string; rerun_matches: boolean
  answerable?: boolean; why?: string | null; near_rows?: SeedRow[]; wording?: Wording | null
  absence_check?: { terms: string[]; papers_checked: number; seed_checked: boolean; hits: number } | null
}

const key = (...parts: string[]) => ["evqa", "questions", ...parts]

export const useQuestions = (domain: string) => useQuery({ queryKey: key(domain), enabled: !!domain,
  queryFn: ({ signal }) => getJson<QuestionList>(`/api/evqa/questions/${domain}`, undefined, signal) })
export const useQuestion = (domain: string, qid: string) => useQuery({ queryKey: key(domain, qid),
  enabled: !!domain && !!qid,
  queryFn: ({ signal }) => getJson<QuestionDetail>(`/api/evqa/questions/${domain}/${qid}`, undefined, signal) })
