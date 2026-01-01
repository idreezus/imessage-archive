# iMessage Archive

A local-only iMessage archive viewer for macOS. Browse your iMessage conversations outside of Apple's Messages app with better search and long-term storage capabilities.

## Overview

iMessage Archive reads from a local iMessage database copy (`data/chat.db`) and displays conversations in a clean, iMessage-like interface. All data stays local—nothing is sent to any server.

### Why?

Apple's Messages app has limitations:

- Poor search functionality
- No export options
- Tied to Apple's ecosystem
- Limited long-term storage management

iMessage Archive provides an open-source alternative for viewing and navigating your message history.

## Features (MVP)

- **Conversation List**: Browse all your iMessage and SMS conversations
- **Message Thread View**: Read full message history with proper timestamps
- **iMessage-style UI**: Blue bubbles for iMessage, green for SMS
- **Group Chat Support**: View group conversations with participant names
- **Reactions (Tapbacks)**: View reactions on messages with proper attribution
- **Attachments**: View images, videos, and other media inline
- **Full-Text Search**: Search across all your messages with highlighted snippets
- **Infinite Scroll**: Lazy-load older messages and conversations
- **Native macOS Look**: Hidden title bar with traffic light buttons
- **Fast Performance**: Desktop-quality speed (~15ms conversation opens)

### Out of Scope (Future)

- Import wizard / database picker
- Message deduplication
- Contact name resolution (currently shows phone/email)
- Export functionality

## Tech Stack

| Layer     | Technology                         |
| --------- | ---------------------------------- |
| Framework | Electron 39                        |
| Frontend  | React 19, TypeScript               |
| Styling   | Tailwind CSS v4, shadcn/ui (Radix) |
| Database  | SQLite via better-sqlite3          |
| Build     | Vite 7, TypeScript                 |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   main.ts       │    │   Domain Modules                │ │
│  │   - Window      │───▶│   - conversations/              │ │
│  │   - Lifecycle   │    │   - messages/                   │ │
│  └─────────────────┘    │   - search/                     │ │
│           │             │   - attachments/                │ │
│           │             └─────────────────────────────────┘ │
│           │ IPC (invoke/handle)                             │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │   preload.ts    │  contextBridge.exposeInMainWorld      │
│  │   - API bridge  │──────────────────────────────────────┐ │
│  └─────────────────┘                                      │ │
└───────────────────────────────────────────────────────────│─┘
                                                            │
┌───────────────────────────────────────────────────────────│─┐
│                     Electron Renderer Process             │ │
│                                                           ▼ │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   React App     │    │   window.electronAPI            │ │
│  │   - Components  │◀──▶│   - getConversations()          │ │
│  │   - Hooks       │    │   - getMessages()               │ │
│  └─────────────────┘    │   - search()                    │ │
│                         └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Security Model

- `contextIsolation: true` - Renderer has no direct Node.js access
- `nodeIntegration: false` - No require() in renderer
- Database opened in **read-only mode** - Cannot modify your messages
- IPC bridge exposes only specific, typed methods

## Project Structure

```
imessage-archive/
├── backend/                     # Electron main process (CommonJS)
│   ├── main.ts                  # App entry, window, lifecycle
│   ├── preload.ts               # IPC bridge via contextBridge
│   ├── tsconfig.json            # TypeScript config (CommonJS output)
│   ├── database/                # Database connection utilities
│   │   ├── connection.ts        # SQLite singleton
│   │   └── timestamps.ts        # Apple timestamp conversion
│   ├── conversations/           # Conversation domain
│   │   ├── types.ts
│   │   ├── queries.ts
│   │   └── handlers.ts          # IPC: db:get-conversations
│   ├── messages/                # Message domain
│   │   ├── types.ts
│   │   ├── queries.ts
│   │   ├── reactions.ts
│   │   └── handlers.ts          # IPC: db:get-messages
│   ├── search/                  # Search domain
│   │   ├── types.ts
│   │   ├── service.ts           # FTS5 index
│   │   ├── snippets.ts
│   │   └── handlers.ts          # IPC: search:query
│   ├── attachments/             # Attachment domain
│   │   ├── types.ts
│   │   ├── queries.ts
│   │   ├── protocol.ts          # attachment:// protocol
│   │   └── handlers.ts
│   └── shared/
│       └── paths.ts             # Database/index paths
│
├── src/                         # React renderer (ES Modules)
│   ├── App.tsx                  # Root component
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Tailwind + theme styles
│   ├── components/
│   │   ├── app-layout.tsx       # Sidebar + content layout
│   │   ├── conversation-list.tsx
│   │   ├── message-thread.tsx
│   │   └── ui/                  # shadcn components
│   ├── hooks/
│   │   ├── use-conversations.ts
│   │   ├── use-messages.ts
│   │   └── use-search.ts
│   └── types/
│       ├── index.ts             # Shared types
│       └── electron.d.ts        # Window.electronAPI types
│
├── dist/                        # Vite build output (renderer)
├── dist-app/                    # TypeScript build output (backend)
│   └── package.json             # Forces CommonJS in ESM project
│
├── data/
│   └── chat.db                  # Development database (gitignored)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Database Schema

iMessage Archive reads from macOS's native iMessage database. Key tables:

### `handle` - Contacts

| Column  | Description                          |
| ------- | ------------------------------------ |
| ROWID   | Primary key                          |
| id      | Phone number (+15551234567) or email |
| service | "iMessage" or "SMS"                  |

### `chat` - Conversations

| Column          | Description                               |
| --------------- | ----------------------------------------- |
| ROWID           | Primary key                               |
| guid            | Unique identifier                         |
| chat_identifier | Primary identifier (phone/email/group ID) |
| display_name    | User-set name (NULL for DMs)              |
| style           | 43 = group chat, 45 = individual DM       |

### `message` - Messages

| Column     | Description                               |
| ---------- | ----------------------------------------- |
| ROWID      | Primary key                               |
| guid       | Unique identifier                         |
| text       | Message content (NULL if attachment-only) |
| handle_id  | FK to handle.ROWID (NULL if is_from_me)   |
| date       | Timestamp (Apple format, see below)       |
| is_from_me | 1 = sent, 0 = received                    |
| service    | "iMessage" or "SMS"                       |

### `chat_message_join` - Links messages to chats

| Column     | Description         |
| ---------- | ------------------- |
| chat_id    | FK to chat.ROWID    |
| message_id | FK to message.ROWID |

### `chat_handle_join` - Links participants to chats

| Column    | Description        |
| --------- | ------------------ |
| chat_id   | FK to chat.ROWID   |
| handle_id | FK to handle.ROWID |

### Apple Timestamp Conversion

Apple stores timestamps as **nanoseconds since January 1, 2001**. To convert to JavaScript milliseconds (since 1970):

```typescript
const APPLE_EPOCH_OFFSET_MS = 978307200000; // ms from 1970 to 2001
const jsTimestamp = Math.floor(appleDate / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
```

## Setup

### Prerequisites

- macOS (for iMessage database access)
- Node.js 20+
- A copy of `chat.db` for development

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/imessage-archive.git
cd imessage-archive

# Install dependencies
npm install

# Rebuild native modules for Electron
npx @electron/rebuild
```

### Development Database

Copy your iMessage database and attachments to the data directory:

```bash
mkdir -p data
cp ~/Library/Messages/chat.db ./data/chat.db
cp -r ~/Library/Messages/Attachments ./data/attachments
```

> **Note**: The database and attachments are gitignored.

## Development

### Running the App

```bash
# Development (starts Vite + Electron together)
npm run dev

# Production build + launch
npm run app
```

### Available Scripts

| Script          | Description                                         |
| --------------- | --------------------------------------------------- |
| `npm run dev`   | Start Vite dev server + Electron (development)      |
| `npm run app`   | Build everything, then launch Electron (production) |
| `npm run build` | Build both frontend and backend                     |
| `npm run lint`  | Run ESLint                                          |

### Rebuilding Native Modules

If you update Electron or better-sqlite3, rebuild native modules:

```bash
npx @electron/rebuild
```

## IPC API Reference

The renderer communicates with the main process via `window.electronAPI`:

### `getConversations(options?)`

Fetch paginated conversation list.

```typescript
type Options = {
  limit?: number; // Default: 50
  offset?: number; // Default: 0
};

type Result = {
  conversations: Conversation[];
  total: number;
};
```

### `getMessages(options)`

Fetch messages for a conversation with cursor pagination.

```typescript
type Options = {
  chatId: number; // Required: conversation ROWID
  limit?: number; // Default: 50
  beforeDate?: number; // Cursor: JS timestamp for pagination
};

type Result = {
  messages: Message[];
  hasMore: boolean;
};
```

### `getConversationById(chatId)`

Fetch a single conversation by ID.

```typescript
getConversationById(chatId: number): Promise<Conversation | null>
```

### `getDatabaseStatus()`

Check database connection status.

```typescript
type Result = {
  connected: boolean;
  path: string;
};
```

## Type Definitions

```typescript
type Handle = {
  rowid: number;
  id: string; // Phone or email
  service: string; // "iMessage" | "SMS"
};

type Conversation = {
  rowid: number;
  guid: string;
  chatIdentifier: string;
  displayName: string | null;
  style: number; // 43 = group, 45 = DM
  isGroup: boolean;
  lastMessageDate: number; // JS timestamp (ms)
  lastMessageText: string | null;
  participants: Handle[];
};

type Message = {
  rowid: number;
  guid: string;
  text: string | null;
  handleId: number | null;
  date: number; // JS timestamp (ms)
  isFromMe: boolean;
  service: string;
  senderHandle?: Handle;
};
```

## Troubleshooting

### "Database not initialized" error

The app couldn't open chat.db. Check:

1. `chat.db` exists in the `data/` directory
2. File permissions allow reading
3. Database isn't locked by another process

### Native module version mismatch

```
NODE_MODULE_VERSION X. This version of Node.js requires NODE_MODULE_VERSION Y.
```

Rebuild native modules:

```bash
npx @electron/rebuild
```

### "exports is not defined" error

The `dist-app/package.json` file is missing. Run:

```bash
npm run build
```

This creates `dist-app/package.json` with `{"type": "commonjs"}`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` to check for issues
5. Submit a pull request

## License

MIT

## Acknowledgments

- [Electron](https://www.electronjs.org/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
