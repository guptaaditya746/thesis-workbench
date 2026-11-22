# Workbench: showing baseline runs (PaperQA2, long context) next to evqa

Status: built 21 Nov 2026 (steps 1–4; step 5 "systems" table not yet). The backend is done: `evqa/baselines`, `evqa/eval/text_answer.py`,
`webapp/evqa_runs_api.py`. The frontend now follows sections 2–4 below; structured scores a baseline lacks
show as "—".

## 1. What the API now sends

| Route | New field | Meaning |
|---|---|---|
| `GET /api/evqa/runs` | `system` | `"evqa"`, `"paperqa2-rag"`, `"paperqa2-agent"` or `"long-context"` |
| `GET /api/evqa/runs/{id}` | `questions[q].answer_text` | baseline: `{qid, system, text, cannot_answer, citations, tokens, seconds}`; evqa runs: `null` |
| same | `questions[q].claims` | after `evqa eval --text`: `{qid, text_sha256, model, claims: [TextClaim], dropped: [{claim, why}]}` |
| same | `eval.system` | present for baseline runs only |
| same | `eval.totals.l3_text`, `l3_text_exact`, `text_not_reported {accuracy, hallucination}` | the answer-text score, for every run that had `evqa eval --text` |
| same | `eval.totals.per_type[t].l3_text`, `eval.intervals.l3_text` | per type; 95% interval |
| same | `eval.questions[q].l3_text {score, exact, claims}` | per question |
| same | `eval.text_eval {version, reader, judge}` | which models read and judged the text |
| `GET .../explain/{qid}` | status 409 for a baseline run | there are no evqa steps to explain |

For a baseline run, `spec`, `rows`, `answer` are `null`/`[]`, and in `eval`: `l3.score`, `advisor.score`,
`l2.*` are `null` (does not apply, not zero). `find` is filled: one hit per paper the system read, its chunks as
passages with exact offsets (so the paper drawer can highlight them). Fact `blame` is `L0`, `find`, `answer` or
`none` after the text eval (`unscored` before it).

`TextClaim`: `{value_text, subject, comparator, measure, time_point, dose, patient_group, paper, quote}`.

## 2. Changes, in order (each is small and on its own)

1. **Types** (`frontend/src/api/evqaRuns.ts`): add `system?: string` to `RunItem`; add `TextAnswer`, `TextClaim`,
   `TextClaims` types; add `answer_text?: TextAnswer | Broken | null` and `claims?: TextClaims | Broken | null` to
   `RunQuestion`; allow `null` for `QuestionScore.l3.score` and `advisor.score`; add `l3_text?` to
   `QuestionScore`, `EvalTotals` (`l3_text`, `l3_text_exact`, `text_not_reported`) and `TypeTotals`; add
   `system?` and `text_eval?` to `RunEval`; add `"unscored"` to `Blame`.
2. **Run picker** (`RunSelect` in `EvalPane.tsx`, run list in `WorkbenchPage.tsx`): a small badge with the system
   name next to each run that is not `evqa`, so PaperQA2 runs are easy to tell apart.
3. **Run pane** (`RunPane.tsx`): when `config.system` is a baseline, replace steps 2–5 (Spec, Find, Extract,
   Answer) with three steps:
   - *Question* (as now).
   - *What it read*: the `find` hits; reuse `FindStep` / `PassageItem` (passages open the paper drawer at the
     chunk). Show the system's own summary (`passage.quote`) under each chunk.
   - *Answer*: `answer_text.text` as plain text, the citations as paper chips (open the drawer), a
     "said it cannot answer" badge from `cannot_answer`, and tokens / seconds.
   - *Claims* (when `claims` is present): a table of kept claims (value, subject, time point, dose, patient
     group, paper) with a tick when the claim matched a gold row (`eval.questions[q].l3_text` per-claim data is in
     `eval_text.json`; add it to the API only if needed), and a collapsed list of dropped claims with `why`.
   Hide the "explain" button for baseline runs (the API answers 409).
4. **Eval pane** (`EvalPane.tsx`):
   - Add `l3_text` ("L3 text: the answer text, scored the same way for every system") to the layer list next to
     `l3`, with its interval; add the `text_not_reported` block next to `NotReportedBlock`; add an `l3_text`
     column to `TypeTable`.
   - `QuestionScores`: show `L3 text` next to `L3`.
   - When comparing two runs and either is a baseline, sort and colour by `l3_text` instead of `l3`, since the
     baseline has no structured `l3`.
   - `BlameChart`: add the `unscored` bucket (grey) for baseline runs scored before `--text`.
5. **Compare view** (optional, later): a "systems" table (rows = evqa and each baseline, columns = L1, L3 text,
   not-reported accuracy, hallucination, tokens per question, seconds per question), the same numbers as
   `evqa compare`.

## 3. Tests (`frontend/src/pages/workbench/*.test.tsx`, mocks in `frontend/src/mocks`)

- A mocked baseline run (`system: "paperqa2-rag"`, `answer_text`, `claims`, `find` hits, `eval` with `l3_text`
  and `null` structured scores): the run pane shows the answer text and claims and no Spec/Extract steps; the eval
  pane shows "—" for L3 and the L3-text number; nothing throws on `null` scores.
- An evqa run with `l3_text` merged: both L3 and L3 text show.

## 4. Build

`frontend/` is the submodule `thesis-workbench`; `dist/` is not committed. After the change run the frontend build
(`frontend/README.md`), commit and push in `frontend/`, then commit the new submodule pointer in this repo.
