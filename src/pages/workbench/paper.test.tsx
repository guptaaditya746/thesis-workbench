/** The Workbench paper pane: briefs before the paper exists; the paper with seed facts and added numbers marked. */
import { fireEvent, screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { server } from "@/mocks/node"
import { renderWithProviders } from "@/test/render"

import { PaperPane } from "./PaperPane"

const T = { timeout: 15_000 }
const PAPER = [
  "# Brenoxalin trial",
  "",
  "At week 24, 10 mg lowered HbA1c by 0.57 percentage points; weight fell by 2.4 kg.",
  "",
  "| Dose | Week | HbA1c (pp) |",
  "|---|---|---|",
  "| 10 mg | 12 | −0.46 |",
  "",
].join("\n")
const at = (s: string) => ({ start: PAPER.indexOf(s), end: PAPER.indexOf(s) + Array.from(s).length, raw: s })
const fact = (id: string, value: string, raw: string, placement: "table" | "text", where: "table" | "text") => ({
  id, value, unit: "https://w3id.org/evqa/seed#PercentagePoint", unit_text: "percentage points",
  measure: "change in HbA1c from baseline", dose: "10", dose_text: "10 mg", week: "12", placement,
  status: "found", in_planned_place: placement === where, near: [],
  spans: [{ ...at(raw), where, keys: {}, score: 3, ambiguous: false, unit_stated: true }],
})
const l0 = {
  summary: { facts: 3, found: 2, in_planned_place: 2, missing: 1, extra: 1, ignored: 2 },
  facts: [
    fact("R-med-01-02", "-0.57", "0.57", "text", "text"),
    fact("R-med-01-01", "-0.46", "−0.46", "table", "table"),
    { ...fact("R-med-01-03", "-0.72", "x", "table", "table"), status: "missing", in_planned_place: false, spans: [] },
  ],
  extra: [{ ...at("2.4"), where: "text", value: {} }],
  ignored: [{ ...at("24"), where: "text", value: {}, kind: "time" }],
  stored: true, paper_sha256: "x",
}
const list = [
  { id: "P-med-01", title: "Brenoxalin trial", role: "hub", split: "test", facts: 3, has_brief: true, has_paper: true,
    l0: l0.summary },
  { id: "P-med-05", title: "Veloranide trial", role: "filler", split: "practice", facts: 8, has_brief: true,
    has_paper: false, l0: null },
]
const briefs = { "idea_sparse.md": "# Veloranide trial\n\n## Problem Statement\nNot known.",
  "experimental_log.md": "# Experimental Log\n\n| Row | Value |\n|---|---|\n| R-med-05-01 | -0.31 percentage points |" }

describe("workbench paper pane", () => {
  it("marks seed facts and added numbers, lists missing facts, shows briefs before a paper exists", async () => {
    server.use(
      http.get("/api/evqa/papers/medical", () => HttpResponse.json(list)),
      http.get("/api/evqa/papers/medical/P-med-01", () => HttpResponse.json({ id: "P-med-01", title: "Brenoxalin trial",
        split: "test", role: "hub", folder: "data/dataset/medical/P-med-01", briefs, paper: PAPER, l0 })),
      http.get("/api/evqa/papers/medical/P-med-05", () => HttpResponse.json({ id: "P-med-05", title: "Veloranide trial",
        split: "practice", role: "filler", folder: "data/dataset/medical/P-med-05", briefs, paper: null, l0: null })),
    )
    const { container } = renderWithProviders(<PaperPane domain="medical" />)
    const article = await screen.findByRole("article", { name: "Paper P-med-01" }, T)
    // the table is rendered as a table, and the seed value in it is marked green
    expect(within(article).getByRole("table")).toBeInTheDocument()
    const marks = Array.from(container.querySelectorAll("article mark")).map((m) => [m.textContent, m.getAttribute("data-kind")])
    expect(marks).toEqual([["0.57", "fact"], ["2.4", "extra"], ["−0.46", "fact"]])
    const side = screen.getByRole("complementary", { name: "Seed facts" })
    expect(within(side).getByText("Missing (1)")).toBeInTheDocument()
    expect(within(side).getByText("Found in the planned place (2)")).toBeInTheDocument()
    expect(within(side).getByText("Numbers the writer added (1)")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /P-med-05/ }))
    expect(await screen.findByText("Paper not written yet.", undefined, T)).toBeInTheDocument()
    expect(screen.getByText("idea_sparse.md")).toBeInTheDocument()
    expect(screen.getByText("-0.31 percentage points")).toBeInTheDocument()
  }, 30_000)
})
