/** Sound on/off. When on, the page checks the run list every 15 s and plays a short chime (plus a toast) when a run
 * is done: its eval.json appears (has_eval turns true, or a new run shows up already scored). The choice is
 * remembered in this browser. The chime is made with the Web Audio API (no sound file); browsers allow sound only
 * after a click, so the click that turns sound on also unlocks it. */
import { useQuery } from "@tanstack/react-query"
import { BellIcon, BellOffIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type { RunItem } from "@/api/evqaRuns"
import { getJson } from "@/api/client"
import { Button } from "@/components/ui/button"

import { chime, newlyDone } from "./sound"

const STORE = "workbench.sound"
const POLL_MS = 15_000

function readOn(): boolean {
  try {
    return localStorage.getItem(STORE) === "on"
  } catch {
    return false
  }
}

function saveOn(on: boolean) {
  try {
    localStorage.setItem(STORE, on ? "on" : "off")
  } catch {
    /* private window: not remembered, still works */
  }
}

export function SoundToggle() {
  const [on, setOn] = useState(readOn)
  const seen = useRef<Map<string, boolean> | null>(null)
  const runs = useQuery({
    queryKey: ["evqa", "runs", "sound"],
    queryFn: ({ signal }) => getJson<RunItem[]>("/api/evqa/runs", undefined, signal),
    enabled: on,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    if (!on || !runs.data) return
    const now = runs.data
    if (seen.current) {
      const done = newlyDone(seen.current, now)
      if (done.length) {
        chime()
        toast.success(`Done: ${done.map((r) => r.run_id).join(", ")}`)
      }
    }
    seen.current = new Map(now.map((r) => [r.run_id, r.has_eval]))
  }, [on, runs.data])

  const toggle = () => {
    const next = !on
    setOn(next)
    saveOn(next)
    seen.current = null          // start fresh: only runs finishing from now on chime
    if (next) chime()            // this click unlocks audio; the chime confirms it works
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} aria-pressed={on}
            aria-label={on ? "Sound on: chime when a run is done" : "Sound off"}
            title={on ? "Sound on: chime when a run is done" : "Sound off"}>
      {on ? <BellIcon /> : <BellOffIcon />}
    </Button>
  )
}
