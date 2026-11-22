/**
 * The test environment: vitest's jsdom, installed by the setup file (src/test/setup.ts) rather
 * than at worker start.
 *
 * Why: vitest gives a worker a fixed 60 s to start, and starting includes setting up the
 * environment. Importing jsdom reads ~850 files; with the repo on /mnt/c under WSL (how this
 * project runs its tests) that alone takes 30-45 s, so workers missed the deadline. This
 * environment only selects browser-style module resolution ("client", as jsdom does) and starts
 * at once; the setup file then installs the real jsdom environment, with no start deadline.
 */
import type { Environment } from "vitest/environments"

export default {
  name: "jsdom-in-setup",
  viteEnvironment: "client",
  setup: () => ({ teardown: () => {} }),
} satisfies Environment
