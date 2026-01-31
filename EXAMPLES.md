# Exemplos de Uso

## Game Core

### Criar estado inicial
```typescript
import { createInitialState } from '@princefall/game-core';

const state = createInitialState();
// state.status = 'setup'
```

### Setup do general
```typescript
import { applyAction } from '@princefall/game-core';

const action = {
  type: 'SETUP_GENERAL',
  payload: { position: { col: 'E', row: 7 } },
  playerColor: 'white',
};

const newState = applyAction(state, action);
```

### Fazer jogada
```typescript
const moveAction = {
  type: 'MOVE',
  payload: {
    move: {
      from: { col: 'E', row: 9 },
      to: { col: 'E', row: 8 },
    },
  },
  playerColor: 'white',
};

const newState = applyAction(state, moveAction);
```

### Obter movimentos legais
```typescript
import { getLegalMoves } from '@princefall/game-core';

const legalMoves = getLegalMoves(state, { col: 'E', row: 9 });
// Retorna array de Position[]
```

### Serialização
```typescript
import { serializeState, deserializeState } from '@princefall/game-core';

const serialized = serializeState(state);
const restored = deserializeState(serialized);
```

## API REST

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### Criar partida
```bash
curl -X POST http://localhost:3001/api/games \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Entrar em partida
```bash
curl -X POST http://localhost:3001/api/games/GAME_ID/join \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inviteCode": "ABC123"}'
```

### Fazer jogada
```bash
curl -X POST http://localhost:3001/api/games/GAME_ID/moves \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from": {"col": "E", "row": 9},
    "to": {"col": "E", "row": 8},
    "moveNumber": 0
  }'
```

### Obter estado da partida
```bash
curl http://localhost:3001/api/games/GAME_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Leaderboard
```bash
curl http://localhost:3001/api/leaderboard
```

## Validações Anti-Cheat

O servidor valida:

1. **Turno correto**: Apenas o jogador do turno atual pode jogar
2. **Peça pertence ao jogador**: A peça na origem deve ser do jogador
3. **Movimento legal**: O movimento deve estar em `getLegalMoves()`
4. **MoveNumber**: Deve corresponder ao número esperado (previne replay)
5. **Idempotência**: Se moveNumber já existe, retorna estado atual sem duplicar
6. **Transação DB**: Lock na partida previne race conditions
7. **Estado autoritativo**: Servidor sempre reconstrói estado do banco, nunca aceita do cliente

## Testes

### Rodar testes do game-core
```bash
cd packages/game-core
npm test
```

### Exemplo de teste
```typescript
import { createInitialState, applyAction, getLegalMoves } from '@princefall/game-core';

describe('Prince moves', () => {
  it('should move 1 square in any direction', () => {
    const state = createInitialState();
    // ... setup ...
    const moves = getLegalMoves(state, { col: 'E', row: 9 });
    expect(moves.length).toBeGreaterThan(0);
  });
});
```

