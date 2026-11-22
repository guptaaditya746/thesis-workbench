/** The Workbench questions pane: the list, then question, intent card, SPARQL, gold rows and answer. */
import { fireEvent, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { server } from "@/mocks/node"
import { renderWithProviders } from "@/test/render"

import { QuestionsPane } from "./QuestionsPane"

const T = { timeout: 15_000 }
const row = (id: string, condition: string, value: string) => ({ id, paper: "P-med-01", split: "test",
  subject: "brenoxalin", comparator: "placebo", measure: "change in HbA1c from baseline",
  context: "adults with type 2 diabetes on metformin", condition, time: "24 wk",
  statistic: "mean difference vs comparator", value, unit: "pp", placement: "table" })
const card = [{ point: "time_point", label: "time point", ask: "Which time point do you mean?",
  answer: "The last week the trial reports." }]
const list = {
  domain: "medical", frozen: { set_sha256: "4458aa00ca8115cb", problems: [] },
  questions: [
    { qid: "Q-med-01", type: "lookup", split: "test", question: "How much does brenoxalin 20 mg lower HbA1c?", open_points: ["time point"] },
    { qid: "Q-med-03", type: "best", split: "test", question: "Which brenoxalin dose lowers HbA1c the most?", open_points: [] },
  ],
}
const base = { domain: "medical", split: "test", intent_text: "", slots: {}, open_columns: [], rows_without_card: 5, notes: "", rerun_matches: true }
const q1 = { ...base, qid: "Q-med-01", type: "lookup", question: list.questions[0].question, intent_card: card,
  sparql: "SELECT ?r WHERE { ?r a ex:Result }", rows: [row("R-med-02-02", "20 mg", "-0.82")],
  answer: { text: "", columns: [{ key: "time_point", label: "time point" }, { key: "patient_group", label: "patient group" }],
    table: [{ row: "R-med-02-02", paper: "P-med-02", cells: { time_point: "52 wk", patient_group: "on metformin" }, value: "-0.82", unit: "pp" },
      { row: "R-med-04-01", paper: "P-med-04", cells: { time_point: "24 wk", patient_group: "newly diagnosed" }, value: "-0.99", unit: "pp" }] } }
const q3 = { ...base, qid: "Q-med-03", type: "best", question: list.questions[1].question, intent_card: [],
  sparql: "SELECT ?dose WHERE { }", rows: [row("R-med-01-04", "20 mg", "-0.78"), row("R-med-01-06", "40 mg", "-0.91")],
  answer: { text: "", columns: [{ key: "candidate", label: "dose" }, { key: "patient_group", label: "patient group" }],
    table: [{ row: "R-med-01-06", paper: "P-med-01", cells: { candidate: "40 mg", patient_group: "on metformin" }, value: "-0.91", unit: "pp" }],
    split_by: [{ key: "patient_group", label: "patient group" }], own: [], rounding_step: "0.01", higher_is_better: false,
    groups: [
      { cells: { patient_group: "on metformin" }, status: "winner", winner: "40 mg", margin: "0.13", missing: [],
        ranking: [{ candidate: "40 mg", value: "-0.91", unit: "pp", row: "R-med-01-06", cells: {} },
          { candidate: "20 mg", value: "-0.78", unit: "pp", row: "R-med-01-04", cells: {} }] },
      { cells: { patient_group: "newly diagnosed" }, status: "not reported", winner: null, margin: null,
        missing: ["20 mg"], ranking: [{ candidate: "40 mg", value: "-1.16", unit: "pp", row: "R-med-04-02", cells: {} }] },
    ] } }

describe("workbench questions pane", () => {
  it("shows the chosen question with card, query, rows and answer", async () => {
    server.use(
      http.get("/api/evqa/questions/medical", () => HttpResponse.json(list)),
      http.get("/api/evqa/questions/medical/Q-med-01", () => HttpResponse.json(q1)),
      http.get("/api/evqa/questions/medical/Q-med-03", () => HttpResponse.json(q3)),
    )
    renderWithProviders(<QuestionsPane domain="medical" />)
    expect(await screen.findByText("The last week the trial reports.", undefined, T)).toBeInTheDocument()
    expect(screen.getByLabelText("SPARQL query")).toHaveTextContent("SELECT ?r WHERE")
    expect(screen.getAllByText("R-med-02-02").length).toBeGreaterThan(0)
    expect(screen.getByRole("table", { name: "True answer table" })).toHaveTextContent("newly diagnosed")
    expect(screen.getAllByText("-0.82 pp").length).toBeGreaterThan(0)
    expect(screen.getByText(/Without the intent card it would find 5 rows/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Q-med-03/ }))
    expect(await screen.findByText(/ahead by 0.13/, undefined, T)).toBeInTheDocument()
    expect(screen.getByText(/not reported for 20 mg/)).toBeInTheDocument()
  }, 30_000)

  it("filters by type and split and shows why a question is not reported", async () => {
    const nr = { qid: "Q-med-12", type: "near_miss", split: "test", answerable: false, open_points: ["dose"],
      question: "How much does brenoxalin change HbA1c in elderly adults with type 2 diabetes on metformin?" }
    const pr = { qid: "Q-med-p2", type: "list", split: "practice", answerable: true, open_points: [],
      question: "Which studies tested veloranide?" }
    const big = { ...list, questions: [...list.questions, nr, pr] }
    const q12 = { ...base, ...nr, intent_card: [], sparql: "SELECT ?r WHERE { }", rows: [], answerable: false,
      why: "no paper reports brenoxalin on HbA1c in elderly adults; the closest rows are for adults",
      near_rows: [row("R-med-01-04", "20 mg", "-0.78")],
      wording: { template: "How much does brenoxalin change HbA1c in elderly adults?", source: "llm", text: nr.question, attempts: [] },
      answer: { text: "not reported", status: "not_reported", why: "x", columns: [], table: [] } }
    server.use(
      http.get("/api/evqa/questions/medical", () => HttpResponse.json(big)),
      http.get("/api/evqa/questions/medical/Q-med-01", () => HttpResponse.json(q1)),
      http.get("/api/evqa/questions/medical/Q-med-12", () => HttpResponse.json(q12)),
      http.get("/api/evqa/questions/medical/Q-med-p2", () => HttpResponse.json({ ...q1, ...pr })),
    )
    renderWithProviders(<QuestionsPane domain="medical" />)
    expect(await screen.findByText(/Questions \(4 of 4\)/, undefined, T)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Filter by split"), { target: { value: "practice" } })
    expect(screen.getByText(/Questions \(1 of 4\)/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Filter by split"), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText("Filter by type"), { target: { value: "near_miss" } })
    expect(screen.getByText(/Questions \(1 of 4\)/)).toBeInTheDocument()
    expect(await screen.findByText(/closest rows are for adults/, undefined, T)).toBeInTheDocument()
    expect(screen.getAllByText("not reported").length).toBeGreaterThan(0)
    expect(screen.getByText(/Closest real rows/)).toBeInTheDocument()
    expect(screen.getAllByText("R-med-01-04").length).toBeGreaterThan(0)
    expect(screen.getByText(/Code's template/)).toBeInTheDocument()
  }, 30_000)
})
