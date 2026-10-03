export type ScanGate = { code: string; lastSeen: number; blockedUntil: number };
export function observeScan(state: ScanGate, code: string, now: number): boolean {
  const continuous = state.code === code && now - state.lastSeen < 1000;
  state.code = code;
  state.lastSeen = now;
  return now >= state.blockedUntil && !continuous;
}
