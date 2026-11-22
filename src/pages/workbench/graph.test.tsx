/** The Workbench run pane's Graph step: legend, counts, the side panel of a chosen fact, and its quote in the paper. */
import { fireEvent, screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { routes } from "@/app/routes"
import { server } from "@/mocks/node"
import { renderRoutes } from "@/test/render"

// jsdom has no canvas: a stub stands in for Cytoscape (the graph itself is checked in the browser).
vi.mock("cytoscape", () => {
  const empty = { empty: () => true, removeClass: () => empty, addClass: () => empty, not: () => empty }
  const cy = () => ({ on: () => {}, destroy: () => {}, elements: () => empty, getElementById: () => empty })
  return { default: Object.assign(cy, { use: () => {} }) }
})

const T = { timeout: 15_000 }
const FIRST = { timeout: 40_000 }
const PAPER = "# Brenoxalin trial\n\n| 20 mg daily | week 24 | -0.78 |\n"
const at = PAPER.indexOf("-0.78")
const run = { run_id: "closed-bbb", config: { name: "closed", domain: "medical", closed_book: true, questions: ["Q-med-01"] },
  questions: { "Q-med-01": { spec: null, answer: null, find: [], rows: [] } }, events: [], eval: null }
const graph = { run_id: "closed-bbb", qid: "Q-med-01", domain: "medical", type: "lookup", closed_book: true,
  counts: { found: 0, missed: 1, wrong: 0, extra: 1, context: 1 }, truncated: 2,
  elements: {
    nodes: [
      { data: { id: "paper:P-med-01", label: "P-med-01 · Brenoxalin trial", kind: "paper", status: "gold", paper: "P-med-01" } },
      { data: { id: "fact:R-med-01-04", label: "-0.78 pp", kind: "fact", status: "missed", value: "-0.78", unit: "pp",
        paper: "P-med-01", fact: "R-med-01-04", parent: "paper:P-med-01", rows: [], row: null, blame: "find",
        quote: "| 20 mg daily | week 24 | -0.78 |", start: at, end: at + 5, span_from: "seed", dose: "20 mg", week: "24 wk" } },
      { data: { id: "fact:R-med-01-01", label: "-0.46 pp", kind: "fact", status: "context", value: "-0.46", unit: "pp",
        paper: "P-med-01", fact: "R-med-01-01", parent: "paper:P-med-01", rows: [] } },
      { data: { id: "row:0", label: "-1.20 pp", kind: "row", status: "extra", value: "-1.20", unit: "pp", paper: "P-med-01",
        parent: "paper:P-med-01", row: 0, rows: [0], quote: "x", start: 0, end: 1, span_from: "row" } },
      { data: { id: "drug:brenoxalin", label: "brenoxalin", kind: "drug", status: "gold" } },
    ],
    edges: [{ data: { id: "fact:R-med-01-04->drug:brenoxalin", source: "fact:R-med-01-04", target: "drug:brenoxalin",
      label: "drug", status: "gold" } }],
  } }

describe("workbench graph step", () => {
  it("draws the question graph on demand and opens a missed fact in the paper", async () => {
    server.use(
      http.get("/api/evqa/dataset", () => HttpResponse.json(["medical"])),
      http.get("/api/evqa/dataset/medical", () => HttpResponse.json({ domain: "medical", papers: [], rows: [], check: null })),
      http.get("/api/evqa/files", () => HttpResponse.json([])),
      http.get("/api/evqa/runs", () => HttpResponse.json([
        { run_id: "closed-bbb", name: "closed", domain: "medical", closed_book: true, mtime: 1, has_eval: false }])),
      http.get("/api/evqa/runs/closed-bbb", () => HttpResponse.json(run)),
      http.get("/api/evqa/runs/closed-bbb/graph/Q-med-01", () => HttpResponse.json(graph)),
      http.get("/api/evqa/questions/medical/:qid", () => HttpResponse.json({ qid: "Q-med-01", question: "q", intent_card: [] })),
      http.get("/api/evqa/papers/medical/P-med-01", () => HttpResponse.json({ id: "P-med-01", title: "Brenoxalin trial",
        split: "test", role: "hub", folder: "x", briefs: {}, paper: PAPER, l0: null })),
    )
    renderRoutes(routes, "/workbench")
    fireEvent.click(await screen.findByRole("tab", { name: "2 · Run" }, FIRST))
    const step = await screen.findByRole("group", { name: "Step 8: Graph" }, T)
    const details = step as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event("toggle"))
    expect(await screen.findByRole("img", { name: "Answer graph of Q-med-01" }, T)).toBeInTheDocument()
    expect(screen.getByText("gold fact missed")).toBeInTheDocument()
    expect(screen.getByText(/0 found, 1 missed, 1 extra or wrong rows, 1 context facts \(2 more/)).toBeInTheDocument()

    const list = screen.getByRole("list", { name: "Facts and rows of Q-med-01" })
    expect(within(list).getAllByRole("button")).toHaveLength(3)
    fireEvent.click(screen.getByLabelText("Show grey context"))
    expect(within(list).getAllByRole("button")).toHaveLength(2)

    fireEvent.click(within(list).getByRole("button", { name: /R-med-01-04/ }))
    const side = screen.getByLabelText("Chosen node")
    expect(within(side).getByText("lost at Find")).toBeInTheDocument()
    expect(within(side).getByText(/where the paper states it/)).toBeInTheDocument()
    fireEvent.click(within(side).getByRole("button", { name: "Open in paper" }))
    const article = await screen.findByRole("article", { name: "Paper P-med-01" }, T)
    expect(Array.from(article.querySelectorAll("mark")).map((m) => m.textContent)).toEqual(["-0.78"])
  }, 60_000)
})
