# iMessage Database Schema

Technical reference for macOS's iMessage SQLite database.

## Overview

Apple stores all iMessage and SMS data in a SQLite database. The schema uses integer primary keys (`ROWID`) and join tables for many-to-many relationships.

**Original location**: `~/Library/Messages/chat.db` (copy to `data/chat.db` for this project)

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

## Reactions (Tapbacks)

Reactions are stored as separate messages with special `associated_message_type` values.

### Key Fields

| Column | Type | Description |
|--------|------|-------------|
| associated_message_guid | TEXT | Target message in format `p:N/GUID` |
| associated_message_type | INTEGER | Reaction type code (see below) |
| associated_message_emoji | TEXT | Custom emoji (iOS 17+, NULL for standard) |

### GUID Format

The `associated_message_guid` field uses format `p:N/GUID` where:
- `p:` is a literal prefix
- `N` is the message part index (usually `0`)
- `GUID` is the target message's guid

**Example**: `p:0/7B18EB94-1930-49CF-9E5C-C9BA39EEDF4F`

To match reactions to messages, extract the GUID portion:
```sql
SUBSTR(associated_message_guid, INSTR(associated_message_guid, '/') + 1)
```

### Reaction Type Codes

| Value | Emoji | Meaning |
|-------|-------|---------|
| 2000 | ❤️ | Love |
| 2001 | 👍 | Like |
| 2002 | 👎 | Dislike |
| 2003 | 😂 | Laugh |
| 2004 | ‼️ | Emphasize |
| 2005 | ❓ | Question |
| 3000-3005 | — | Remove corresponding reaction |

### Query Example

```sql
-- Fetch reactions for specific messages
SELECT
  SUBSTR(r.associated_message_guid, INSTR(r.associated_message_guid, '/') + 1) as target_guid,
  r.associated_message_type as reaction_type,
  r.associated_message_emoji as custom_emoji,
  r.is_from_me,
  h.id as reactor
FROM message r
LEFT JOIN handle h ON r.handle_id = h.ROWID
WHERE SUBSTR(r.associated_message_guid, INSTR(r.associated_message_guid, '/') + 1)
      IN ('GUID1', 'GUID2')
  AND r.associated_message_type >= 2000
ORDER BY r.date ASC;
```

### Handling Removals

When a user removes a reaction, a new message is created with type `3000-3005`. To get the final state:
1. Fetch all reactions (2000+) for target messages
2. Track additions and removals by reactor + reaction type
3. Filter out reactions that have a later removal

---

## Future Sections

<!-- TODO: Document these tables as features are implemented -->

- `attachment` - Media files (images, videos, audio)
- `message_attachment_join` - Links attachments to messages
- `chat_recoverable_message_join` - Recently deleted messages
- Sticker packs and sticker messages
- Link previews
- Message effects (bubble/screen effects)
