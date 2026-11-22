/** The chime and the "which runs just finished" rule of the sound switch (SoundToggle). */
import type { RunItem } from "@/api/evqaRuns"

let audio: AudioContext | null = null

/** Two short rising notes. */
export function chime() {
  try {
    audio ??= new AudioContext()
    if (audio.state === "suspended") void audio.resume()
    const t0 = audio.currentTime
    ;[660, 880].forEach((freq, i) => {
      const osc = audio!.createOscillator()
      const gain = audio!.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      const start = t0 + i * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
      osc.connect(gain).connect(audio!.destination)
      osc.start(start)
      osc.stop(start + 0.4)
    })
  } catch {
    /* no audio in this browser */
  }
}

/** Runs that are done now but were not done (or not there) in `before`. */
export function newlyDone(before: Map<string, boolean>, now: RunItem[]): RunItem[] {
  return now.filter((r) => r.has_eval && before.get(r.run_id) !== true)
}
