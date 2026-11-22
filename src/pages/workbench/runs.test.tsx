/** The Workbench run and evaluation panes render a fixture run: the seven steps, the paper drawer, the scores. */
import { fireEvent, screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { routes } from "@/app/routes"
import { server } from "@/mocks/node"
import { renderRoutes } from "@/test/render"

vi.mock("cytoscape", () => {
  const empty = { empty: () => true, removeClass: () => empty, addClass: () => empty, not: () => empty }
  const cy = () => ({ on: () => {}, destroy: () => {}, elements: () => empty, getElementById: () => empty })
  return { default: Object.assign(cy, { use: () => {} }) }
})

const T = { timeout: 15_000 }
const FIRST = { timeout: 40_000 }   // the first render loads the lazy route
const PAPER = "# Brenoxalin trial\n\nAt week 24, 20 mg lowered HbA1c by 0.57 percentage points.\n"
const quote = "20 mg lowered HbA1c by 0.57 percentage points"
const qs = PAPER.indexOf(quote)
const spec = { qid: "Q-med-01", question: "How much does brenoxalin 20 mg lower HbA1c?", type: "lookup",
  subjects: [{ label: "brenoxalin", synonyms: [], known: false }], comparator: null,
  measure: { label: "HbA1c", synonyms: ["A1C"], known: true }, fixed: { dose: "20 mg" },
  open_points: [{ id: "time_point", question: "Which time point do you mean?", choice: "all", source: "card" }],
  columns: ["time_point"], dialogue: [], locked: true }
const hit = { paper: "P-med-01", sources: ["regex", "terms"], screen: "yes", screen_reason: "Reports HbA1c for brenoxalin.",
  passages: [{ start: qs, end: qs + quote.length, text: quote, kind: "text", columns: ["time_point"], role: "value",
    section: "Results", subjects: ["brenoxalin"] }], details: { regex: { brenoxalin: 3 }, terms: { "glycated hemoglobin": 1 }, agent: [] } }
const row = (over: object) => ({ paper: "P-med-01", subject: "brenoxalin", measure: "HbA1c", time_point: "24 wk",
  dose: "20 mg", patient_group: null, std: { value: "-0.57", unit: "https://w3id.org/evqa/seed#PercentagePoint", decimals: 2 },
  raw: "0.57 percentage points", quote, quote_start: qs, quote_end: qs + quote.length, quote_ok: true, note: "", dropped: null, ...over })
const answer = { qid: "Q-med-01", type: "lookup", columns: ["time_point"], sentence: "Brenoxalin 20 mg lowered HbA1c by 0.57 pp.",
  table: [{ cells: { time_point: "24 wk" }, value: "-0.57", unit: "pp", rows: [0] }], groups: [], not_reported: false }
const fact = (id: string, blame: string, l2: boolean) => ({ id, paper: "P-med-01", l0: true, l1: true, l2, in_answer: blame === "none", blame })
const qscore = (b1: string) => ({ qid: "Q-med-01", type: "lookup", missing_files: [], facts: [fact("R-med-01-02", "none", true), fact("R-med-01-03", b1, false)],
  l0: 1, l1: 1, l2: { recall: 0.5, precision: 1 }, l3: { score: 0.67, exact: false }, advisor: { score: 0.8, checks: 5, mismatches: ["fixed dose"] },
  blame: { L0: 0, find: 0, extract: 1, answer: 0, none: 1 } })
const nrscore = { qid: "Q-med-11", type: "near_miss", answerable: false, missing_files: [], facts: [], l0: null, l1: null,
  l2: { recall: null, precision: null }, l3: { score: 0, exact: false, hallucination: true, near_miss_trap: true },
  advisor: { score: 1, checks: 4, mismatches: [] }, blame: { L0: 0, find: 0, extract: 0, answer: 0, none: 0 } }
const evalOf = (run_id: string, name: string, closed: boolean, b1: string) => ({ run_id, config_name: name, closed_book: closed,
  unknown_questions: [], questions: { "Q-med-01": qscore(b1), "Q-med-11": nrscore },
  totals: { questions: 2, facts: 2, l0: 1, l1: 1, l2_recall: 0.5, l2_precision: 1, l3: 0.67, l3_exact: 0, advisor: 0.9,
    blame: { L0: 0, find: 0, extract: 1, answer: 0, none: 1 },
    not_reported: { questions: 1, accuracy: 0, hallucination: 1, near_miss_trap: 1, near_miss_questions: 1 },
    per_type: { lookup: { questions: 1, l3: 0.67, exact: 0 }, near_miss: { questions: 1, l3: 0, exact: 0, hallucination: 1 } } } })
const run = { run_id: "slice1-aaa", config: { name: "slice1", domain: "medical", closed_book: false, questions: ["Q-med-01", "Q-med-02"] },
  questions: { "Q-med-01": { spec, find: [hit], rows: [row({}), row({ subject: "veloranide", dropped: "other subject" })], answer } },
  events: [{ ts: 1, qid: "Q-med-01", step: "spec", kind: "end", data: { seconds: 0.2, count: 1, llm: { requests: 6, cache_hits: 2 } } },
    { ts: 2, qid: "Q-med-02", step: "spec", kind: "end", data: { llm: { requests: 99 } } }],
  eval: evalOf("slice1-aaa", "slice1", false, "extract") }
const closed = { run_id: "closed-bbb", config: { name: "closed", closed_book: true }, questions: {}, events: [],
  eval: evalOf("closed-bbb", "closed", true, "find") }

// a PaperQA2 baseline run: find + answer text + claims, no structured L2/L3/advisor (null = does not apply)
const bfact = { ...fact("R-med-01-02", "none", false), l2: null }
const bscore = { qid: "Q-med-01", type: "lookup", missing_files: [], facts: [bfact], l0: 1, l1: 1, l1_paper: 1,
  l2: { recall: null, precision: null }, l3: { score: null, exact: false }, advisor: { score: null, checks: 0, mismatches: ["n/a: baseline run"] },
  l3_text: { score: 0.75, exact: false, claims: 1 }, blame: { L0: 0, find: 0, extract: 0, answer: 0, none: 1, unscored: 0 } }
const baseline = { run_id: "practice-pqa-rag-ddd", config: { name: "practice-pqa-rag", domain: "medical", system: "paperqa2-rag",
  questions: ["Q-med-01"] }, events: [],
  questions: { "Q-med-01": { spec: null, answer: null, rows: [], find: [{ ...hit, sources: ["paperqa2"] }],
    answer_text: { qid: "Q-med-01", system: "paperqa2-rag", text: "At week 24, brenoxalin 20 mg lowered HbA1c by 0.57 pp (P-med-01).",
      cannot_answer: false, citations: ["P-med-01"], tokens: { prompt: 900, completion: 100 }, seconds: 4.2 },
    claims: { qid: "Q-med-01", text_sha256: "x", model: "qwen:orch-model",
      claims: [{ value_text: "lowered by 0.57 pp", subject: "brenoxalin", measure: "HbA1c", time_point: "week 24", dose: "20 mg", paper: "P-med-01" }],
      dropped: [{ claim: { value_text: "about half a point" }, why: "no number in the quote" }] } } },
  eval: { run_id: "practice-pqa-rag-ddd", config_name: "practice-pqa-rag", system: "paperqa2-rag", unknown_questions: [],
    questions: { "Q-med-01": bscore },
    totals: { questions: 1, facts: 1, l0: 1, l1: 1, l1_paper: 1, l2_recall: null, l2_precision: null, l3: null, l3_exact: 0,
      advisor: null, l3_text: 0.75, l3_text_exact: 0, blame: { L0: 0, find: 0, extract: 0, answer: 0, none: 1, unscored: 0 },
      per_type: { lookup: { questions: 1, l3: null, exact: 0, l3_text: 0.75 } } } } }

const why = { run_id: "slice1-aaa", qid: "Q-med-01", question: spec.question, type: "lookup", scored: true, score: 0.67,
  exact: false, right: 1, spec_mismatches: ["fixed dose"], facts: [
    { id: "R-med-01-02", paper: "P-med-01", truth: "brenoxalin 20 mg, week 24: -0.57 pp", right: true, blame: "none", lost_at: "",
      why: "Right: the answer shows this fact with the right value.", find: "Find kept this part of P-med-01 (Results).",
      passage: { start: qs, end: qs + quote.length, section: "Results", text: quote }, rows: [{ index: 0,
        row: "brenoxalin, 20 mg, 24 wk: -0.57 pp", quote, quote_ok: true, problems: [], used_by_answer: ["[time_point = 24 wk] -0.57 pp"] }] },
    { id: "R-med-01-03", paper: "P-med-01", truth: "brenoxalin 20 mg, week 12: -0.40 pp", right: false, blame: "extract",
      lost_at: "Extract", why: "Find kept the right part of the paper, but Extract made no row with this value from it.",
      find: "Find kept this part of P-med-01 (Results).", passage: null, rows: [] }] }

function mockApi() {
  server.use(
    http.get("/api/evqa/dataset", () => HttpResponse.json(["medical"])),
    http.get("/api/evqa/dataset/medical", () => HttpResponse.json({ domain: "medical", papers: [], rows: [], check: null })),
    http.get("/api/evqa/files", () => HttpResponse.json([])),
    http.get("/api/evqa/runs", () => HttpResponse.json([
      { run_id: "slice1-aaa", name: "slice1", domain: "medical", closed_book: false, mtime: 2, has_eval: true },
      { run_id: "closed-bbb", name: "closed", domain: "medical", closed_book: true, mtime: 1, has_eval: true },
      { run_id: "practice-pqa-rag-ddd", name: "practice-pqa-rag", domain: "medical", system: "paperqa2-rag", closed_book: false,
        mtime: -1, has_eval: true }])),
    http.get("/api/evqa/runs/practice-pqa-rag-ddd", () => HttpResponse.json(baseline)),
    http.get("/api/evqa/runs/slice1-aaa", () => HttpResponse.json(run)),
    http.get("/api/evqa/runs/closed-bbb", () => HttpResponse.json(closed)),
    http.get("/api/evqa/questions/medical/:qid", () => HttpResponse.json({ qid: "Q-med-01", question: spec.question,
      intent_card: [{ point: "time_point", label: "Time point", ask: "Which time?", answer: "Every time point." }] })),
    http.get("/api/evqa/runs/slice1-aaa/explain/Q-med-01", () => HttpResponse.json(why)),
    http.get("/api/evqa/papers/medical/P-med-01", () => HttpResponse.json({ id: "P-med-01", title: "Brenoxalin trial",
      split: "test", role: "hub", folder: "x", briefs: {}, paper: PAPER, l0: null })),
    http.get("/api/evqa/review/tasks", () => HttpResponse.json([])),     // review.test.tsx covers the queue
  )
}

describe("workbench run and evaluation panes", () => {
  it("shows the seven steps of a question and opens the paper at a quote", async () => {
    mockApi()
    renderRoutes(routes, "/workbench")
    fireEvent.click(await screen.findByRole("tab", { name: "2 · Run" }, FIRST))
    expect(await screen.findByText("Every time point.", undefined, T)).toBeInTheDocument()
    expect(screen.getByText("closed book")).toBeInTheDocument()
    expect(screen.getByText("not known")).toBeInTheDocument()
    expect(screen.getByText("screen: yes")).toBeInTheDocument()
    expect(screen.getByText("Reports HbA1c for brenoxalin.")).toBeInTheDocument()
    expect(screen.getByText("dropped: other subject")).toBeInTheDocument()
    expect(screen.getByText("Brenoxalin 20 mg lowered HbA1c by 0.57 pp.")).toBeInTheDocument()
    expect(screen.getByText(/6 LLM calls \(2 from cache\)/)).toBeInTheDocument()
    expect(screen.getByRole("table", { name: "True facts of Q-med-01" })).toBeInTheDocument()
    expect(screen.getByText("not started")).toBeInTheDocument()   // Q-med-02 has no folder yet

    fireEvent.click(screen.getAllByRole("button", { name: /“20 mg lowered HbA1c/ })[0])
    const article = await screen.findByRole("article", { name: "Paper P-med-01" }, T)
    const marks = Array.from(article.querySelectorAll("mark")).map((m) => m.textContent)
    expect(marks).toEqual([quote])
  }, 60_000)

  it("shows totals, blame and facts, compares two runs, and jumps to the run pane", async () => {
    mockApi()
    renderRoutes(routes, "/workbench")
    fireEvent.click(await screen.findByRole("tab", { name: "3 · Evaluation" }, FIRST))
    const totals = await screen.findByRole("table", { name: "Totals" }, T)
    expect(within(totals).getByText("L2 read (recall)")).toBeInTheDocument()
    expect(screen.getByRole("figure", { name: "Facts lost per step" })).toBeInTheDocument()
    expect(screen.getByText("Advisor: fixed dose")).toBeInTheDocument()
    const facts = screen.getByRole("table", { name: "True facts of Q-med-01" })
    expect(within(facts).getByText("lost at Extract")).toBeInTheDocument()
    const types = screen.getByRole("table", { name: "Scores per question type" })
    expect(within(types).getByText("near_miss")).toBeInTheDocument()
    expect(within(types).getByText("close, but not there")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Not in the papers" })).getByText("used a close but wrong fact"))
      .toBeInTheDocument()
    expect(screen.getAllByText("made up a value").some((el) => el.dataset.variant === "destructive")).toBe(true)
    expect(screen.queryByRole("table", { name: "True facts of Q-med-11" })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Compare with"), { target: { value: "closed-bbb" } })
    expect(await screen.findByText("closed (closed book)", undefined, T)).toBeInTheDocument()
    expect(within(screen.getByRole("table", { name: "True facts of Q-med-01" })).getByText("lost at Find")).toBeInTheDocument()

    fireEvent.click(within(facts).getByRole("button", { name: "R-med-01-03" }))
    expect(await screen.findByText("Every time point.", undefined, T)).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "2 · Run" })).toHaveAttribute("aria-selected", "true")
  }, 60_000)

  it("shows why each true fact of a question is right or wrong behind the 'why' link", async () => {
    mockApi()
    renderRoutes(routes, "/workbench")
    fireEvent.click(await screen.findByRole("tab", { name: "2 · Run" }, FIRST))
    expect(await screen.findByText("Every time point.", undefined, T)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Why: Q-med-02" })).not.toBeInTheDocument()   // not started: no why
    fireEvent.click(screen.getByRole("button", { name: "Why: Q-med-01" }))
    const box = await screen.findByRole("region", { name: "Why: Q-med-01" }, T)
    expect(await within(box).findByText("wrong, lost at Extract", undefined, T)).toBeInTheDocument()
    expect(within(box).getByText("right")).toBeInTheDocument()
    expect(within(box).getByText(/Extract made no row with this value/)).toBeInTheDocument()
    expect(within(box).getByText("Answer used row 0 as: [time_point = 24 wk] -0.57 pp")).toBeInTheDocument()
    expect(within(box).getByText(/1 of 2 true facts shown right/)).toBeInTheDocument()
    fireEvent.click(within(box).getByRole("button", { name: "close" }))
    expect(screen.queryByRole("region", { name: "Why: Q-med-01" })).not.toBeInTheDocument()
  }, 60_000)

  it("shows a baseline run as question, what it read, answer text and claims", async () => {
    mockApi()
    renderRoutes(routes, "/workbench")
    fireEvent.click(await screen.findByRole("tab", { name: "2 · Run" }, FIRST))
    expect(await screen.findByText("Every time point.", undefined, T)).toBeInTheDocument()
    fireEvent.click(screen.getByText("practice-pqa-rag-ddd"))
    expect(await screen.findByText(/lowered HbA1c by 0.57 pp \(P-med-01\)/, undefined, T)).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Step 2: What it read: papers and passages" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: /Spec: what exactly is asked/ })).not.toBeInTheDocument()
    expect(within(screen.getByRole("table", { name: "Claims" })).getByText("lowered by 0.57 pp")).toBeInTheDocument()
    expect(screen.getByText(/no number in the quote/)).toBeInTheDocument()
    expect(screen.getByText("1000 tokens · 4.2 s")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Why: Q-med-01" })).not.toBeInTheDocument()   // 409 for baselines
    const facts = screen.getByRole("table", { name: "True facts of Q-med-01" })
    expect(within(facts).getByLabelText("L2: does not apply")).toBeInTheDocument()
  }, 60_000)

  it("scores a baseline run on L3 text, with the structured scores shown as —", async () => {
    mockApi()
    renderRoutes(routes, "/workbench")
    fireEvent.click(await screen.findByRole("tab", { name: "3 · Evaluation" }, FIRST))
    await screen.findByRole("table", { name: "Totals" }, T)
    fireEvent.change(screen.getByLabelText("Compare with"), { target: { value: "practice-pqa-rag-ddd" } })
    const totals = screen.getByRole("table", { name: "Totals" })
    expect(await within(totals).findByText("paperqa2-rag", undefined, T)).toBeInTheDocument()
    const textRow = within(totals).getByText("L3 text").closest("tr")!
    expect(within(textRow).getByText("0.75")).toBeInTheDocument()
    const l3Row = within(totals).getByText("L3 answer").closest("tr")!
    expect(within(l3Row).getByText("—")).toBeInTheDocument()
  }, 60_000)
})
