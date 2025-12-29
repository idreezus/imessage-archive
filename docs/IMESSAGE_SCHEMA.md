# iMessage Database Schema

Technical reference for macOS's iMessage SQLite database (`~/Library/Messages/chat.db`).

## Overview

Apple stores all iMessage and SMS data in a SQLite database. The schema uses integer primary keys (`ROWID`) and join tables for many-to-many relationships.

**Location**: `~/Library/Messages/chat.db`

---

## Core Tables

### `handle`

Contacts—anyone you've messaged.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| id | TEXT | Phone number (`+15551234567`) or email |
| service | TEXT | `iMessage` or `SMS` |
| uncanonicalized_id | TEXT | Original format before normalization |
| person_centric_id | TEXT | Cross-device identifier (UUID) |

**Notes**:
- Phone numbers include country code with `+` prefix
- Same contact may have multiple rows (phone + email, or iMessage + SMS)

---

### `chat`

Conversations—individual DMs or group threads.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Unique identifier (`iMessage;+;chat123456`) |
| chat_identifier | TEXT | Primary ID (phone, email, or group hash) |
| display_name | TEXT | User-set name for group chats (NULL for DMs) |
| style | INTEGER | Chat type (see below) |
| state | INTEGER | Chat state |
| account_id | TEXT | Account GUID |
| last_read_message_timestamp | INTEGER | Apple timestamp |

**Style values**:
| Value | Meaning |
|-------|---------|
| 43 | Group chat |
| 45 | Individual DM |

---

### `message`

Individual messages.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Unique identifier |
| text | TEXT | Message content (NULL if attachment-only) |
| handle_id | INTEGER | FK to `handle.ROWID` (NULL if `is_from_me`) |
| service | TEXT | `iMessage` or `SMS` |
| date | INTEGER | Sent timestamp (Apple format) |
| date_read | INTEGER | Read timestamp |
| date_delivered | INTEGER | Delivered timestamp |
| is_from_me | INTEGER | 1 = sent, 0 = received |
| is_read | INTEGER | 1 = read, 0 = unread |
| is_delivered | INTEGER | 1 = delivered |
| is_sent | INTEGER | 1 = sent successfully |
| cache_has_attachments | INTEGER | 1 = has media |
| associated_message_guid | TEXT | Parent message (for reactions/replies) |
| associated_message_type | INTEGER | Reaction type (see below) |
| thread_originator_guid | TEXT | Thread root message |
| thread_originator_part | TEXT | Thread position |
| attributedBody | BLOB | Rich text (mentions, formatting) |

**Associated message types** (reactions):
| Value | Meaning |
|-------|---------|
| 0 | Normal message |
| 2000 | Love |
| 2001 | Like (thumbs up) |
| 2002 | Dislike (thumbs down) |
| 2003 | Laugh |
| 2004 | Emphasis (exclamation) |
| 2005 | Question |
| 3000 | Remove love |
| 3001 | Remove like |
| 3002 | Remove dislike |
| 3003 | Remove laugh |
| 3004 | Remove emphasis |
| 3005 | Remove question |

---

## Join Tables

### `chat_message_join`

Links messages to conversations (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| chat_id | INTEGER | FK to `chat.ROWID` |
| message_id | INTEGER | FK to `message.ROWID` |
| message_date | INTEGER | Denormalized timestamp for sorting |

---

### `chat_handle_join`

Links participants to conversations.

| Column | Type | Description |
|--------|------|-------------|
| chat_id | INTEGER | FK to `chat.ROWID` |
| handle_id | INTEGER | FK to `handle.ROWID` |

---

## Timestamp Format

Apple uses **nanoseconds since January 1, 2001** (Apple epoch).

### Conversion Formula

```typescript
// Apple epoch offset in milliseconds
const APPLE_EPOCH_OFFSET_MS = 978307200000;

// Apple nanoseconds → JavaScript milliseconds
function appleToJs(appleTimestamp: number): number {
  return Math.floor(appleTimestamp / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
}

// JavaScript milliseconds → Apple nanoseconds
function jsToApple(jsTimestamp: number): number {
  return (jsTimestamp - APPLE_EPOCH_OFFSET_MS) * 1_000_000;
}
```

### Example

```
Apple:  737510400000000000  (nanoseconds since 2001-01-01)
JS:     1715817600000       (milliseconds since 1970-01-01)
Date:   2024-05-16 00:00:00 UTC
```

---

## Common Queries

### All conversations sorted by recent activity

```sql
SELECT
  c.ROWID,
  c.chat_identifier,
  c.display_name,
  c.style,
  MAX(m.date) as last_message_date
FROM chat c
LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
LEFT JOIN message m ON cmj.message_id = m.ROWID
GROUP BY c.ROWID
ORDER BY last_message_date DESC;
```

### Messages for a conversation

```sql
SELECT
  m.ROWID,
  m.text,
  m.date,
  m.is_from_me,
  m.service,
  h.id as sender
FROM message m
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
LEFT JOIN handle h ON m.handle_id = h.ROWID
WHERE cmj.chat_id = ?
ORDER BY m.date DESC
LIMIT 50;
```

### Participants in a conversation

```sql
SELECT h.id, h.service
FROM handle h
JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
WHERE chj.chat_id = ?;
```

---

## Schema Version

The database schema evolves with macOS versions. Check the version:

```sql
SELECT * FROM _SqliteDatabaseProperties
WHERE key = 'counter_in_all';
```

---

## Future Sections

<!-- TODO: Document these tables as features are implemented -->

- `attachment` - Media files (images, videos, audio)
- `message_attachment_join` - Links attachments to messages
- `chat_recoverable_message_join` - Recently deleted messages
- Sticker packs and sticker messages
- Tapback/reaction details
- Link previews
- Message effects (bubble/screen effects)
