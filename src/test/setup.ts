/**
 * Vitest setup, run before every test file: installs vitest's jsdom environment once (see
 * src/test/environment.ts for why it is not the configured environment), then registers the per-file hooks of
 * src/test/hooks.ts. Everything that touches the DOM at import time (Testing Library's `screen`) is imported
 * only after the DOM exists.
 */
import { builtinEnvironments } from "vitest/environments"

const scope = globalThis as { __testDomInstalled?: boolean }
if (!scope.__testDomInstalled) {
  await builtinEnvironments.jsdom.setup(globalThis, { jsdom: { url: "http://localhost:5173/" } })
  scope.__testDomInstalled = true
}

const { registerHooks } = await import("./hooks")
registerHooks()
