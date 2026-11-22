/** The Workbench dataset pane renders the seed: checks, papers, rows of the chosen paper, files. */
import { fireEvent, screen } from "@testing-library/react"
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
const row = (id: string, paper: string, value: string) => ({ id, paper, split: "test", subject: "brenoxalin",
  comparator: "placebo", measure: "change in HbA1c from baseline", context: "adults with type 2 diabetes on metformin",
  condition: "10 mg", time: "12 wk", statistic: "mean difference vs comparator", value, unit: "pp", placement: "table" })
const seed = {
  domain: "medical",
  papers: [{ id: "P-med-01", title: "Brenoxalin trial", role: "hub", split: "test", kind: "randomised controlled trial", rows: 1 },
           { id: "P-med-05", title: "Veloranide trial", role: "filler", split: "practice", kind: "randomised controlled trial", rows: 1 }],
  rows: [row("R-med-01-01", "P-med-01", "-0.46"), row("R-med-05-01", "P-med-05", "-0.31")],
  check: { pass: true, shapes: { conforms: true, report: "" }, split_overlap: { count: 0, items: [] },
           name_clashes: { count: 0, mode: "stored", names: [] } },
}

describe("workbench dataset pane", () => {
  it("shows checks, papers and the rows of the chosen paper", async () => {
    server.use(
      http.get("/api/evqa/dataset", () => HttpResponse.json(["medical"])),
      http.get("/api/evqa/dataset/medical", () => HttpResponse.json(seed)),
      http.get("/api/evqa/files", () => HttpResponse.json([{ path: "data/seed/medical/seed.ttl", bytes: 10, made_by: "code", what: "" }])),
    )
    renderRoutes(routes, "/workbench")
    expect(await screen.findByText(/Practice\/test overlap/, undefined, T)).toBeInTheDocument()
    expect(screen.getAllByText("-0.46 pp").length).toBeGreaterThan(0)
    expect(screen.queryByText("-0.31 pp")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /P-med-05/ }))
    expect((await screen.findAllByText("-0.31 pp")).length).toBeGreaterThan(0)
    expect(screen.getByRole("img", { name: "Knowledge graph of P-med-05" })).toBeInTheDocument()
    expect(screen.getByText("seed/medical/seed.ttl")).toBeInTheDocument()
  }, 30_000)
})
