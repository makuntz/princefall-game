import { GameState, GameAction, Move, Position, Piece, Color } from '../types';
import { getPieceAt, setPieceAt, getLegalMoves } from '../pieces';
import { positionToString } from '../utils/position';

/**
 * Cria estado inicial do jogo (antes do setup dos generais)
 */
export function createInitialState(): GameState {
  const board = new Map<string, Piece>();

  // Peças pretas
  setPieceAt(board, { col: 'D', row: 1 }, { type: 'king', color: 'black' });
  setPieceAt(board, { col: 'E', row: 1 }, { type: 'prince', color: 'black' });
  setPieceAt(board, { col: 'F', row: 1 }, { type: 'queen', color: 'black' });
  setPieceAt(board, { col: 'A', row: 2 }, { type: 'rook', color: 'black' });
  setPieceAt(board, { col: 'B', row: 2 }, { type: 'knight', color: 'black' });
  setPieceAt(board, { col: 'C', row: 2 }, { type: 'bishop', color: 'black' });
  setPieceAt(board, { col: 'G', row: 2 }, { type: 'bishop', color: 'black' });
  setPieceAt(board, { col: 'H', row: 2 }, { type: 'knight', color: 'black' });
  setPieceAt(board, { col: 'I', row: 2 }, { type: 'rook', color: 'black' });

  // Peças brancas
  setPieceAt(board, { col: 'A', row: 8 }, { type: 'rook', color: 'white' });
  setPieceAt(board, { col: 'B', row: 8 }, { type: 'knight', color: 'white' });
  setPieceAt(board, { col: 'C', row: 8 }, { type: 'bishop', color: 'white' });
  setPieceAt(board, { col: 'G', row: 8 }, { type: 'bishop', color: 'white' });
  setPieceAt(board, { col: 'H', row: 8 }, { type: 'knight', color: 'white' });
  setPieceAt(board, { col: 'I', row: 8 }, { type: 'rook', color: 'white' });
  setPieceAt(board, { col: 'D', row: 9 }, { type: 'queen', color: 'white' });
  setPieceAt(board, { col: 'E', row: 9 }, { type: 'prince', color: 'white' });
  setPieceAt(board, { col: 'F', row: 9 }, { type: 'king', color: 'white' });

  // Peões pretos (linha 3) - serão removidos na posição do general
  for (let col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const) {
    setPieceAt(board, { col, row: 3 }, { type: 'pawn', color: 'black', hasMoved: false });
  }

  // Peões brancos (linha 7) - serão removidos na posição do general
  for (let col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const) {
    setPieceAt(board, { col, row: 7 }, { type: 'pawn', color: 'white', hasMoved: false });
  }

  return {
    board,
    currentTurn: 'white', // White começa após setup
    moveNumber: 0,
    whiteKingSwapped: false,
    blackKingSwapped: false,
    status: 'setup',
  };
}

/**
 * Aplica ação ao estado, retornando novo estado imutável
 */
export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.status === 'finished') {
    return state; // Não permite ações em jogo finalizado
  }

  switch (action.type) {
    case 'SETUP_GENERAL':
      return applySetupGeneral(state, action);
    case 'MOVE':
      return applyMove(state, action);
    case 'SWAP_KING_PRINCE':
      return applySwapKingPrince(state, action);
    default:
      return state;
  }
}

function applySetupGeneral(state: GameState, action: GameAction): GameState {
  if (state.status !== 'setup') {
    return state;
  }

  const { position, playerColor } = action.payload;
  if (!position) {
    return state;
  }

  // Validar posição permitida
  const allowedRow = playerColor === 'white' ? 7 : 3;
  if (position.row !== allowedRow) {
    return state;
  }

  // Verificar se já foi escolhido
  if (playerColor === 'white' && state.whiteGeneralPosition) {
    return state;
  }
  if (playerColor === 'black' && state.blackGeneralPosition) {
    return state;
  }

  const newBoard = new Map(state.board);
  
  // Remover peão da posição escolhida
  setPieceAt(newBoard, position, null);
  
  // Adicionar general
  setPieceAt(newBoard, position, {
    type: 'general',
    color: playerColor,
  });

  const newState: GameState = {
    ...state,
    board: newBoard,
  };

  if (playerColor === 'white') {
    newState.whiteGeneralPosition = position;
  } else {
    newState.blackGeneralPosition = position;
  }

  // Verificar se ambos escolheram (transição para 'playing')
  if (newState.whiteGeneralPosition && newState.blackGeneralPosition) {
    newState.status = 'playing';
    newState.currentTurn = 'white'; // White começa
  }

  return newState;
}

function applyMove(state: GameState, action: GameAction): GameState {
  if (state.status !== 'playing') {
    return state;
  }

  const { move, playerColor } = action.payload;
  if (!move) {
    return state;
  }

  // Validar turno
  if (state.currentTurn !== playerColor) {
    return state;
  }

  // Validar que há peça na origem
  const piece = getPieceAt(state.board, move.from);
  if (!piece || piece.color !== playerColor) {
    return state;
  }

  // Validar movimento legal
  const legalMoves = getLegalMoves(state, move.from);
  const moveIsLegal = legalMoves.some(
    pos => pos.col === move.to.col && pos.row === move.to.row
  );

  if (!moveIsLegal) {
    return state;
  }

  // Aplicar movimento
  const newBoard = new Map(state.board);
  const capturedPiece = getPieceAt(newBoard, move.to);

  // Mover peça
  setPieceAt(newBoard, move.from, null);
  const movedPiece: Piece = {
    ...piece,
    hasMoved: true,
  };
  setPieceAt(newBoard, move.to, movedPiece);

  // Verificar se capturou príncipe (game over)
  let newStatus = state.status;
  let winner: Color | undefined;
  let endedAt: number | undefined;

  if (capturedPiece?.type === 'prince') {
    newStatus = 'finished';
    winner = playerColor;
    endedAt = Date.now();
  }

  const newState: GameState = {
    ...state,
    board: newBoard,
    currentTurn: playerColor === 'white' ? 'black' : 'white',
    moveNumber: state.moveNumber + 1,
    lastMove: {
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      isSwap: move.isSwap,
    },
    status: newStatus,
    winner,
    endedAt,
  };

  return newState;
}

function applySwapKingPrince(state: GameState, action: GameAction): GameState {
  if (state.status !== 'playing') {
    return state;
  }

  const { swapFrom, swapTo, playerColor } = action.payload;
  if (!swapFrom || !swapTo) {
    return state;
  }

  // Validar turno
  if (state.currentTurn !== playerColor) {
    return state;
  }

  // Verificar se já trocou
  if (playerColor === 'white' && state.whiteKingSwapped) {
    return state;
  }
  if (playerColor === 'black' && state.blackKingSwapped) {
    return state;
  }

  const piece1 = getPieceAt(state.board, swapFrom);
  const piece2 = getPieceAt(state.board, swapTo);

  // Validar que são rei e príncipe do mesmo jogador
  if (!piece1 || !piece2 || piece1.color !== playerColor || piece2.color !== playerColor) {
    return state;
  }

  const isKingAtFrom = piece1.type === 'king' && piece2.type === 'prince';
  const isKingAtTo = piece1.type === 'prince' && piece2.type === 'king';

  if (!isKingAtFrom && !isKingAtTo) {
    return state;
  }

  // Aplicar troca
  const newBoard = new Map(state.board);
  setPieceAt(newBoard, swapFrom, piece2);
  setPieceAt(newBoard, swapTo, piece1);

  const newState: GameState = {
    ...state,
    board: newBoard,
    currentTurn: playerColor === 'white' ? 'black' : 'white',
    moveNumber: state.moveNumber + 1,
    lastMove: {
      from: swapFrom,
      to: swapTo,
      isSwap: true,
    },
  };

  if (playerColor === 'white') {
    newState.whiteKingSwapped = true;
  } else {
    newState.blackKingSwapped = true;
  }

  return newState;
}

/**
 * Verifica se o jogo acabou
 */
export function isGameOver(state: GameState): boolean {
  return state.status === 'finished';
}

/**
 * Obtém o vencedor (se houver)
 */
export function getWinner(state: GameState): Color | null {
  return state.winner || null;
}

