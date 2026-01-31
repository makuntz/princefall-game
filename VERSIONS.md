# Roadmap de Versões

## V1: Jogo Online Assíncrono ✅

**Funcionalidades:**
- ✅ Login (magic link simplificado)
- ✅ Criar partidas com código de convite
- ✅ Jogar partidas assíncronas (polling)
- ✅ Ranking/ELO (atualizado ao final da partida)
- ✅ Anti-cheat (servidor autoritativo)
- ✅ Validação de jogadas no servidor

**Stack:**
- Monorepo TypeScript
- Frontend: React + Vite
- Backend: Fastify + Postgres + Prisma
- Game Core: TypeScript puro (sem dependências)

**Status:** Implementado e pronto para testes

## V2: IA (Jogar contra Máquina)

**Funcionalidades:**
- Implementar `BotPlayer` em `packages/game-ai`
- Níveis: Easy, Medium, Hard
- Endpoint: `POST /api/games/ai` (criar partida contra bot)
- Servidor processa jogadas do bot automaticamente
- UI não muda (bot é transparente)

**Implementação:**
1. Criar `packages/game-ai/src/bots/`:
   - `RandomBot` (Easy): Movimentos aleatórios legais
   - `MinimaxBot` (Medium): Minimax depth 2-3
   - `AdvancedBot` (Hard): Minimax + alpha-beta pruning depth 4-6

2. No servidor:
   - Adicionar `GameService.createAIGame(userId, botLevel)`
   - Processar jogada do bot após jogada do jogador
   - Usar `BotPlayer.chooseMove()` para decidir movimento

3. No frontend:
   - Adicionar botão "Jogar contra IA" na criação de partida
   - Selecionar nível de dificuldade

**Status:** Interfaces preparadas, implementação pendente

## V3: Multiplayer em Tempo Real

**Funcionalidades:**
- WebSocket para atualizações em tempo real
- Matchmaking automático
- Reconexão automática
- Notificações push (opcional)

**Arquitetura:**

### WebSocket Gateway
```typescript
// apps/server/src/websocket/gateway.ts
fastify.register(async function (fastify) {
  fastify.get('/ws/:gameId', { websocket: true }, (connection, req) => {
    const gameId = req.params.gameId;
    // Join room
    // Enviar estado atual
    // Escutar eventos
  });
});
```

### Eventos
- `game:move` - Nova jogada
- `game:status` - Mudança de status
- `game:setup` - Setup do general
- `game:error` - Erro na jogada

### Matchmaking
```typescript
// apps/server/src/services/MatchmakingService.ts
class MatchmakingService {
  async queuePlayer(userId: string, rating: number) {
    // Adicionar à fila
    // Procurar match (rating ± 100)
    // Criar partida automaticamente
  }
}
```

### Mudanças no Frontend
- Substituir polling por WebSocket
- Reconexão automática com exponential backoff
- Sincronização com último `moveNumber` na reconexão

**Status:** Design preparado, implementação pendente

## Evolução Futura

- **V4:** Torneios e campeonatos
- **V5:** Análise de partidas (replay, análise de jogadas)
- **V6:** Variantes de regras (configuráveis)
- **V7:** Mobile app (Expo/React Native)

