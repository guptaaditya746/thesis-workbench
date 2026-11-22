/**
 * A side drawer with one paper.md (from /api/evqa/papers/{domain}/{paper}) and one span marked: a row's quote or a
 * Find passage. Uses the paper pane's renderer. A span over several lines or table cells is marked piece by piece,
 * so the Markdown (tables above all) still renders.
 */
import { useEffect } from "react"

import { usePaper } from "@/api/evqaPapers"
import { CardsSkeleton, ErrorState } from "@/components/states"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

import { type Mark, MarkedPaper } from "./PaperPane"

export type PaperSpan = { paper: string; start: number; end: number; label: string }

const PICK = "bg-violet-500/25 ring-1 ring-violet-600/60"

/** The span [start, end) cut at line breaks and table pipes; blank pieces and table rules are skipped. */
function spanMarks(text: string, start: number, end: number, title: string): Mark[] {
  const chars = Array.from(text)
  const out: Mark[] = []
  let from = start
  const push = (a: number, b: number) => {
    while (a < b && /\s/.test(chars[a])) a++
    while (b > a && /\s/.test(chars[b - 1])) b--
    const piece = chars.slice(a, b).join("")
    if (a < b && !/^[-:\s]+$/.test(piece)) out.push({ start: a, end: b, kind: "fact", title, style: PICK })
  }
  for (let i = start; i < Math.min(end, chars.length); i++) {
    if (chars[i] === "\n" || chars[i] === "|") {
      push(from, i)
      from = i + 1
    }
  }
  push(from, Math.min(end, chars.length))
  return out
}

function Body({ domain, span }: { domain: string; span: PaperSpan }) {
  const q = usePaper(domain, span.paper)
  const text = q.data?.paper ?? null
  useEffect(() => {
    if (text !== null) document.getElementById("evqa-mark-0")?.scrollIntoView({ block: "center" })
  }, [text, span.start])
  if (q.isPending) return <CardsSkeleton count={1} />
  if (q.isError) return <ErrorState error={q.error} />
  if (text === null) return <p className="text-sm text-muted-foreground">This paper has no paper.md yet.</p>
  const ok = span.start >= 0 && span.end > span.start && span.end <= Array.from(text).length
  return (
    <div className="space-y-2">
      {!ok && <p className="text-sm text-destructive">The place in the paper is not known, so nothing is marked.</p>}
      <article aria-label={`Paper ${span.paper}`} className="text-sm">
        <MarkedPaper text={text} marks={ok ? spanMarks(text, span.start, span.end, span.label) : []} />
      </article>
    </div>
  )
}

export function PaperDrawer({ domain, span, onClose }: { domain: string; span: PaperSpan | null; onClose: () => void }) {
  return (
    <Sheet open={!!span} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-2xl">
        {span && <>
          <SheetHeader className="p-0">
            <SheetTitle className="font-mono">{span.paper}</SheetTitle>
            <SheetDescription>{span.label} (marked in violet)</SheetDescription>
          </SheetHeader>
          <Body domain={domain} span={span} />
        </>}
      </SheetContent>
    </Sheet>
  )
}
