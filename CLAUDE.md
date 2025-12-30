# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyMessage is a local-only iMessage archive viewer for macOS built with Electron, React, and SQLite. It reads from a local database copy (`data/chat.db`) in read-only mode.

## Development Commands

```bash
# Install dependencies
npm install

# Rebuild native modules for Electron (required after install or Electron update)
npx @electron/rebuild

# Development (starts Vite + Electron together)
npm run dev

# Production build + launch
npm run app          # Build everything, then launch Electron

# Lint
npm run lint
```

## Architecture

**Two-process Electron app with domain-based backend organization:**

```
backend/           → Electron main process (CommonJS, compiles to dist-app/)
├── main.ts        → Window creation, app lifecycle
├── preload.ts     → IPC bridge via contextBridge
├── database/      → SQLite connection, timestamp conversion
├── conversations/ → IPC handlers for conversation queries
├── messages/      → IPC handlers for message queries
├── search/        → FTS5 search index service
└── attachments/   → attachment:// protocol handler

src/               → React renderer (ESM, compiles to dist/)
├── components/    → React components + shadcn/ui
├── hooks/         → Data fetching hooks (useConversations, useMessages, useSearch)
└── types/         → Shared types + window.electronAPI declaration
```

**Key constraints:**
- Backend uses CommonJS (`backend/tsconfig.json` → `dist-app/`)
- Renderer uses ESM with `@/` path alias (`src/*`)
- Database is read-only - no mutations
- All renderer ↔ main communication via typed IPC in `preload.ts`

## IPC Pattern

Backend handlers registered in domain `handlers.ts` files:
```typescript
// backend/conversations/handlers.ts
ipcMain.handle("db:get-conversations", async (_, options) => { ... })
```

Frontend calls via `window.electronAPI`:
```typescript
// Defined in backend/preload.ts, typed in src/types/electron.d.ts
const result = await window.electronAPI.getConversations({ limit: 50 })
```

## Database

Reads from `data/chat.db` (an iMessage database copy). Apple timestamps require conversion:
```typescript
// Apple: nanoseconds since 2001-01-01
// JS: milliseconds since 1970-01-01
const APPLE_EPOCH_OFFSET_MS = 978307200000;
const jsTimestamp = Math.floor(appleDate / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
```

Setup (both gitignored):
```bash
cp ~/Library/Messages/chat.db ./data/chat.db
cp -r ~/Library/Messages/Attachments ./data/attachments
```

## Attachments

Uses custom `attachment://` protocol to serve media files from `data/attachments/`. Protocol registered in `backend/attachments/protocol.ts`.
