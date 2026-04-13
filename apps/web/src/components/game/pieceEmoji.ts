/** Peças pretas com emoji usam `emoji-piece` no CSS (princesa fica silhueta preta). */
export function pieceBoardClassName(color: string, type: string): string {
  const base = color === 'white' ? 'piece-white' : 'piece-black';
  if (color === 'black' && (type === 'prince' || type === 'general')) {
    return `${base} emoji-piece`;
  }
  return base;
}

export function getPieceEmoji(type: string, color: string): string {
  const pieces: Record<string, { white: string; black: string }> = {
    pawn: { white: '♙', black: '♟' },
    rook: { white: '♖', black: '♜' },
    knight: { white: '♘', black: '♞' },
    bishop: { white: '♗', black: '♝' },
    queen: { white: '♕', black: '♛' },
    king: { white: '♔', black: '♚' },
    prince: { white: '👸', black: '👸' },
    general: { white: '⚔️', black: '⚔️' },
  };
  return pieces[type]?.[color as 'white' | 'black'] || '?';
}
