/** The frame of every page: a header with the app name, the sound switch and the theme switch, and the page. */
import { Suspense } from "react"
import { Link, Outlet } from "react-router"

import { CardsSkeleton } from "@/components/states"

import { SoundToggle } from "./SoundToggle"
import { ThemeToggle } from "./ThemeToggle"

export function AppLayout() {
  return (
    <div className="flex min-h-svh min-w-0 flex-col">
      <a href="#main" className="sr-only rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50">Skip to content</a>
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Link to="/workbench" className="text-sm font-semibold">Workbench</Link>
        <div className="flex-1" />
        <SoundToggle />
        <ThemeToggle />
      </header>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-6">
        <Suspense fallback={<CardsSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
