/** The optional review queue: awaiting before labels, verdict hidden until saved, coverage after. */
import { fireEvent, screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { routes } from "@/app/routes"
import { server } from "@/mocks/node"
import { renderRoutes } from "@/test/render"

const T = { timeout: 15_000 }
const FIRST = { timeout: 40_000 }
const task = { task: "fidelity", title: "Paper fidelity", scope: "domain", rubric: "fidelity-v1-draft",
  question: "Does the paper text support this complete claim?",
  choices: [{ id: "supported", label: "Supported", help: "all there" }, { id: "partly", label: "Partly supported", help: "some" },
    { id: "unsupported", label: "Unsupported", help: "no" }, { id: "cant_tell", label: "Can't tell", help: "?" }],
  parts: ["dose", "time"] }
const table = "Table 2: Body weight (kg)\n| Dose | Week | Mean difference |\n|---|---|---|\n| 25 mg | Week 24 | -1.0 |"
const at = table.indexOf("-1.0")
const item = { id: "fidelity:medical:R-1", version: "v1", paper: "P-med-17", fact: "R-1",
  show: { claim: [{ part: "drug", value: "Ordenvik" }, { part: "dose", value: "25 mg" }], paper: "P-med-17", title: "t",
    evidence: [{ kind: "table", text: table, marks: [[at, at + 4]] }] }, label: null }
const evalJson = { run_id: "practice-a", domain: "medical", config_name: "practice", closed_book: false, unknown_questions: [],
  questions: {}, totals: { questions: 0, facts: 0, l0: null, l1: null, l2_recall: null, l2_precision: null, l3: null,
    advisor: null, blame: { L0: 0, find: 0, extract: 0, answer: 0, none: 0 } } }

function mockApi() {
  const saved: Record<string, unknown>[] = []
  const summary = () => ({ task: "fidelity", title: "Paper fidelity", scope: "medical", rubric: "fidelity-v1-draft", items: 1,
    reviewed: saved.length ? 1 : 0, labels: saved.length, reviewers: saved.length ? ["ann"] : [], double_reviewed: 0,
    disagreements: 0, counts: { supported: saved.length, partly: 0, unsupported: 0, cant_tell: 0 }, by_automated: {},
    stale_labels: 0, status: saved.length ? "1 of 1 reviewed" : "awaiting optional review" })
  server.use(
    http.get("/api/evqa/dataset", () => HttpResponse.json(["medical"])),
    http.get("/api/evqa/dataset/medical", () => HttpResponse.json({ domain: "medical", papers: [], rows: [], check: null })),
    http.get("/api/evqa/files", () => HttpResponse.json([])),
    http.get("/api/evqa/runs", () => HttpResponse.json([
      { run_id: "practice-a", name: "practice", domain: "medical", closed_book: false, mtime: 1, has_eval: true }])),
    http.get("/api/evqa/runs/practice-a", () => HttpResponse.json({ run_id: "practice-a", config: {}, questions: {},
      events: [], eval: evalJson })),
    http.get("/api/evqa/review/tasks", () => HttpResponse.json([task])),
    http.get("/api/evqa/review/fidelity/summary", () => HttpResponse.json(summary())),
    http.get("/api/evqa/review/fidelity/items", () => HttpResponse.json([saved.length
      ? { ...item, label: { reviewer: "ann", choice: "supported", parts: [], note: "", ts: "x", rubric: "r" },
        automated: { l0: "found", l0_in_planned_place: true, l0_ambiguous: true, writer: "ok", why_sampled: ["L0 match is ambiguous"] } }
      : item])),
    http.post("/api/evqa/review/fidelity/labels", async ({ request }) => {
      const body = await request.json() as Record<string, unknown>
      saved.push(body)
      return HttpResponse.json({ saved: body, automated: { l0: "found", l0_in_planned_place: true, l0_ambiguous: true,
        writer: "ok", why_sampled: ["L0 match is ambiguous"] } })
    }),
  )
  return saved
}

describe("optional human review", () => {
  it("labels one fidelity item, then shows the verdict and the coverage", async () => {
    try { localStorage.clear() } catch { /* no storage */ }
    const saved = mockApi()
    renderRoutes(routes, "/workbench")
    fireEvent.click(await screen.findByRole("tab", { name: "3 · Evaluation" }, FIRST))
    const block = await screen.findByRole("region", { name: "Human review" }, T)
    expect(await within(block).findByText("awaiting optional review", undefined, T)).toBeInTheDocument()
    fireEvent.click(within(block).getByRole("button", { name: "Start review" }))

    fireEvent.change(await screen.findByLabelText("Reviewer name", undefined, T), { target: { value: "ann" } })
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    const card = await screen.findByRole("region", { name: "Review item" }, T)
    expect(within(card).getByText("Ordenvik")).toBeInTheDocument()
    expect(Array.from(card.querySelectorAll("mark")).map((m) => m.textContent)).toEqual(["-1.0"])
    expect(within(card).getByText("Mean difference")).toBeInTheDocument()            // header row kept
    expect(screen.queryByText(/automatic checks said/)).not.toBeInTheDocument()     // hidden before the label

    fireEvent.click(within(card).getByRole("button", { name: /Partly supported/ }))
    fireEvent.click(within(card).getByRole("button", { name: "dose" }))
    fireEvent.click(within(card).getByRole("button", { name: /^Supported/ }))
    fireEvent.click(within(card).getByRole("button", { name: "Save answer" }))
    expect(await screen.findByText(/automatic checks said/, undefined, T)).toBeInTheDocument()
    expect(screen.getByText(/matched ambiguously: yes/)).toBeInTheDocument()
    expect(saved).toEqual([expect.objectContaining({ reviewer: "ann", choice: "supported", parts: [], item_version: "v1" })])

    fireEvent.click(screen.getByRole("button", { name: "Next item" }))
    expect(await screen.findByText(/You have labelled 1 of 1 items/, undefined, T)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "← Back to scores" }))
    const after = await screen.findByRole("region", { name: "Human review" }, T)
    expect(await within(after).findByText("1 of 1 reviewed", undefined, T)).toBeInTheDocument()
    expect(within(after).getByRole("button", { name: "Continue review" })).toBeInTheDocument()
  }, 60_000)
})
