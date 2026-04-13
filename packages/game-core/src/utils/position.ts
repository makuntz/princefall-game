import { Position, Column, Row, GameMode } from '../types';

const COLUMNS: Column[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const ROWS: Row[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function positionToString(pos: Position): string {
  return `${pos.col}${pos.row}`;
}

export function stringToPosition(str: string): Position {
  const col = str[0] as Column;
  const row = parseInt(str.slice(1), 10) as Row;
  return { col, row };
}

export function isValidPosition(pos: Position): boolean {
  return COLUMNS.includes(pos.col) && ROWS.includes(pos.row);
}

/** True if the square exists on the board for the given mode (8x8 traditional uses A–H, 1–8). */
export function isPositionOnBoard(mode: GameMode, pos: Position): boolean {
  if (!COLUMNS.includes(pos.col) || !ROWS.includes(pos.row)) {
    return false;
  }
  if (mode === 'traditional') {
    const ci = getColumnIndex(pos.col);
    return ci >= 0 && ci <= 7 && pos.row >= 1 && pos.row <= 8;
  }
  return true;
}

export function getColumnIndex(col: Column): number {
  return COLUMNS.indexOf(col);
}

export function getColumnByIndex(index: number): Column {
  return COLUMNS[index];
}

export function getRowIndex(row: Row): number {
  return ROWS.indexOf(row);
}

export function getRowByIndex(index: number): Row {
  return ROWS[index];
}

export function addOffset(pos: Position, colOffset: number, rowOffset: number): Position | null {
  const colIdx = getColumnIndex(pos.col);
  const rowIdx = getRowIndex(pos.row);
  const newColIdx = colIdx + colOffset;
  const newRowIdx = rowIdx + rowOffset;

  if (newColIdx < 0 || newColIdx >= COLUMNS.length || newRowIdx < 0 || newRowIdx >= ROWS.length) {
    return null;
  }

  return {
    col: getColumnByIndex(newColIdx),
    row: getRowByIndex(newRowIdx),
  };
}

/**
 * Offset move constrained to the playable board for the mode.
 */
export function addOffsetInMode(
  mode: GameMode,
  pos: Position,
  colOffset: number,
  rowOffset: number
): Position | null {
  const colIdx = getColumnIndex(pos.col);
  const rowIdx = getRowIndex(pos.row);
  const newColIdx = colIdx + colOffset;
  const newRowIdx = rowIdx + rowOffset;

  if (mode === 'traditional') {
    if (newColIdx < 0 || newColIdx > 7 || newRowIdx < 0 || newRowIdx > 7) {
      return null;
    }
    return {
      col: getColumnByIndex(newColIdx),
      row: getRowByIndex(newRowIdx),
    };
  }

  if (newColIdx < 0 || newColIdx >= 9 || newRowIdx < 0 || newRowIdx >= 9) {
    return null;
  }

  return {
    col: getColumnByIndex(newColIdx),
    row: getRowByIndex(newRowIdx),
  };
}

export function getDistance(pos1: Position, pos2: Position): number {
  const colDiff = Math.abs(getColumnIndex(pos1.col) - getColumnIndex(pos2.col));
  const rowDiff = Math.abs(pos1.row - pos2.row);
  return Math.max(colDiff, rowDiff);
}
