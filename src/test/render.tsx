/** Render with the app's providers and a memory router; queries never retry and stay fresh. */
import { QueryClient } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { createMemoryRouter, MemoryRouter, RouterProvider, type RouteObject } from "react-router"

import { AppProviders } from "@/app/providers"

export function testClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } })
}

export function renderWithProviders(ui: ReactElement, { route = "/" }: { route?: string } = {}) {
  const client = testClient()
  const utils = render(
    <AppProviders client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AppProviders>,
  )
  return { client, ...utils }
}

export function renderRoutes(routes: RouteObject[], route: string) {
  const client = testClient()
  const router = createMemoryRouter(routes, { initialEntries: [route] })
  const utils = render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { client, router, ...utils }
}
