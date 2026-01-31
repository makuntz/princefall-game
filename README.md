# PrinceFall Game

Jogo de xadrez customizado 9x9 com suporte a multiplayer assíncrono, IA e real-time.

## Arquitetura

### Apps
- `apps/web`: Frontend React (Web)
- `apps/server`: Backend Node.js (Fastify) + Postgres
- `apps/mobile`: Mobile app (Expo) - futuro

### Packages
- `packages/game-core`: Engine pura do jogo (TypeScript, sem dependências)
- `packages/game-ai`: IA para jogar contra máquina (V2)
- `packages/shared`: Tipos e utilitários compartilhados

## Versões

- **V1**: Jogo online assíncrono + login + ranking/elo + anti-cheat
- **V2**: IA com níveis (sem mexer na UI)
- **V3**: Multiplayer em tempo real (websocket) e matchmaking

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build
npm run build

# Testes
npm run test
```

