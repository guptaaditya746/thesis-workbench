/**
 * The one HTTP layer of the app: every request goes through `request` here (src/api/evqa*.ts build on it), so a change of base URL, auth or error handling happens in one place. Errors become
 * `ApiError` with the HTTP status and FastAPI's `detail`. Writes send JSON bodies, which is what the backend's
 * guard (webapp/guard.py) asks of every write.
 */
import { QueryClient } from "@tanstack/react-query"

export class ApiError extends Error {
  readonly status: number
  readonly path: string
  readonly detail: unknown

  constructor(status: number, path: string, message: string, detail?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.path = path
    this.detail = detail
  }
}

export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404
/** 409: the backend refuses because of the state (a run that exists, a job already running, a frozen proposal). */
export const isConflict = (error: unknown) => error instanceof ApiError && error.status === 409

type Params = Record<string, string | number | boolean | null | undefined>

/** Absolute URL for an API path; empty parameters are left out. VITE_API_BASE prefixes paths. */
export function apiUrl(path: string, params?: Params): string {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? ""
  const url = new URL(base + path, window.location.origin)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "" && value !== false) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/** FastAPI puts the reason in `detail` (a string, or a list of validation errors). */
function describe(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d) => {
        if (typeof d !== "object" || !d || !("msg" in d)) return JSON.stringify(d)
        const loc = "loc" in d && Array.isArray(d.loc) ? (d.loc as unknown[]).filter((p) => p !== "body").join(".") : ""
        return `${loc ? `${loc}: ` : ""}${String((d as { msg: unknown }).msg)}`
      })
      .join("; ")
  }
  return fallback
}

interface RequestOptions {
  params?: Params
  body?: unknown
  signal?: AbortSignal
  accept?: string
}

async function request(method: string, path: string, { params, body, signal, accept = "application/json" }: RequestOptions = {}) {
  const response = await fetch(apiUrl(path, params), {
    method,
    signal,
    headers: body === undefined ? { Accept: accept } : { Accept: accept, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    let detail: unknown = undefined
    try {
      const data: unknown = await response.json()
      detail = typeof data === "object" && data && "detail" in data ? (data as { detail: unknown }).detail : data
    } catch {
      // not JSON: keep the status text
    }
    throw new ApiError(response.status, path, describe(detail, `${response.status} ${response.statusText || "error"}`), detail)
  }
  return response
}

async function json<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
  const response = await request(method, path, options)
  return (await response.json()) as T
}

export const getJson = <T>(path: string, params?: Params, signal?: AbortSignal) => json<T>("GET", path, { params, signal })
export const postJson = <T>(path: string, body: unknown) => json<T>("POST", path, { body })
export const putJson = <T>(path: string, body: unknown) => json<T>("PUT", path, { body })
export async function getText(path: string, params?: Params, signal?: AbortSignal): Promise<string> {
  const response = await request("GET", path, { params, signal, accept: "text/plain" })
  return response.text()
}

/** Retry server and network errors twice; a 4xx is an answer, not a hiccup. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  })
}
