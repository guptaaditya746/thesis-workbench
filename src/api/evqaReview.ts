/**
 * The optional human review queue (/api/evqa/review, backend/webapp/evqa_review_api.py, evqa/eval/review.py).
 * An item comes without its automated verdict until this reviewer has labelled it; a submit returns the verdict.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getJson, postJson } from "./client"

export type Choice = { id: string; label: string; help: string }
export type ReviewTask = { task: string; title: string; scope: "domain" | "run"; rubric: string; question: string
  choices: Choice[]; parts: string[] }
export type Evidence = { kind: "table" | "text"; text: string; marks: [number, number][] }
export type ReviewLabel = { reviewer: string; choice: string; parts: string[]; note: string; ts: string; rubric: string }
export type ReviewItem = { id: string; version: string; paper?: string; fact?: string
  show: { claim?: { part: string; value: string }[]; paper?: string; title?: string; evidence?: Evidence[]
    label?: string; conditions?: string; facts?: number }
  label: ReviewLabel | null; automated?: Record<string, unknown>; stratum?: string }
export type ReviewSummary = { task: string; title: string; scope: string; rubric: string; items: number
  reviewed: number; labels: number; reviewers: string[]; double_reviewed: number; disagreements: number
  counts: Record<string, number>; by_automated: Record<string, Record<string, number>>; stale_labels: number
  status: string }
export type LabelIn = { scope: string; item_id: string; item_version: string; reviewer: string; choice: string
  parts: string[]; note: string }

const key = (...parts: string[]) => ["evqa", "review", ...parts]

export const useReviewTasks = () => useQuery({ queryKey: key("tasks"), staleTime: Infinity,
  queryFn: ({ signal }) => getJson<ReviewTask[]>("/api/evqa/review/tasks", undefined, signal) })
export const useReviewSummary = (task: string, scope: string) => useQuery({ queryKey: key(task, scope, "summary"),
  enabled: !!scope, retry: false,
  queryFn: ({ signal }) => getJson<ReviewSummary>(`/api/evqa/review/${task}/summary`, { scope }, signal) })
export const useReviewItems = (task: string, scope: string, reviewer: string) => useQuery({
  queryKey: key(task, scope, "items", reviewer), enabled: !!scope && !!reviewer, retry: false,
  queryFn: ({ signal }) => getJson<ReviewItem[]>(`/api/evqa/review/${task}/items`, { scope, reviewer }, signal) })

export function useAddLabel(task: string, scope: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LabelIn) =>
      postJson<{ saved: ReviewLabel; automated: Record<string, unknown> }>(`/api/evqa/review/${task}/labels`, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key(task, scope) }) },
  })
}
