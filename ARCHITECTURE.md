# Arquitetura PrinceFall Game

## Estrutura do Monorepo

```
princefall-game/
├── apps/
│   ├── web/              # Frontend React (V1: Web, futuro: Mobile)
│   ├── server/           # Backend Node.js + Fastify + Postgres
│   └── mobile/           # Mobile app Expo (futuro)
├── packages/
│   ├── game-core/        # Engine pura do jogo (TypeScript, sem dependências)
│   ├── game-ai/           # IA para jogar contra máquina (V2)
│   └── shared/            # Tipos e utilitários compartilhados
├── package.json           # Root workspace
└── turbo.json            # Configuração Turbo
```

## Packages

### `@princefall/game-core`
Engine pura do jogo, 100% TypeScript, sem dependências de React/DOM/Node.

**Responsabilidades:**
- Representar tabuleiro 9x9 (colunas A..I, linhas 1..9)
- Representar peças e movimentos (incluindo peças customizadas)
- Funções puras: `getLegalMoves`, `applyMove`, `isGameOver`
- Serialização/deserialização JSON
- Operar como reducer/event-driven: UI envia Actions e core retorna novo GameState imutável
- Determinístico e facilmente testável

**Estrutura:**
- `types.ts`: Tipos principais (GameState, Piece, Move, etc.)
- `utils/position.ts`: Utilitários de posição
- `pieces/index.ts`: Lógica de movimentos por peça
- `reducer/index.ts`: Reducer principal (createInitialState, applyAction)
- `serialization.ts`: Serialização JSON

### `@princefall/game-ai` (V2)
Interface e implementações de bots.

**Interface:**
```typescript
interface BotPlayer {
  chooseMove(state: GameState, playerColor: Color): MoveIntent | null;
  level: 'easy' | 'medium' | 'hard';
  name: string;
}
```

**Evolução V2:**
- Easy: Movimentos aleatórios legais
- Medium: Minimax básico (depth 2-3)
- Hard: Minimax com alpha-beta pruning (depth 4-6) + avaliação de posição

### `@princefall/shared`
Tipos compartilhados entre client e server.

### `@princefall/server`
Backend autoritativo com validações anti-cheat.

**Stack:**
- Fastify (HTTP server)
- Prisma (ORM)
- Postgres (banco de dados)
- JWT (autenticação)

**Validações Anti-Cheat:**
1. Nunca aceitar board/state do cliente como verdade
2. Aceitar apenas: `(gameId, playerId, moveNumber, from, to)`
3. Validar turno correto
4. Validar que peça pertence ao jogador
5. Validar movimento legal usando `game-core`
6. Transação DB com lock/version para prevenir race conditions
7. Idempotência: se moveNumber já existe, retornar estado atual
8. Atualizar rating somente quando status muda para `finished`

**Endpoints REST:**
- `POST /api/auth/login` - Login (magic link simplificado)
- `GET /api/auth/me` - Obter usuário atual
- `POST /api/games` - Criar partida
- `POST /api/games/:id/join` - Entrar em partida (invite code)
- `GET /api/games/:id` - Obter estado da partida
- `POST /api/games/:id/setup` - Setup do general
- `POST /api/games/:id/moves` - Fazer jogada
- `GET /api/games` - Listar partidas do usuário
- `GET /api/leaderboard` - Ranking

**Modelo de Dados (Postgres):**
- `User`: Usuários
- `AuthIdentity`: Identidades OAuth (Google, etc.)
- `Game`: Partidas
- `GameMove`: Histórico de jogadas
- `Rating`: Elo/Glicko dos jogadores

### `@princefall/web`
Frontend React para Web.

**Stack:**
- React 18
- Vite (build tool)
- TypeScript

**Componentes:**
- `Login`: Tela de login
- `GameList`: Lista de partidas
- `GameBoard`: Tabuleiro do jogo

## Evolução para V2 (IA)

1. Implementar `BotPlayer` em `packages/game-ai`
2. No servidor, criar endpoint para partida contra IA:
   - `POST /api/games/ai` - Criar partida contra bot
   - Servidor processa jogadas do bot automaticamente
3. No frontend, adicionar opção "Jogar contra IA" na criação de partida
4. UI não precisa mudar: bot é transparente (jogadas processadas no servidor)

## Evolução para V3 (Real-time)

**Arquitetura:**
1. **WebSocket Gateway** (Fastify + `@fastify/websocket`)
   - Conexão persistente por jogador
   - Room por partida (`game:${gameId}`)

2. **Event System:**
   - `game:move` - Nova jogada
   - `game:status` - Mudança de status
   - `game:setup` - Setup do general

3. **Pub/Sub:**
   - Redis para pub/sub entre instâncias (se necessário)
   - Ou usar WebSocket rooms do Fastify

4. **Reconexão:**
   - Cliente reconecta automaticamente
   - Servidor envia estado completo na reconexão
   - Cliente sincroniza com último `moveNumber`

5. **Matchmaking:**
   - Fila de matchmaking (Redis ou DB)
   - Algoritmo de matching por rating
   - Criar partida automaticamente quando encontrar match

**Mudanças no código:**
- Adicionar `apps/server/src/websocket/` com gateway
- Frontend: substituir polling por WebSocket
- Manter REST para operações não-real-time (criar partida, histórico)

## Testes

**game-core:**
- Testes unitários para movimentos de peças
- Testes de regras (game over, setup, etc.)
- Testes determinísticos (mesmo input = mesmo output)

**server:**
- Testes de integração para endpoints
- Testes de validação anti-cheat
- Testes de rating/elo

## Deploy

**V1 (Assíncrono):**
- Server: Node.js em VPS/Cloud (Railway, Render, etc.)
- DB: Postgres gerenciado (Supabase, Neon, etc.)
- Frontend: Vercel/Netlify

**V3 (Real-time):**
- Considerar Redis para pub/sub se múltiplas instâncias
- WebSocket suporta horizontal scaling com sticky sessions ou Redis adapter

