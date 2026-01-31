import { Position, Column, Row } from '../types';

const COLUMNS: Column[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const ROWS: Row[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function positionToString(pos: Position): string {
  return `${pos.col}${pos.row}`;
}

export function stringToPosition(str: string): Position {
  const col = str[0] as Column;
  const row = parseInt(str[1]) as Row;
  return { col, row };
}

export function isValidPosition(pos: Position): boolean {
  return COLUMNS.includes(pos.col) && ROWS.includes(pos.row);
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

export function getDistance(pos1: Position, pos2: Position): number {
  const colDiff = Math.abs(getColumnIndex(pos1.col) - getColumnIndex(pos2.col));
  const rowDiff = Math.abs(pos1.row - pos2.row);
  return Math.max(colDiff, rowDiff);
}

