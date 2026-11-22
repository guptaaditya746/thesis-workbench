/** App-wide providers: data (TanStack Query), theme (next-themes), tooltips and toasts. */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppProviders({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="thesis-agent-theme">
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster richColors={false} closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
