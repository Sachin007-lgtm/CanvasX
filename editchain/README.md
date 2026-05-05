# EditChain — AI-Powered SVG Design Canvas

> Generate stunning graphic designs with AI, edit them interactively on a canvas, and track every change with a cryptographic provenance chain.

![EditChain Canvas](https://img.shields.io/badge/status-in%20development-yellow) ![Node](https://img.shields.io/badge/node-v20-green) ![pnpm](https://img.shields.io/badge/pnpm-workspace-blue)

---

## What Is EditChain?

EditChain is a **human-in-the-loop AI design tool**. You describe a graphic in plain English, Gemini AI generates a structured SVG design, and you get a fully editable canvas to tweak every element — colors, text, fonts, opacity — while every edit is recorded in a tamper-evident cryptographic chain for provenance.

### Key Features

- **AI-powered generation** — Gemini Flash generates professional SVG designs from a text prompt with multiple style presets
- **Editable canvas** — Click any element in the generated design to select it and edit its properties in real time
- **Layer panel** — See all AI-annotated elements listed by type and role (headline, shape, background, etc.)
- **Properties panel** — Edit text, fill/stroke color, font size, font weight, and opacity per element
- **Undo** — Revert any edit with a single click
- **Provenance chain** — Every canvas edit is logged as a cryptographically hashed event, forming a Merkle chain for later on-chain minting

---

## Project Structure

```
editchain/
├── apps/
│   ├── api/          # Express + TypeScript backend (Gemini AI, provenance)
│   └── web/          # React + Vite frontend (canvas, layers, properties)
├── packages/
│   └── shared-types/ # Shared TypeScript types (Design, SVGElement, EditEvent…)
├── contracts/        # Solidity smart contracts (NFT minting)
├── .env              # Environment variables (copy from root .env)
└── pnpm-workspace.yaml
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v20+ |
| pnpm | v8+ (`npm i -g pnpm`) |
| Gemini API key | Free at [aistudio.google.com](https://aistudio.google.com) |

### 1. Clone and install

```powershell
cd C:\Users\Shreya\CODING\PRJ-III\editchain
pnpm install
```

If prompted about build scripts for `esbuild`, run:
```powershell
pnpm approve-builds
# Select esbuild → press A → confirm with Y
```

### 2. Set up environment variables

The `.env` file lives at the **project root** (`PRJ-III/.env`). Sync it into the `editchain/` folder before starting:

```powershell
Copy-Item "C:\Users\Shreya\CODING\PRJ-III\.env" "C:\Users\Shreya\CODING\PRJ-III\editchain\.env" -Force
```

> **Do this every time you change the `.env` file.**

Required variables:

```env
GEMINI_API_KEY=AIza...    # From aistudio.google.com → API Keys
PORT=3001
NODE_ENV=development
VITE_API_URL=http://localhost:3001
```

### 3. Run the project

This project uses Turborepo, allowing you to start both the API and the web frontend with a single command from the root `editchain` directory.

Open a terminal:

```powershell
cd C:\Users\Shreya\CODING\PRJ-III\editchain
pnpm run dev
```

This will concurrently start:
- **API Server** on http://localhost:3001
- **Vite Web App** on http://localhost:5173

### 4. Open the app

Navigate to **http://localhost:5173** in your browser.

---

## Usage

1. **Type a prompt** in the top bar — e.g. *"A bold poster for a music festival with neon colors"*
2. **Choose a style** — Minimal, Bold, Editorial, or Playful
3. **Click Generate** — Gemini creates an SVG design (takes ~5–10 seconds)
4. **Click any element** on the canvas or in the **Layers** panel to select it
5. **Edit properties** in the right panel — change text, colors, font size, opacity
6. Use **↩ Undo** in the top bar to revert the last edit
7. The edit counter badge tracks how many provenance events have been recorded

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/generate` | Generate a new SVG design from a prompt |
| `POST` | `/api/generate/:id/edit-ai` | AI-assisted element edit *(DB required)* |
| `POST` | `/api/provenance/event` | Record an edit event in the chain |
| `GET`  | `/api/provenance/:id/chain` | Get full edit chain *(DB required)* |
| `GET`  | `/api/provenance/:id/verify` | Verify chain integrity |
| `POST` | `/api/provenance/:id/finalize` | Compute Merkle root before minting |
| `GET`  | `/health` | Health check |

### Example generate request

```bash
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A minimal SaaS landing hero with headline and CTA button",
    "style": "minimal",
    "width": 800,
    "height": 600
  }'
```

---

## Troubleshooting

### Gemini API 429 — Quota Exceeded

The free tier for `gemini-1.5-flash` has per-minute and per-day limits.

- **Per-minute limit** → wait ~1 minute and retry
- **Per-day limit** → wait until midnight Pacific time (resets daily)
- **Permanent fix** → get a new key at [aistudio.google.com](https://aistudio.google.com) or enable billing

### Gemini API 403 — Forbidden / No API Key

Make sure `GEMINI_API_KEY` is set in `editchain/.env` and restart the API server.

### `Cannot find module './routes/...'`

Remove `.js` extensions from internal imports in `src/index.ts`. `tsx` resolves TypeScript files directly without the extension.

### Port already in use

```powershell
# Kill whatever is on port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI | Gemini Flash (`@google/generative-ai`) |
| API | Express 5, TypeScript, tsx |
| Frontend | React 18, Vite, Zustand, Immer |
| Monorepo | pnpm workspaces, Turborepo |
| Smart Contracts | Solidity (Polygon / Base) |
| IPFS | Pinata |

---

## Roadmap

- [ ] Database persistence (PostgreSQL) for designs and edit chains
- [ ] On-chain minting of designs as NFTs with Merkle proof
- [ ] IPFS storage of full edit chain JSON
- [ ] Wallet connect (MetaMask / WalletConnect)
- [ ] AI-assisted element editing (natural language instructions per element)
- [ ] Export as PNG / SVG download
- [ ] Design gallery and sharing

---

## License

MIT
