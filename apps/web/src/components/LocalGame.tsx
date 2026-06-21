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
  serializeState,
} from '@princefall/game-core';
import {
  chooseBestComputerMove,
  chooseComputerGeneralPosition,
  formatMoveDescription,
  type AiDifficulty,
} from '@princefall/game-ai';
import { api } from '../api';
import { ModeSelectionScreen, LocalPlayChoice } from './game/ModeSelectionScreen';
import { OpponentSelectionScreen } from './game/OpponentSelectionScreen';
import { ColorSelectionScreen } from './game/ColorSelectionScreen';
import { DifficultySelectionScreen, aiDifficultyLabel } from './game/DifficultySelectionScreen';
import { SetupScreen } from './game/SetupScreen';
import { CoinflipScreen } from './game/CoinflipScreen';
import { LocalChessBoard } from './game/LocalChessBoard';
import { LocalGameSidePanel } from './game/LocalGameSidePanel';
import { pieceLabelPt } from './game/pieceLabels';
import './game/GameStyles.css';

/** 10 minutos por lado (imperial e tradicional no local). */
const MATCH_CLOCK_SECONDS = 600;

type OpponentMode = 'twoPlayers' | 'computer';
type ImperialFlowStep = 'opponent' | 'color' | 'difficulty' | 'playing';

function createImperialStateForComputer(humanColor: 'white' | 'black'): GameState {
  let state = createImperialInitialState();

  if (humanColor === 'black') {
    const whitePos = chooseComputerGeneralPosition('white');
    state = applyAction(state, {
      type: 'SETUP_GENERAL',
      payload: { position: whitePos },
      playerColor: 'white',
    });
  }

  return state;
}

export function LocalGame({ onBack, token }: { onBack: () => void; token?: string | null }) {
  const [menu, setMenu] = useState(true);
  const [lastMode, setLastMode] = useState<LocalPlayChoice>('imperial');
  const [imperialFlowStep, setImperialFlowStep] = useState<ImperialFlowStep>('opponent');
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('twoPlayers');
  const [humanColor, setHumanColor] = useState<'white' | 'black'>('white');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('medium');
  const [gameState, setGameState] = useState<GameState>(createImperialInitialState());
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [message, setMessage] = useState('');
  const [computerThinking, setComputerThinking] = useState(false);

  const [whiteClock, setWhiteClock] = useState(MATCH_CLOCK_SECONDS);
  const [blackClock, setBlackClock] = useState(MATCH_CLOCK_SECONDS);
  const forfeitRef = useRef(false);
  const stateRef = useRef(gameState);
  const computerThinkingRef = useRef(false);
  const computerGameSavedRef = useRef(false);
  stateRef.current = gameState;

  const computerColor: 'white' | 'black' = humanColor === 'white' ? 'black' : 'white';

  const resetClocks = useCallback(() => {
    setWhiteClock(MATCH_CLOCK_SECONDS);
    setBlackClock(MATCH_CLOCK_SECONDS);
    forfeitRef.current = false;
  }, []);

  const updateTurnStatus = useCallback(
    (state: GameState) => {
      if (state.status === 'finished') {
        return;
      }

      if (opponentMode === 'computer' && state.status === 'playing') {
        if (state.currentTurn === humanColor) {
          const colorText = humanColor === 'white' ? 'branca' : 'preta';
          setMessage(`Sua vez. Selecione uma peca ${colorText}.`);
        } else {
          setMessage('Computador pensando...');
        }
        return;
      }

      if (state.status === 'playing') {
        const colorText = state.currentTurn === 'white' ? 'branca' : 'preta';
        setMessage(`Selecione uma peca ${colorText} para mover.`);
      }
    },
    [humanColor, opponentMode]
  );

  const maybeTriggerComputerMove = useCallback(
    (state: GameState) => {
      if (opponentMode !== 'computer') {
        return;
      }
      if (state.status !== 'playing') {
        return;
      }
      if (state.currentTurn !== computerColor) {
        return;
      }
      if (computerThinkingRef.current) {
        return;
      }

      computerThinkingRef.current = true;
      setComputerThinking(true);
      setMessage('Computador pensando...');

      const thinkDelay = aiDifficulty === 'hard' ? 900 : aiDifficulty === 'medium' ? 700 : 500;

      window.setTimeout(() => {
        const currentState = stateRef.current;

        if (
          currentState.status !== 'playing' ||
          currentState.currentTurn !== computerColor ||
          opponentMode !== 'computer'
        ) {
          computerThinkingRef.current = false;
          setComputerThinking(false);
          return;
        }

        const move = chooseBestComputerMove(
          currentState,
          computerColor,
          humanColor,
          aiDifficulty
        );

        if (!move) {
          setMessage('Computador nao possui movimentos validos.');
          computerThinkingRef.current = false;
          setComputerThinking(false);
          return;
        }

        const newState = applyAction(currentState, {
          type: 'MOVE',
          payload: { move },
          playerColor: computerColor,
        });

        setGameState(newState);
        setSelectedPos(null);

        if (newState.status === 'finished') {
          setMessage('Fim de jogo.');
        } else {
          const colorText = humanColor === 'white' ? 'branca' : 'preta';
          setMessage(
            `Computador moveu ${formatMoveDescription(move)}. Sua vez — selecione uma peca ${colorText}.`
          );
        }

        computerThinkingRef.current = false;
        setComputerThinking(false);
      }, thinkDelay);
    },
    [aiDifficulty, computerColor, humanColor, opponentMode]
  );

  const startMode = useCallback(
    (mode: LocalPlayChoice) => {
      setLastMode(mode);
      setMenu(false);
      setSelectedPos(null);
      setSwapMode(false);
      forfeitRef.current = false;
      computerThinkingRef.current = false;
      setComputerThinking(false);
      computerGameSavedRef.current = false;

      if (mode === 'traditional') {
        setOpponentMode('twoPlayers');
        setImperialFlowStep('playing');
        setGameState(createTraditionalInitialState());
        setMessage('Clique numa peca branca para comecar.');
        resetClocks();
        return;
      }

      setImperialFlowStep('opponent');
      setMessage('');
      resetClocks();
    },
    [resetClocks]
  );

  const startTwoPlayersImperial = useCallback(() => {
    setOpponentMode('twoPlayers');
    setImperialFlowStep('playing');
    setGameState(createImperialInitialState());
    setMessage('');
    setSelectedPos(null);
    setSwapMode(false);
  }, []);

  const startComputerMode = useCallback(() => {
    setOpponentMode('computer');
    setImperialFlowStep('color');
  }, []);

  const beginComputerGame = useCallback(
    (color: 'white' | 'black', difficulty: AiDifficulty) => {
      setHumanColor(color);
      setAiDifficulty(difficulty);
      setImperialFlowStep('playing');
      setGameState(
        color === 'black' ? createImperialStateForComputer('black') : createImperialInitialState()
      );
      setMessage(
        color === 'white'
          ? 'Brancas: escolham a posicao do General na linha 7.'
          : 'Pretas: escolham a posicao do General na linha 3.'
      );
      setSelectedPos(null);
      setSwapMode(false);
    },
    []
  );

  const startComputerAsWhite = useCallback(() => {
    setHumanColor('white');
    setImperialFlowStep('difficulty');
  }, []);

  const startComputerAsBlack = useCallback(() => {
    setHumanColor('black');
    setImperialFlowStep('difficulty');
  }, []);

  const backToModeMenu = useCallback(() => {
    setMenu(true);
    setSelectedPos(null);
    setSwapMode(false);
    setMessage('');
    setImperialFlowStep('opponent');
    setOpponentMode('twoPlayers');
    setHumanColor('white');
    setAiDifficulty('medium');
    computerThinkingRef.current = false;
    setComputerThinking(false);
    computerGameSavedRef.current = false;
    setGameState(createImperialInitialState());
    resetClocks();
  }, [resetClocks]);

  const resetMatch = useCallback(() => {
    setSelectedPos(null);
    setSwapMode(false);
    forfeitRef.current = false;
    computerThinkingRef.current = false;
    setComputerThinking(false);
    computerGameSavedRef.current = false;
    resetClocks();

    if (lastMode === 'traditional') {
      setGameState(createTraditionalInitialState());
      setMessage('Partida reiniciada. Vez das Brancas.');
      return;
    }

    if (opponentMode === 'computer') {
      setGameState(createImperialStateForComputer(humanColor));
      setMessage(
        humanColor === 'white'
          ? 'Brancas: escolham a posicao do General na linha 7.'
          : 'Pretas: escolham a posicao do General na linha 3.'
      );
      return;
    }

    setGameState(createImperialInitialState());
    setMessage('');
  }, [humanColor, lastMode, opponentMode, resetClocks]);

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
    if (computerThinking) {
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
  }, [clockedModes, computerThinking, gameState.status, gameState.gameMode, gameState.moveNumber]);

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

  useEffect(() => {
    if (opponentMode !== 'computer') {
      return;
    }
    if (gameState.status !== 'finished') {
      return;
    }
    if (!token) {
      return;
    }
    if (computerGameSavedRef.current) {
      return;
    }

    computerGameSavedRef.current = true;

    (async () => {
      try {
        await api.post(
          '/games/vs-computer',
          {
            humanColor,
            gameState: serializeState(gameState),
            whiteTimeMs: whiteClock * 1000,
            blackTimeMs: blackClock * 1000,
          },
          { token }
        );
        setMessage('Fim de jogo. Partida salva no historico.');
      } catch (err) {
        computerGameSavedRef.current = false;
        console.error('Erro ao salvar partida vs computador:', err);
        setMessage('Fim de jogo. Nao foi possivel salvar a partida.');
      }
    })();
  }, [
    opponentMode,
    gameState.status,
    token,
    humanColor,
    gameState,
    whiteClock,
    blackClock,
  ]);

  const handleSetupWhite = (pos: Position) => {
    let nextState = applyAction(gameState, {
      type: 'SETUP_GENERAL',
      payload: { position: pos },
      playerColor: 'white',
    });

    if (opponentMode === 'computer') {
      const blackPos = chooseComputerGeneralPosition('black');
      nextState = applyAction(nextState, {
        type: 'SETUP_GENERAL',
        payload: { position: blackPos },
        playerColor: 'black',
      });
    } else {
      setMessage('Pretas: escolham a posicao do General na linha 3.');
    }

    setGameState(nextState);

    if (opponentMode === 'computer') {
      setMessage('Cara ou coroa para definir quem comeca.');
    }
  };

  const handleSetupBlack = (pos: Position) => {
    const nextState = applyAction(gameState, {
      type: 'SETUP_GENERAL',
      payload: { position: pos },
      playerColor: 'black',
    });
    setGameState(nextState);
    setMessage('Cara ou coroa para definir quem comeca.');
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
    const nextState = applyAction(gameState, { type: 'BEGIN_PLAYING' });
    setGameState(nextState);
    updateTurnStatus(nextState);
    maybeTriggerComputerMove(nextState);
  };

  const handleCellClick = (pos: Position) => {
    if (gameState.status !== 'playing') {
      return;
    }

    if (computerThinking) {
      setMessage('Aguarde a jogada do computador.');
      return;
    }

    if (opponentMode === 'computer' && gameState.currentTurn === computerColor) {
      setMessage('Aguarde a jogada do computador.');
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
        setMessage('Movimento invalido.');
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

      updateTurnStatus(newState);
      maybeTriggerComputerMove(newState);
      return;
    }

    const piece = gameState.board.get(positionToString(pos));
    if (!piece) {
      setMessage('Casa vazia.');
      return;
    }

    if (opponentMode === 'computer' && piece.color === computerColor) {
      setMessage('Essa peca e do computador.');
      return;
    }

    if (piece.color !== gameState.currentTurn) {
      if (opponentMode === 'computer') {
        setMessage('Aguarde a jogada do computador.');
      } else {
        setMessage('Nao e o seu turno.');
      }
      return;
    }

    setSelectedPos(pos);
    setMessage(`Peca selecionada: ${positionToString(pos)}`);
  };

  const handleSwapClick = (pos: Position) => {
    if (!selectedPos) {
      return;
    }

    if (computerThinking || (opponentMode === 'computer' && gameState.currentTurn === computerColor)) {
      setMessage('Aguarde a jogada do computador.');
      return;
    }

    const piece1 = gameState.board.get(positionToString(selectedPos));
    const piece2 = gameState.board.get(positionToString(pos));

    if (!piece1 || !piece2) {
      setSelectedPos(null);
      setSwapMode(false);
      setMessage('Selecao cancelada.');
      return;
    }

    const isKingAndPrince =
      ((piece1.type === 'king' && piece2.type === 'prince') ||
        (piece1.type === 'prince' && piece2.type === 'king')) &&
      piece1.color === piece2.color &&
      piece1.color === gameState.currentTurn;

    if (!isKingAndPrince) {
      setMessage('Selecione o Rei e a Princesa do mesmo jogador.');
      setSelectedPos(null);
      setSwapMode(false);
      return;
    }

    const canSwap =
      gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped;

    if (!canSwap) {
      setMessage('Esta troca ja foi usada neste jogo.');
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
    updateTurnStatus(newState);
    maybeTriggerComputerMove(newState);
  };

  const handleSwapMode = () => {
    if (gameState.gameMode !== 'imperial' || gameState.status !== 'playing') {
      return;
    }

    if (computerThinking || (opponentMode === 'computer' && gameState.currentTurn === computerColor)) {
      setMessage('Aguarde a jogada do computador.');
      return;
    }

    const canSwap =
      gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped;

    if (!canSwap) {
      setMessage('Esta troca ja foi usada neste jogo.');
      return;
    }

    setSwapMode(v => !v);
    setSelectedPos(null);
  };

  const piece = selectedPos ? gameState.board.get(positionToString(selectedPos)) : null;
  const canSwapButton =
    gameState.gameMode === 'imperial' &&
    gameState.status === 'playing' &&
    (gameState.currentTurn === 'white' ? !gameState.whiteKingSwapped : !gameState.blackKingSwapped) &&
    !(opponentMode === 'computer' && gameState.currentTurn === computerColor);

  const legalMoves =
    selectedPos && !swapMode && gameState.status === 'playing' && !computerThinking
      ? getLegalMoves(gameState, selectedPos)
      : [];

  const clockActive: 'white' | 'black' | null =
    clockedModes &&
    gameState.status === 'playing' &&
    gameState.moveNumber >= 1 &&
    !forfeitRef.current &&
    !computerThinking
      ? gameState.currentTurn
      : null;

  if (menu) {
    return (
      <ModeSelectionScreen
        onSelectMode={startMode}
        onBack={() => {
          onBack();
        }}
        offline
      />
    );
  }

  if (lastMode === 'imperial' && imperialFlowStep === 'opponent') {
    return (
      <OpponentSelectionScreen
        onSelectTwoPlayers={startTwoPlayersImperial}
        onSelectComputer={startComputerMode}
        onBack={backToModeMenu}
      />
    );
  }

  if (lastMode === 'imperial' && imperialFlowStep === 'difficulty') {
    return (
      <DifficultySelectionScreen
        onSelect={level => beginComputerGame(humanColor, level)}
        onBack={() => setImperialFlowStep('color')}
      />
    );
  }

  if (lastMode === 'imperial' && imperialFlowStep === 'color') {
    return (
      <ColorSelectionScreen
        onSelectWhite={startComputerAsWhite}
        onSelectBlack={startComputerAsBlack}
        onBack={() => setImperialFlowStep('opponent')}
      />
    );
  }

  if (lastMode === 'imperial' && gameState.status === 'setup') {
    const nextSetupColor = !gameState.whiteGeneralPosition ? 'white' : 'black';
    const playerColor =
      opponentMode === 'computer' ? humanColor : nextSetupColor;

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

      <h1 className="game-play-title">
        {gameState.gameMode === 'imperial' ? 'XADREZ IMPERIAL' : 'XADREZ TRADICIONAL'}
        {opponentMode === 'computer' && (
          <span className="game-mode-badge">
            vs Computador ({aiDifficultyLabel(aiDifficulty)})
          </span>
        )}
      </h1>

      <div className="game-layout game-layout-stacked">
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
              ? 'Modo troca: toque no Rei e na Princesa do mesmo lado.'
              : message ||
                (piece
                  ? `Peca selecionada: ${positionToString(selectedPos!)} (${pieceLabelPt(piece.type)})`
                  : gameState.lastMove
                    ? `Ultima jogada: ${positionToString(gameState.lastMove.from)} → ${positionToString(gameState.lastMove.to)}`
                    : opponentMode === 'computer'
                      ? `Sua vez. Selecione uma peca ${humanColor === 'white' ? 'branca' : 'preta'}.`
                      : 'Selecione uma peca.')
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
                  disabled={!canSwapButton || gameState.status === 'finished' || computerThinking}
                >
                  {swapMode
                    ? 'Cancelar troca'
                    : gameState.currentTurn === 'white'
                      ? `Troca Rei–Princesa (brancas): ${gameState.whiteKingSwapped ? 'usada' : 'disponivel'}`
                      : `Troca Rei–Princesa (pretas): ${gameState.blackKingSwapped ? 'usada' : 'disponivel'}`}
                </button>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
