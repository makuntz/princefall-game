/** Nome da peça em PT-BR para o jogador (o tipo no motor continua em inglês). */
export function pieceLabelPt(type: string): string {
  const labels: Record<string, string> = {
    pawn: 'peão',
    rook: 'torre',
    knight: 'cavalo',
    bishop: 'bispo',
    queen: 'rainha',
    king: 'rei',
    prince: 'princesa',
    general: 'general',
  };
  return labels[type] ?? type;
}
