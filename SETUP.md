# Setup do Projeto

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

## Instalação

1. Instalar dependências:
```bash
npm install
```

2. Configurar banco de dados:
```bash
cd apps/server
cp .env.example .env
# Editar .env com suas credenciais do Postgres
```

3. Rodar migrações:
```bash
cd apps/server
npm run db:generate
npm run db:migrate
```

## Desenvolvimento

### Rodar tudo (monorepo):
```bash
npm run dev
```

### Rodar apenas servidor:
```bash
cd apps/server
npm run dev
```

### Rodar apenas frontend:
```bash
cd apps/web
npm run dev
```

## Testes

```bash
npm run test
```

## Build

```bash
npm run build
```

## Estrutura de URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

