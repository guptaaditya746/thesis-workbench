import { describe, expect, it } from "vitest"

import type { RunItem } from "@/api/evqaRuns"

import { newlyDone } from "./sound"

const run = (run_id: string, has_eval: boolean): RunItem =>
  ({ run_id, name: null, domain: null, closed_book: false, mtime: 0, has_eval })

describe("newlyDone", () => {
  it("chimes only for runs that just got their eval", () => {
    const before = new Map([["a", false], ["b", true]])
    const now = [run("a", true), run("b", true), run("c", true), run("d", false)]
    expect(newlyDone(before, now).map((r) => r.run_id)).toEqual(["a", "c"])
  })
})
