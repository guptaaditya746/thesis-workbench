/**
 * Entry point. Requests go to the backend (Vite proxies /api in dev; in production the backend serves this
 * build at /).
 */
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router"

import { createQueryClient } from "@/api/client"
import { AppProviders } from "@/app/providers"
import { routes } from "@/app/routes"

import "./index.css"

const router = createBrowserRouter(routes)
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders client={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
