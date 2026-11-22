import { isValidElement, useEffect, type ReactNode } from "react"

/** The text of a title node (`<span className="font-mono">{id}</span>` → id). */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

/**
 * Page title row: heading, a line of context, and the page's actions on the right. It also names the browser tab
 * (`docTitle`, else the title's text), so history, tabs and screen readers tell the pages apart.
 */
export function PageHeader({ title, docTitle, description, actions, children }: {
  title: ReactNode
  docTitle?: string
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  const name = docTitle ?? textOf(title).trim()
  useEffect(() => {
    if (name) document.title = `${name} · Thesis Agent`
  }, [name])
  return (
    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
