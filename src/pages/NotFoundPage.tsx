import { CompassIcon } from "lucide-react"
import { Link, useLocation } from "react-router"

import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <EmptyState icon={<CompassIcon />} title="No such page" description={`Nothing lives at ${pathname}.`}>
      <Button asChild variant="outline">
        <Link to="/">Back to the Workbench</Link>
      </Button>
    </EmptyState>
  )
}
