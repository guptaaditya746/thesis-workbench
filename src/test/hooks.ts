/**
 * What every test file gets: jest-dom matchers, the MSW server (handlers reset after each test), and stubs for what jsdom lacks
 * (ResizeObserver, matchMedia, scrollIntoView, pointer capture) that Radix, React Flow and the
 * sidebar use. `registerHooks` runs once per file (the module itself is cached across files).
 */
import "@testing-library/jest-dom/vitest"

import { cleanup, configure } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"

import { server } from "@/mocks/node"

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** What React Flow reads of DOMMatrixReadOnly (its testing guide's stub): the zoom from `scale(...)`. */
class DOMMatrixReadOnlyStub {
  m22: number
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.]+)\)/)?.[1]
    this.m22 = scale !== undefined ? Number(scale) : 1
  }
}

function stubBrowserGaps() {
  globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
  globalThis.DOMMatrixReadOnly ??= DOMMatrixReadOnlyStub as unknown as typeof DOMMatrixReadOnly
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
  Element.prototype.scrollIntoView ??= function scrollIntoView() {}
  Element.prototype.scrollTo ??= function scrollTo() {}
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
}

export function registerHooks() {
  configure({ asyncUtilTimeout: 5_000 })
  stubBrowserGaps()
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
  afterEach(() => {
    cleanup()
    server.resetHandlers()
  })
  afterAll(() => server.close())
}
