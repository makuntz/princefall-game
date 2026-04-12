import { GameState, GameAction, Position, Piece, Color } from '../types';
import { getPieceAt, setPieceAt, getLegalMoves } from '../pieces';
import { positionToString } from '../utils/position';
import { resolveImperialTimeout } from '../scoring';

export function createImperialInitialState(): GameState {
  const board = new Map<string, Piece>();

  setPieceAt(board, { col: 'D', row: 1 }, { type: 'king', color: 'black' });
  setPieceAt(board, { col: 'E', row: 1 }, { type: 'prince', color: 'black' });
  setPieceAt(board, { col: 'F', row: 1 }, { type: 'queen', color: 'black' });
  setPieceAt(board, { col: 'A', row: 2 }, { type: 'rook', color: 'black' });
  setPieceAt(board, { col: 'B', row: 2 }, { type: 'knight', color: 'black' });
  setPieceAt(board, { col: 'C', row: 2 }, { type: 'bishop', color: 'black' });
  setPieceAt(board, { col: 'G', row: 2 }, { type: 'bishop', color: 'black' });
  setPieceAt(board, { col: 'H', row: 2 }, { type: 'knight', color: 'black' });
  setPieceAt(board, { col: 'I', row: 2 }, { type: 'rook', color: 'black' });

  setPieceAt(board, { col: 'A', row: 8 }, { type: 'rook', color: 'white' });
  setPieceAt(board, { col: 'B', row: 8 }, { type: 'knight', color: 'white' });
  setPieceAt(board, { col: 'C', row: 8 }, { type: 'bishop', color: 'white' });
  setPieceAt(board, { col: 'G', row: 8 }, { type: 'bishop', color: 'white' });
  setPieceAt(board, { col: 'H', row: 8 }, { type: 'knight', color: 'white' });
  setPieceAt(board, { col: 'I', row: 8 }, { type: 'rook', color: 'white' });
  setPieceAt(board, { col: 'D', row: 9 }, { type: 'queen', color: 'white' });
  setPieceAt(board, { col: 'E', row: 9 }, { type: 'prince', color: 'white' });
  setPieceAt(board, { col: 'F', row: 9 }, { type: 'king', color: 'white' });

  for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const) {
    setPieceAt(board, { col, row: 3 }, { type: 'pawn', color: 'black', hasMoved: false });
  }

  for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const) {
    setPieceAt(board, { col, row: 7 }, { type: 'pawn', color: 'white', hasMoved: false });
  }

  return {
    gameMode: 'imperial',
    board,
    currentTurn: 'white',
    moveNumber: 0,
    whiteKingSwapped: false,
    blackKingSwapped: false,
    status: 'setup',
    coinflipResolved: false,
  };
}

/** Standard 8×8 layout (white ranks 1–2), matching reference HTML. */
export function createTraditionalInitialState(): GameState {
  const board = new Map<string, Piece>();

  const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'] as const;
  const cols: Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'> = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  for (let i = 0; i < 8; i++) {
    setPieceAt(board, { col: cols[i], row: 1 }, { type: back[i], color: 'white', hasMoved: false });
    setPieceAt(board, { col: cols[i], row: 2 }, { type: 'pawn', color: 'white', hasMoved: false });
    setPieceAt(board, { col: cols[i], row: 7 }, { type: 'pawn', color: 'black', hasMoved: false });
    setPieceAt(board, { col: cols[i], row: 8 }, { type: back[i], color: 'black', hasMoved: false });
  }

  return {
    gameMode: 'traditional',
    board,
    currentTurn: 'white',
    moveNumber: 0,
    whiteKingSwapped: false,
    blackKingSwapped: false,
    status: 'playing',
    coinflipResolved: true,
  };
}

/** @deprecated Use createImperialInitialState — kept for server compatibility. */
export function createInitialState(): GameState {
  return createImperialInitialState();
}

export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.status === 'finished') {
    return state;
  }

  switch (action.type) {
    case 'SETUP_GENERAL':
      return applySetupGeneral(state, action);
    case 'MOVE':
      return applyMove(state, action);
    case 'SWAP_KING_PRINCE':
      return applySwapKingPrince(state, action);
    case 'RESOLVE_COINFLIP':
      return applyResolveCoinflip(state, action);
    case 'BEGIN_PLAYING':
      return applyBeginPlaying(state);
    case 'FORFEIT_ON_TIME':
      return applyForfeitOnTime(state, action);
    default:
      return state;
  }
}

function applySetupGeneral(state: GameState, action: GameAction): GameState {
  if (action.type !== 'SETUP_GENERAL') return state;
  if (state.gameMode !== 'imperial' || state.status !== 'setup') {
    return state;
  }

  const { position } = action.payload;
  const { playerColor } = action;
  if (!position) {
    return state;
  }

  const allowedRow = playerColor === 'white' ? 7 : 3;
  if (position.row !== allowedRow) {
    return state;
  }

  if (playerColor === 'white' && state.whiteGeneralPosition) {
    return state;
  }
  if (playerColor === 'black' && state.blackGeneralPosition) {
    return state;
  }

  const newBoard = new Map(state.board);

  setPieceAt(newBoard, position, null);
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

  if (newState.whiteGeneralPosition && newState.blackGeneralPosition) {
    newState.status = 'coinflip';
    newState.coinflipResolved = false;
  }

  return newState;
}

function applyResolveCoinflip(state: GameState, action: GameAction): GameState {
  if (action.type !== 'RESOLVE_COINFLIP') return state;
  if (state.status !== 'coinflip') {
    return state;
  }
  if (state.coinflipResolved) {
    return state;
  }

  return {
    ...state,
    currentTurn: action.payload.starter,
    status: 'ready',
    coinflipResolved: true,
  };
}

function applyBeginPlaying(state: GameState): GameState {
  if (state.status !== 'ready' || !state.coinflipResolved) {
    return state;
  }

  return {
    ...state,
    status: 'playing',
  };
}

function applyForfeitOnTime(state: GameState, action: GameAction): GameState {
  if (action.type !== 'FORFEIT_ON_TIME') return state;
  if (state.status !== 'playing') {
    return state;
  }

  const { timedOutColor } = action.payload;

  if (state.gameMode === 'imperial') {
    const { winner, finishedReason } = resolveImperialTimeout(state, timedOutColor);
    return {
      ...state,
      status: 'finished',
      winner: winner ?? undefined,
      finishedReason,
      endedAt: Date.now(),
    };
  }

  if (state.gameMode === 'traditional') {
    const winner: Color = timedOutColor === 'white' ? 'black' : 'white';
    return {
      ...state,
      status: 'finished',
      winner,
      finishedReason: 'timeout',
      endedAt: Date.now(),
    };
  }

  return state;
}

function applyMove(state: GameState, action: GameAction): GameState {
  if (action.type !== 'MOVE') return state;
  if (state.status !== 'playing') {
    return state;
  }

  const { move } = action.payload;
  const { playerColor } = action;
  if (!move) {
    return state;
  }

  if (state.currentTurn !== playerColor) {
    return state;
  }

  const piece = getPieceAt(state.board, move.from);
  if (!piece || piece.color !== playerColor) {
    return state;
  }

  const legalMoves = getLegalMoves(state, move.from);
  const moveIsLegal = legalMoves.some(pos => pos.col === move.to.col && pos.row === move.to.row);

  if (!moveIsLegal) {
    return state;
  }

  const newBoard = new Map(state.board);
  const capturedPiece = getPieceAt(newBoard, move.to);

  setPieceAt(newBoard, move.from, null);
  const movedPiece: Piece = {
    ...piece,
    hasMoved: true,
  };
  setPieceAt(newBoard, move.to, movedPiece);

  let newStatus: GameState['status'] = state.status;
  let winner: Color | undefined;
  let endedAt: number | undefined;
  let finishedReason: GameState['finishedReason'];

  if (state.gameMode === 'imperial' && capturedPiece?.type === 'prince') {
    newStatus = 'finished';
    winner = playerColor;
    endedAt = Date.now();
    finishedReason = 'prince_capture';
  } else if (state.gameMode === 'traditional' && capturedPiece?.type === 'king') {
    newStatus = 'finished';
    winner = playerColor;
    endedAt = Date.now();
    finishedReason = 'king_capture';
  }

  return {
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
    finishedReason,
  };
}

function applySwapKingPrince(state: GameState, action: GameAction): GameState {
  if (action.type !== 'SWAP_KING_PRINCE') return state;
  if (state.gameMode !== 'imperial' || state.status !== 'playing') {
    return state;
  }

  const { swapFrom, swapTo } = action.payload;
  const { playerColor } = action;
  if (!swapFrom || !swapTo) {
    return state;
  }

  if (state.currentTurn !== playerColor) {
    return state;
  }

  if (playerColor === 'white' && state.whiteKingSwapped) {
    return state;
  }
  if (playerColor === 'black' && state.blackKingSwapped) {
    return state;
  }

  const piece1 = getPieceAt(state.board, swapFrom);
  const piece2 = getPieceAt(state.board, swapTo);

  if (!piece1 || !piece2 || piece1.color !== playerColor || piece2.color !== playerColor) {
    return state;
  }

  const isKingAtFrom = piece1.type === 'king' && piece2.type === 'prince';
  const isKingAtTo = piece1.type === 'prince' && piece2.type === 'king';

  if (!isKingAtFrom && !isKingAtTo) {
    return state;
  }

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

export function isGameOver(state: GameState): boolean {
  return state.status === 'finished';
}

export function getWinner(state: GameState): Color | null {
  return state.winner || null;
}
