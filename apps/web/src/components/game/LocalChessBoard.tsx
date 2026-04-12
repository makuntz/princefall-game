import { GameState, Position } from '@princefall/game-core';
import { positionToString } from '@princefall/game-core';
import { getPieceEmoji } from './pieceEmoji';
import './GameStyles.css';

type BoardSize = 8 | 9;

const COLS_9 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
const COLS_8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

const ROWS_9: Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9> = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const ROWS_8: Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8> = [8, 7, 6, 5, 4, 3, 2, 1];

export interface LocalChessBoardProps {
  gameState: GameState;
  selectedPos: Position | null;
  legalMoves: Position[];
  onCellClick: (pos: Position) => void;
  /** Piece color selected for swap highlight (optional). */
  movingColor?: 'white' | 'black';
}

export function LocalChessBoard({
  gameState,
  selectedPos,
  legalMoves,
  onCellClick,
}: LocalChessBoardProps) {
  const size: BoardSize = gameState.gameMode === 'imperial' ? 9 : 8;
  const columns = size === 9 ? COLS_9 : COLS_8;
  const rows = size === 9 ? ROWS_9 : ROWS_8;

  const gridLineEnd = size + 2;

  return (
    <div className="board-wrapper board-wrapper-centered">
      <div
        className="board-container board-container-dynamic"
        style={{
          gridTemplateColumns: `minmax(22px, 0.35fr) repeat(${size}, minmax(36px, 1fr)) minmax(22px, 0.35fr)`,
          gridTemplateRows: `minmax(22px, 0.35fr) repeat(${size}, minmax(36px, 1fr)) minmax(22px, 0.35fr)`,
        }}
      >
        {columns.map((col, idx) => (
          <div
            key={`top-${col}`}
            className="coord-label"
            style={{ gridColumn: idx + 2, gridRow: 1 }}
          >
            {col}
          </div>
        ))}
        {columns.map((col, idx) => (
          <div
            key={`bottom-${col}`}
            className="coord-label"
            style={{ gridColumn: idx + 2, gridRow: gridLineEnd }}
          >
            {col}
          </div>
        ))}
        {rows.map((row, idx) => (
          <div
            key={`left-${row}`}
            className="coord-label"
            style={{ gridColumn: 1, gridRow: idx + 2 }}
          >
            {row}
          </div>
        ))}
        {rows.map((row, idx) => (
          <div
            key={`right-${row}`}
            className="coord-label"
            style={{ gridColumn: gridLineEnd, gridRow: idx + 2 }}
          >
            {row}
          </div>
        ))}

        <div
          className="board board-dynamic"
          style={{
            gridColumn: `2 / ${gridLineEnd}`,
            gridRow: `2 / ${gridLineEnd}`,
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
          }}
        >
          {rows.map(row =>
            columns.map(col => {
              const pos = { col, row } as Position;
              const key = positionToString(pos);
              const squarePiece = gameState.board.get(key);
              const isSelected = selectedPos?.col === col && selectedPos?.row === row;
              const isHighlight = legalMoves.some(m => m.col === col && m.row === row);
              const isCapture =
                isHighlight &&
                !!squarePiece &&
                !!selectedPos &&
                gameState.board.get(positionToString(selectedPos))?.color !== squarePiece.color;
              const colIndex = columns.findIndex(c => c === col);
              const isLight = (colIndex + row) % 2 === 0;

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  className={`square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isHighlight ? 'highlight' : ''} ${isCapture ? 'capture' : ''}`}
                  onClick={() => onCellClick(pos)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onCellClick(pos);
                    }
                  }}
                >
                  {squarePiece && (
                    <span
                      className={`${squarePiece.color === 'white' ? 'piece-white' : 'piece-black'} ${squarePiece.color === 'black' && (squarePiece.type === 'prince' || squarePiece.type === 'general') ? 'emoji-piece' : ''}`}
                    >
                      {getPieceEmoji(squarePiece.type, squarePiece.color)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
