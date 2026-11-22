/** The Workbench's API (/api/evqa, backend/webapp/evqa_api.py). S1: the dataset pane. */
import { useQuery } from "@tanstack/react-query"

import { getJson } from "./client"

export type SeedPaper = { id: string; title: string; role: string; split: string; kind: string; rows: number }
export type SeedRow = {
  id: string; paper: string; split: string; subject: string; comparator: string | null; measure: string
  context: string; condition: string | null; time: string | null; statistic: string; value: string; unit: string
  placement: string
}
export type NameCheck = { name: string; code: string; ok: boolean; problems: string[]; closest_own: number
  nearest: { label: string; source: string; score: number } }
export type SeedCheck = {
  pass: boolean
  shapes: { conforms: boolean; report: string }
  name_clashes: { count: number; mode: string; names: NameCheck[] }
  split_overlap: { count: number; items: string[] }
}
export type SeedOverview = { domain: string; papers: SeedPaper[]; rows: SeedRow[]; check: SeedCheck | null }
export type DatasetFile = { path: string; bytes: number; made_by: string; what: string }
export type FileText = DatasetFile & { text: string; truncated: boolean }

const key = (...parts: string[]) => ["evqa", ...parts]

export const useDomains = () => useQuery({ queryKey: key("domains"), queryFn: ({ signal }) =>
  getJson<string[]>("/api/evqa/dataset", undefined, signal) })
export const useSeed = (domain: string) => useQuery({ queryKey: key("seed", domain), enabled: !!domain,
  queryFn: ({ signal }) => getJson<SeedOverview>(`/api/evqa/dataset/${domain}`, undefined, signal) })
export const useDatasetFiles = () => useQuery({ queryKey: key("files"), queryFn: ({ signal }) =>
  getJson<DatasetFile[]>("/api/evqa/files", undefined, signal) })
export const useDatasetFile = (path: string) => useQuery({ queryKey: key("file", path), enabled: !!path,
  queryFn: ({ signal }) => getJson<FileText>("/api/evqa/file", { path }, signal) })
