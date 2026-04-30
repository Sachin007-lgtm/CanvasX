# EditChain

**AI-powered editable design platform with cryptographic edit provenance.**

## Architecture

```
editchain/
├── apps/
│   ├── web/          # React + Vite frontend (canvas editor)
│   └── api/          # Node.js + Express backend (AI + provenance)
├── packages/
│   └── shared-types/ # TypeScript types shared across apps
└── contracts/        # Solidity smart contracts (Hardhat)
```

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker (for Postgres + Redis)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and other values
```

### 3. Start infrastructure
```bash
docker compose up -d
```

### 4. Run database migrations
```bash
cd apps/api
pnpm prisma migrate dev
```

### 5. Start all services
```bash
pnpm dev  # runs both web + api via Turborepo
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/services/svgGenerator.service.ts` | AI prompt → structured SVG |
| `apps/api/src/services/editChain.service.ts` | Merkle tree provenance (novel) |
| `apps/web/src/store/designStore.ts` | Canvas state management |
| `apps/web/src/store/editChainStore.ts` | Edit event accumulation |
| `contracts/EditChainNFT.sol` | On-chain provenance + ERC-721 |
| `packages/shared-types/design.ts` | Core data model |

## Research Contribution

The core novelty is **element-level edit provenance**:
1. Every canvas edit creates an `EditEvent` with a pointer to the previous event's hash
2. The chain of events forms a Merkle tree
3. The Merkle root is stored on-chain at mint time
4. Anyone can verify a single edit event without downloading the full chain (Merkle proof)

This is distinct from existing work which only hashes the final output.

## Next Steps

- [ ] Connect Prisma DB to routes
- [ ] Add Fabric.js canvas editor component
- [ ] Implement IPFS upload via Pinata
- [ ] Deploy contracts to Polygon Mumbai testnet
- [ ] Add wallet connection (wagmi + RainbowKit)
- [ ] User study for research paper
