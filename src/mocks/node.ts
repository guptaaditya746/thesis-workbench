/** MSW in Node (Vitest): no default handlers; each test installs the /api answers it needs with server.use. */
import { setupServer } from "msw/node"

export const server = setupServer()
