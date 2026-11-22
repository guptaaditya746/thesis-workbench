/**
 * Routes. The app opens on the Workbench (`/` leads to `/workbench`). Pages load lazily, so the graphs
 * (Cytoscape) and the charts (recharts) stay out of the first bundle until needed.
 */
import { lazy } from "react"
import { Navigate, type RouteObject } from "react-router"

import { AppLayout } from "@/components/layout/AppLayout"

import { RouteError } from "./RouteError"

const WorkbenchPage = lazy(() => import("@/pages/workbench/WorkbenchPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/workbench" replace /> },
      { path: "workbench", element: <WorkbenchPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]
