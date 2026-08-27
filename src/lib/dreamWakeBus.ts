// Per "Sonder - Direct Instructions for CC 2026-08-26 Part 63" — a real
// jolt should interrupt sleep, not fire independently of it. FreefallStartle
// is mounted once at the root layout (fires on any screen); useIdleSleep's
// dream state is local to chat.tsx (it only means anything where the mist/
// dream overlay actually renders). This tiny bus is the connection between
// them without lifting dream state to a context or making FreefallStartle
// screen-aware — chat.tsx just isn't subscribed when it isn't mounted, so a
// freefall on another screen correctly has nothing to wake.
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeDreamWake(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDreamWake(): void {
  listeners.forEach((listener) => listener());
}
