import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyAction,
  createImperialInitialState,
  createTraditionalInitialState,
  GameAction,
  GameState,
  getLegalMoves,
  positionToString,
  Position,
} from '@princefall/game-core';
import { ModeSelectionScreen, LocalPlayChoice } from './game/ModeSelectionScreen';
import { SetupScreen } from './game/SetupScreen';
import { CoinflipScreen } from './game/CoinflipScreen';
import { LocalChessBoard } from './game/LocalChessBoard';
import { LocalGameSidePanel } from './game/LocalGameSidePanel';
import './game/GameStyles.css';

/** 10 minutos por lado (imperial e tradicional no local). */
const MATCH_CLOCK_SECONDS = 600;

export function LocalGame({ onBack }: { onBack: () => void }) {
  const [menu, setMenu] = useState(true);
  const [lastMode, setLastMode] = useState<LocalPlayChoice>('imperial');
  const [gameState, setGameState] = useState<GameState>(createImperialInitialState());
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [message, setMessage] = useState('');

  const [whiteClock, setWhiteClock] = useState(MATCH_CLOCK_SECONDS);
  const [blackClock, setBlackClock] = useState(MATCH_CLOCK_SECONDS);
  const forfeitRef = useRef(false);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const resetClocks = useCallback(() => {
    setWhiteClock(MATCH_CLOCK_SECONDS);
    setBlackClock(MATCH_CLOCK_SECONDS);
    forfeitRef.current = false;
  }, []);

  const startMode = useCallback((mode: LocalPlayChoice) => {
    setLastMode(mode);
    setMenu(false);
    setSelectedPos(null);
    setSwapMode(false);
    forfeitRef.current = false;
    if (mode === 'traditional') {
      setGameState(createTraditionalInitialState());
      setMessage('Clique numa peça branca para começar.');
      resetClocks();
    } else {
      setGameState(createImperialInitialState());
      setMessage('');
      resetClocks();
    }
  }, [resetClocks]);

  const backToModeMenu = useCallback(() => {
    setMenu(true);
    setSelectedPos(null);
    setSwapMode(false);
    setMessage('');
    setGameState(createImperialInitialState());
    resetClocks();
  }, [resetClocks]);

  const resetMatch = useCallback(() => {
    setSelectedPos(null);
    setSwapMode(false);
    forfeitRef.current = false;
    resetClocks();
    if (lastMode === 'traditional') {
      setGameState(createTraditionalInitialState());
      setMessage('Partida reiniciada. Vez das Brancas.');
    } else {
      setGameState(createImperialInitialState());
      setMessage('');
    }
  }, [lastMode, resetClocks]);

  const clockedModes =
    gameState.gameMode === 'imperial' || gameState.gameMode === 'traditional';

  useEffect(() => {
    if (!clockedModes || gameState.status !== 'playing') {
      return undefined;
    }
    if (gameState.moveNumber < 1) {
      return undefined;
    }
    if (forfeitRef.current) {
      return undefined;
    }

    const id = window.setInterval(() => {
      const s = stateRef.current;
      if (s.status !== 'playing' || (s.gameMode !== 'imperial' && s.gameMode !== 'traditional')) {
        return;
      }
      setWhiteClock(w => (s.currentTurn === 'white' ? Math.max(0, w - 1) : w));
      setBlackClock(b => (s.currentTurn === 'black' ? Math.max(0, b - 1) : b));
    }, 1000);

    return () => window.clearInterval(id);
  }, [clockedModes, gameState.status, gameState.gameMode, gameState.moveNumber]);

  useEffect(() => {
    if (!clockedModes || gameState.status !== 'playing') {
      return;
    }
    if (gameState.moveNumber < 1 || forfeitRef.current) {
      return;
    }
    if (whiteClock > 0 && blackClock > 0) {
      return;
    }
    const timedOut: 'white' | 'black' = whiteClock <= 0 ? 'white' : 'black';
    forfeitRef.current = true;
    setGameState(s =>
      applyAction(s, {
        type: 'FORFEIT_ON_TIME',
        payload: { timedOutColor: timedOut },
      })
    );
    setSelectedPos(null);
    setSwapMode(false);
  }, [whiteClock, blackClock, gameState.status, gameState.gameMode, gameState.moveNumber, clockedModes]);

  const handleSetupWhite = (pos: Position) => {
    const action: GameAction = {
      type: 'SETUP_GENERAL',
      payload: { position: pos },
      playerColor: 'white',
    };
    setGameState(s => applyAction(s, action));
    setMessage('Pretas: escolham a posição do General na linha 3.');
  };

  const handleSetupBlack = (pos: Position) => {
    const action: GameAction = {
      type: 'SETUP_GENERAL',
      payload: { position: pos },
      playerColor: 'black',
    };
    setGameState(s => applyAction(s, action));
    setMessage('Cara ou coroa para definir quem começa.');
  };

  const handleResolveCoinflip = async () => {
    const starter: 'white' | 'black' = Math.random() < 0.5 ? 'white' : 'black';
    setGameState(s =>
      applyAction(s, {
        type: 'RESOLVE_COINFLIP',
        payload: { starter },
      })
    );
  };

  const handleBeginPlaying = async () => {
    setGameState(s => applyAction(s, { type: 'BEGIN_PLAYING' }));
    setMessage('Clique numa peça para mover.');
  };

  const handleCellClick = (pos: Position) => {
    if (gameState.status !== 'playing') {
      return;
    }

    if (swapMode) {
      handleSwapClick(pos);
      return;
    }

    if (selectedPos) {
      const legalMoves = getLegalMoves(gameState, selectedPos);
      const isValidMove = legalMoves.some(m => m.col === pos.col && m.row === pos.row);

      if (!isValidMove) {
        setMessage('Movimento inválido.');
        setSelectedPos(null);
        return;
      }

      const action: GameAction = {
        type: 'MOVE',
        payload: {
          move: {
            from: selectedPos,
            to: pos,
          },
        },
        playerColor: gameState.currentTurn,
      };

      const newState = applyAction(gameState, action);
      setGameState(newState);
      setSelectedPos(null);

      if (newState.status === 'finished') {
        setMessage('Fim de jogo.');
        return;
      }

      setMessage('Selecione uma peça.');
      return;
    }

    const piece = gameState.board.get(positionToString(pos));
    if (!piece) {
      setMessage('Casa vazia.');
      return;
    }
    if (piece.color !== gameState.currentTurn) {
      setMessage('Não é o seu turno.');
      return;
    }
    setSelectedPos(pos);
    setMessage(`Peça selecionada: ${positionToString(pos)}`);
  };

  const handleSwapClick = (pos: Position) => {
    if (!selectedPos) {
      return;
    }

    const piece1 = gameState.board.get(positionToString(selectedPos));
    const piece2 = gameState.board.get(positionToString(pos));

    if (!piece1 || !piece2) {
      setSelectedPos(null);
      setSwapMode(false);
      setMessage('Seleção cancelada.');
      return;
    }

    const isKingAndPrince =
      ((piece1.type === 'king' && piece2.type === 'prince') ||
        (piece1.type === 'prince' && piece2.type === 'king')) &&
      piece1.color === piece2.color &&
      piece1.color === gameState.currentTurn;

    if (!isKingAndPrince) {
      setMessage('Selecione o Rei e o Príncipe do mesmo jogador.');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    const canSwap =
      gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped;

    if (!canSwap) {
      setMessage('Esta troca já foi usada neste jogo.');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    const action: GameAction = {
      type: 'SWAP_KING_PRINCE',
      payload: {
        swapFrom: selectedPos,
        swapTo: pos,
      },
      playerColor: gameState.currentTurn,
    };

    const newState = applyAction(gameState, action);
    setGameState(newState);
    setSelectedPos(null);
    setSwapMode(false);
    setMessage('Troca realizada.');
  };

  const handleSwapMode = () => {
    if (gameState.gameMode !== 'imperial' || gameState.status !== 'playing') {
      return;
    }

    const canSwap =
      gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped;

    if (!canSwap) {
      setMessage('Esta troca já foi usada neste jogo.');
      return;
    }

    setSwapMode(v => !v);
    setSelectedPos(null);
  };

  const piece = selectedPos ? gameState.board.get(positionToString(selectedPos)) : null;
  const canSwapButton =
    gameState.gameMode === 'imperial' &&
    gameState.status === 'playing' &&
    (gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped);

  const legalMoves =
    selectedPos && !swapMode && gameState.status === 'playing' ? getLegalMoves(gameState, selectedPos) : [];

  const clockActive: 'white' | 'black' | null =
    clockedModes &&
    gameState.status === 'playing' &&
    gameState.moveNumber >= 1 &&
    !forfeitRef.current
      ? gameState.currentTurn
      : null;

  if (menu) {
    return (
      <ModeSelectionScreen
        onSelectMode={startMode}
        onBack={() => {
          onBack();
        }}
      />
    );
  }

  if (lastMode === 'imperial' && gameState.status === 'setup') {
    const playerColor = !gameState.whiteGeneralPosition ? 'white' : 'black';
    return (
      <div className="game-container game-container-dark">
        <button type="button" className="back-btn" onClick={backToModeMenu}>
          ← Menu principal
        </button>
        <SetupScreen
          playerColor={playerColor}
          onConfirm={playerColor === 'white' ? handleSetupWhite : handleSetupBlack}
          waiting={false}
        />
      </div>
    );
  }

  if (lastMode === 'imperial' && (gameState.status === 'coinflip' || gameState.status === 'ready')) {
    return (
      <div className="game-container game-container-dark">
        <button type="button" className="back-btn" onClick={backToModeMenu}>
          ← Menu principal
        </button>
        <CoinflipScreen
          phase={gameState.status === 'ready' ? 'ready' : 'coinflip'}
          starter={gameState.status === 'ready' ? gameState.currentTurn : null}
          onResolveFlip={handleResolveCoinflip}
          onBeginGame={handleBeginPlaying}
        />
      </div>
    );
  }

  return (
    <div className="game-container game-container-dark">
      <button type="button" className="back-btn" onClick={backToModeMenu}>
        ← Menu principal
      </button>

      <div className="game-layout game-layout-local">
        <LocalChessBoard
          gameState={gameState}
          selectedPos={selectedPos}
          legalMoves={legalMoves}
          onCellClick={handleCellClick}
        />

        <LocalGameSidePanel
          gameState={gameState}
          contextualMessage={
            swapMode
              ? 'Modo troca: toque no Rei e no Príncipe do mesmo lado.'
              : message ||
                (piece
                  ? `Peça selecionada: ${positionToString(selectedPos!)} (${piece.type})`
                  : gameState.lastMove
                    ? `Última jogada: ${positionToString(gameState.lastMove.from)} → ${positionToString(gameState.lastMove.to)}`
                    : 'Selecione uma peça.')
          }
          whiteSeconds={whiteClock}
          blackSeconds={blackClock}
          clockActiveColor={clockActive}
          onReset={resetMatch}
          onBackToMenu={backToModeMenu}
          swapControls={
            gameState.gameMode === 'imperial' ? (
              <div className="swap-controls">
                <button
                  type="button"
                  className={`swap-btn ${swapMode ? 'active' : ''}`}
                  onClick={handleSwapMode}
                  disabled={!canSwapButton || gameState.status === 'finished'}
                >
                  {swapMode
                    ? 'Cancelar troca'
                    : gameState.currentTurn === 'white'
                      ? `Troca Rei–Príncipe (brancas): ${gameState.whiteKingSwapped ? 'usada' : 'disponível'}`
                      : `Troca Rei–Príncipe (pretas): ${gameState.blackKingSwapped ? 'usada' : 'disponível'}`}
                </button>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
