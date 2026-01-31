/**
 * Shared types between client and server
 */

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Game {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  status: 'waiting' | 'setup' | 'playing' | 'finished';
  currentTurn: 'white' | 'black';
  moveNumber: number;
  winnerId: string | null;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

export interface GameMove {
  id: string;
  gameId: string;
  moveNumber: number;
  playerId: string;
  from: string; // "A1"
  to: string; // "B2"
  promotion?: string;
  isSwap?: boolean;
  createdAt: Date;
}

export interface Rating {
  userId: string;
  rating: number; // Elo/Glicko
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: Date;
}

