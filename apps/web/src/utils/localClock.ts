export function localClockDisplay(
  whiteBank: number,
  blackBank: number,
  currentTurn: 'white' | 'black',
  turnStartedAt: number | null,
  nowMs: number,
  playing: boolean
): { white: number; black: number; active: 'white' | 'black' | null } {
  if (!playing || turnStartedAt == null) {
    return { white: whiteBank, black: blackBank, active: null };
  }

  const elapsed = Math.max(0, Math.floor((nowMs - turnStartedAt) / 1000));

  if (currentTurn === 'white') {
    return {
      white: Math.max(0, whiteBank - elapsed),
      black: blackBank,
      active: 'white',
    };
  }

  return {
    white: whiteBank,
    black: Math.max(0, blackBank - elapsed),
    active: 'black',
  };
}

export function elapsedSecondsSince(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
