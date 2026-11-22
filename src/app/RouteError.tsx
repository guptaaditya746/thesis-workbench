import { isRouteErrorResponse, Link, useRouteError } from "react-router"

import { ErrorState } from "@/components/states"
import { Button } from "@/components/ui/button"

/** Last resort for a page that throws while rendering: say what broke, offer a way back. */
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <ErrorState error={message} title="This page failed to render" onRetry={() => window.location.reload()} />
      <Button asChild variant="outline">
        <Link to="/">Back to the overview</Link>
      </Button>
    </div>
  )
}
