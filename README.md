# Holos

SaaS multi-negocio para pymes: ventas, stock, clientes, equipo, gastos y facturación en una sola app (Next.js + Prisma + PostgreSQL).

## Stack
- Next.js 16 (App Router), TypeScript, React 19
- Prisma + PostgreSQL, auth con cookies HTTP-only
- Vitest (validaciones de dominio)
- Mercado Pago (planes) y ARCA/WSFE (fiscal, con modo mock)

## Setup
```bash
cp .env.example .env
# completar DATABASE_URL y AUTH_SECRET
npm install
npx prisma migrate dev
npm run dev
```

## Scripts
`npm test` · `npm run typecheck` · `npm run lint`

## Roadmap
Ver [docs/ROADMAP.md](docs/ROADMAP.md).
