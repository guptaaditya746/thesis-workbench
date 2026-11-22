import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { server } from "@/mocks/node"

import { ApiError, apiUrl, getJson, isNotFound } from "./client"

describe("API client", () => {
  it("builds absolute URLs and drops empty and false parameters", () => {
    expect(apiUrl("/api/evqa/file", { path: "x", a: undefined, b: "", c: false })).toBe("http://localhost:5173/api/evqa/file?path=x")
  })

  it("reads JSON", async () => {
    server.use(http.get("/api/evqa/dataset", () => HttpResponse.json(["medical"])))
    expect(await getJson<string[]>("/api/evqa/dataset")).toEqual(["medical"])
  })

  it("raises ApiError with FastAPI's detail, the status text otherwise", async () => {
    server.use(
      http.get("/api/evqa/dataset/nope", () => HttpResponse.json({ detail: "no such domain" }, { status: 404 })),
      http.get("/api/evqa/runs", () => new HttpResponse("upstream down", { status: 502, statusText: "Bad Gateway" })),
    )
    const missing = await getJson("/api/evqa/dataset/nope").catch((e: unknown) => e)
    expect(missing).toBeInstanceOf(ApiError)
    expect(missing).toMatchObject({ status: 404, path: "/api/evqa/dataset/nope", message: "no such domain" })
    expect(isNotFound(missing)).toBe(true)
    await expect(getJson("/api/evqa/runs")).rejects.toMatchObject({ status: 502, message: "502 Bad Gateway" })
  })

  it("passes the abort signal through", async () => {
    server.use(http.get("/api/evqa/dataset", () => HttpResponse.json([])))
    const controller = new AbortController()
    controller.abort()
    await expect(getJson("/api/evqa/dataset", undefined, controller.signal)).rejects.toThrow()
  })
})
