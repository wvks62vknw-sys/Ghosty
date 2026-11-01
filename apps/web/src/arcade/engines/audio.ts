/**
 * The arcade's one AudioContext. Phones only let a page make sound from inside a tap, so the player calls
 * `primeAudio()` in PLAY's own tap (before anything is awaited) and every engine takes the same, already-unlocked
 * context from `arcadeAudio()`. A later tap on the game resumes it again if the phone suspended it.
 */

let ctx: AudioContext | null = null;

type AudioCtor = typeof AudioContext;
const ctor = (): AudioCtor | undefined => (globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;

const wake = () => {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined);
};

/** Make (or resume) the context; call it inside the tap that starts a game. */
export function primeAudio(): AudioContext | null {
  if (!ctx) {
    const C = ctor();
    if (!C) return null;
    try {
      ctx = new C({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    for (const t of ['pointerdown', 'touchend', 'keydown'] as const) document.addEventListener(t, wake, { capture: true, passive: true });
  }
  wake();
  return ctx;
}

/** The arcade's context (made here if no tap made it first: it starts when the next tap comes). */
export const arcadeAudio = (): AudioContext | null => ctx ?? primeAudio();
