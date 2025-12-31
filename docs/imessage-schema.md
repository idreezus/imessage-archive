# iMessage Database Schema

> **Note**: This documentation is INCOMPLETE, AI-GENERATED, and may contain inaccuracies – please verify details independently before relying on them.

Technical reference for macOS's iMessage SQLite database.

## Overview

Apple stores all iMessage and SMS data in a SQLite database. The schema uses integer primary keys (`ROWID`) and join tables for many-to-many relationships.

**Original location**: `~/Library/Messages/chat.db` (copy to `data/chat.db` for this project)

---

## Core Tables

### `handle`

Contacts—anyone you've messaged.

| Column             | Type    | Description                            |
| ------------------ | ------- | -------------------------------------- |
| ROWID              | INTEGER | Primary key                            |
| id                 | TEXT    | Phone number (`+15551234567`) or email |
| service            | TEXT    | `iMessage`, `SMS`, or `RCS`            |
| country            | TEXT    | Country code                           |
| uncanonicalized_id | TEXT    | Original format before normalization   |
| person_centric_id  | TEXT    | Cross-device identifier (UUID)         |

**Notes**:

- Phone numbers include country code with `+` prefix
- Same contact may have multiple rows (phone + email, or iMessage + SMS)

---

### `chat`

Conversations—individual DMs or group threads.

| Column                      | Type    | Description                                  |
| --------------------------- | ------- | -------------------------------------------- |
| ROWID                       | INTEGER | Primary key                                  |
| guid                        | TEXT    | Unique identifier (`iMessage;+;chat123456`)  |
| chat_identifier             | TEXT    | Primary ID (phone, email, or group hash)     |
| display_name                | TEXT    | User-set name for group chats (NULL for DMs) |
| style                       | INTEGER | Chat type (see below)                        |
| state                       | INTEGER | Chat state                                   |
| account_id                  | TEXT    | Account GUID                                 |
| service_name                | TEXT    | Service (`iMessage`, `SMS`, `RCS`)           |
| room_name                   | TEXT    | Internal room identifier                     |
| last_read_message_timestamp | INTEGER | Apple timestamp                              |
| is_archived                 | INTEGER | 1 = archived conversation                    |

**Style values**:
| Value | Meaning |
|-------|---------|
| 43 | Group chat |
| 45 | Individual DM |

---

### `message`

Individual messages.

| Column                   | Type    | Description                                                         |
| ------------------------ | ------- | ------------------------------------------------------------------- |
| ROWID                    | INTEGER | Primary key                                                         |
| guid                     | TEXT    | Unique identifier                                                   |
| text                     | TEXT    | Plain text content (may be NULL—see attributedBody)                 |
| attributedBody           | BLOB    | Rich text as serialized NSAttributedString (see below)              |
| handle_id                | INTEGER | FK to `handle.ROWID` (NULL if `is_from_me`)                         |
| service                  | TEXT    | `iMessage`, `SMS`, or `RCS`                                         |
| date                     | INTEGER | Sent timestamp (Apple format)                                       |
| date_read                | INTEGER | Read timestamp                                                      |
| date_delivered           | INTEGER | Delivered timestamp                                                 |
| date_edited              | INTEGER | Edit timestamp (iOS 16+)                                            |
| date_retracted           | INTEGER | Unsend timestamp (iOS 16+)                                          |
| is_from_me               | INTEGER | 1 = sent, 0 = received                                              |
| is_read                  | INTEGER | 1 = read, 0 = unread                                                |
| is_delivered             | INTEGER | 1 = delivered                                                       |
| is_sent                  | INTEGER | 1 = sent successfully                                               |
| is_empty                 | INTEGER | 1 = empty message                                                   |
| cache_has_attachments    | INTEGER | 1 = has media                                                       |
| associated_message_guid  | TEXT    | Parent message (for reactions/replies)                              |
| associated_message_type  | INTEGER | Reaction type (see below)                                           |
| associated_message_emoji | TEXT    | Custom emoji for reaction (iOS 17+)                                 |
| thread_originator_guid   | TEXT    | Thread root message                                                 |
| thread_originator_part   | TEXT    | Thread position                                                     |
| reply_to_guid            | TEXT    | Direct reply target                                                 |
| balloon_bundle_id        | TEXT    | App extension identifier (for rich messages)                        |
| expressive_send_style_id | TEXT    | Message effect (e.g., `com.apple.messages.effect.CKConfettiEffect`) |

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

> **Note**: In practice, `associated_message_type` is never NULL—all regular messages have value 0.
> Using `= 0` instead of `IS NULL OR = 0` improves query performance.

---

### `attachment`

Media files attached to messages.

| Column          | Type    | Description                                                    |
| --------------- | ------- | -------------------------------------------------------------- |
| ROWID           | INTEGER | Primary key                                                    |
| guid            | TEXT    | Unique identifier                                              |
| filename        | TEXT    | Full path to file (often `~/Library/Messages/Attachments/...`) |
| mime_type       | TEXT    | MIME type (e.g., `image/jpeg`, `video/quicktime`)              |
| uti             | TEXT    | Uniform Type Identifier (e.g., `public.jpeg`)                  |
| transfer_name   | TEXT    | Original filename                                              |
| total_bytes     | INTEGER | File size in bytes                                             |
| created_date    | INTEGER | Apple timestamp                                                |
| is_outgoing     | INTEGER | 1 = sent, 0 = received                                         |
| is_sticker      | INTEGER | 1 = sticker attachment                                         |
| hide_attachment | INTEGER | 1 = hidden/deleted                                             |
| transfer_state  | INTEGER | Download state (0 = complete)                                  |

**Common UTIs**:
| UTI | Description |
|-----|-------------|
| `public.jpeg`, `public.png`, `public.heic` | Images |
| `public.movie`, `com.apple.quicktime-movie` | Videos |
| `com.compuserve.gif` | GIFs |
| `public.audio`, `com.apple.coreaudio-format` | Audio files |
| `com.apple.m4a-audio` | Voice memos |

---

## Join Tables

### `chat_message_join`

Links messages to conversations (many-to-many).

| Column       | Type    | Description                        |
| ------------ | ------- | ---------------------------------- |
| chat_id      | INTEGER | FK to `chat.ROWID`                 |
| message_id   | INTEGER | FK to `message.ROWID`              |
| message_date | INTEGER | Denormalized timestamp for sorting |

---

### `chat_handle_join`

Links participants to conversations.

| Column    | Type    | Description          |
| --------- | ------- | -------------------- |
| chat_id   | INTEGER | FK to `chat.ROWID`   |
| handle_id | INTEGER | FK to `handle.ROWID` |

---

### `message_attachment_join`

Links attachments to messages.

| Column        | Type    | Description              |
| ------------- | ------- | ------------------------ |
| message_id    | INTEGER | FK to `message.ROWID`    |
| attachment_id | INTEGER | FK to `attachment.ROWID` |

---

## The `attributedBody` BLOB

Starting with iOS 14/macOS Big Sur, Apple stores message content primarily in the `attributedBody` column as a serialized `NSAttributedString`, rather than the plain `text` column. This is especially common for:

- Messages with mentions (@name)
- Messages with rich formatting
- Messages sent from newer iOS/macOS versions
- Messages with inline attachments

**Important**: The `text` column may be NULL or empty even for regular text messages. Always check `attributedBody` as a fallback.

### Binary Format

The blob is an NSKeyedArchiver-serialized `NSMutableAttributedString`. The text content can be extracted by:

1. Finding the `NSString` marker in the binary data
2. Locating the `0x2B` byte (ASCII `+`) which indicates a non-empty string
3. Reading the length encoding:
   - If next byte < `0x80`: single-byte length
   - If next byte = `0x81`: next 2 bytes are little-endian length
   - If next byte = `0x82`: next 3 bytes are little-endian length
4. Reading that many bytes as UTF-8 text

### Parsing Example (TypeScript)

```typescript
function parseAttributedBody(blob: Buffer): string | null {
  const nsStringMarker = Buffer.from('NSString');
  const nsIdx = blob.indexOf(nsStringMarker);
  if (nsIdx === -1) return null;

  const afterNs = blob.subarray(nsIdx + 9); // Skip "NSString" + null

  // Find 0x2B marker within first 10 bytes
  let markerPos = -1;
  for (let i = 0; i < Math.min(10, afterNs.length); i++) {
    if (afterNs[i] === 0x2b) {
      markerPos = i;
      break;
    }
  }
  if (markerPos === -1) return null;

  // Read length
  const lenByte = afterNs[markerPos + 1];
  let textLength: number;
  let textStart: number;

  if (lenByte < 0x80) {
    textLength = lenByte;
    textStart = markerPos + 2;
  } else if (lenByte === 0x81) {
    textLength = afterNs[markerPos + 2] | (afterNs[markerPos + 3] << 8);
    textStart = markerPos + 4;
  } else {
    return null;
  }

  return afterNs.subarray(textStart, textStart + textLength).toString('utf-8');
}
```

### Object Replacement Characters

The extracted text may contain `U+FFFC` (object replacement character) where inline attachments appear. Strip these for display:

```typescript
const displayText = parsedText.replace(/\ufffc/g, '').trim();
```

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

### Messages for a conversation (with attributedBody fallback)

```sql
-- Use INDEXED BY to force the covering index for optimal performance
-- Note: associated_message_type is never NULL in practice, so = 0 is sufficient
SELECT
  m.ROWID,
  m.text,
  m.attributedBody,
  cmj.message_date as date,
  m.is_from_me,
  m.service,
  h.id as sender
FROM chat_message_join cmj
  INDEXED BY chat_message_join_idx_message_date_id_chat_id
JOIN message m ON m.ROWID = cmj.message_id
LEFT JOIN handle h ON m.handle_id = h.ROWID
WHERE cmj.chat_id = ?
  AND m.associated_message_type = 0
ORDER BY cmj.message_date DESC
LIMIT 50;
```

> **Performance Note**: The `INDEXED BY` hint forces SQLite to use the covering index
> `(chat_id, message_date, message_id)` which eliminates a costly TEMP B-TREE sort.
> Without this hint, query times can vary from 44ms to 1,500ms+ depending on chat size.

### Participants in a conversation

```sql
SELECT h.id, h.service
FROM handle h
JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
WHERE chj.chat_id = ?;
```

### Attachments for messages

```sql
SELECT
  a.ROWID,
  a.filename,
  a.mime_type,
  a.uti,
  a.transfer_name,
  a.total_bytes,
  a.is_sticker
FROM attachment a
JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
WHERE maj.message_id IN (?, ?, ?);
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

| Column                   | Type    | Description                                      |
| ------------------------ | ------- | ------------------------------------------------ |
| associated_message_guid  | TEXT    | Target message in format `p:N/GUID` or `bp:GUID` |
| associated_message_type  | INTEGER | Reaction type code (see below)                   |
| associated_message_emoji | TEXT    | Custom emoji (iOS 17+, NULL for standard)        |

### GUID Format

The `associated_message_guid` field uses format `p:N/GUID` where:

- `p:` is a literal prefix (or `bp:` for some message types)
- `N` is the message part index (usually `0`)
- `GUID` is the target message's guid

**Example**: `p:0/7B18EB94-1930-49CF-9E5C-C9BA39EEDF4F`

To match reactions to messages, extract the GUID portion:

```sql
SUBSTR(associated_message_guid, INSTR(associated_message_guid, '/') + 1)
```

### Reaction Type Codes

| Value     | Emoji | Meaning                       |
| --------- | ----- | ----------------------------- |
| 2000      | ❤️    | Love                          |
| 2001      | 👍    | Like                          |
| 2002      | 👎    | Dislike                       |
| 2003      | 😂    | Laugh                         |
| 2004      | ‼️    | Emphasize                     |
| 2005      | ❓    | Question                      |
| 3000-3005 | —     | Remove corresponding reaction |

### Query Example

```sql
-- Fetch reactions for specific messages using the associated_message_guid index
-- Build prefixed patterns for each target GUID: p:0/, p:1/, p:2/, p:3/, bp:
SELECT
  r.associated_message_guid,
  r.associated_message_type as reaction_type,
  r.associated_message_emoji as custom_emoji,
  r.is_from_me,
  r.date,
  h.id as reactor
FROM message r
LEFT JOIN handle h ON r.handle_id = h.ROWID
WHERE r.associated_message_guid IN (
    'p:0/GUID1', 'p:1/GUID1', 'p:2/GUID1', 'p:3/GUID1', 'bp:GUID1',
    'p:0/GUID2', 'p:1/GUID2', 'p:2/GUID2', 'p:3/GUID2', 'bp:GUID2'
  )
  AND r.associated_message_type >= 2000
ORDER BY r.date ASC;
```

> **Performance Note**: Using prefixed GUID patterns with IN clause leverages the
> `message_idx_associated_message2` index for O(log n) lookups per pattern.
> Avoid using SUBSTR() in WHERE clauses as it prevents index usage and causes full table scans.

### Handling Removals

When a user removes a reaction, a new message is created with type `3000-3005`. To get the final state:

1. Fetch all reactions (2000+) for target messages
2. Track additions and removals by reactor + reaction type
3. Filter out reactions that have a later removal

---

## Attachment Paths

Attachment file paths in the `filename` column use `~` for the home directory. Common locations:

- `~/Library/Messages/Attachments/` — received attachments
- Paths may reference iCloud (`~/Library/Messages/Attachments/.../filename.icloud`)

For iCloud placeholder files (`.icloud` extension), the actual file may need to be downloaded first.

---

## Future Sections

<!-- TODO: Document these tables as features are implemented -->

- `chat_recoverable_message_join` - Recently deleted messages
- `recoverable_message_part` - Deleted message content
- Sticker packs and sticker messages
- Link previews (`balloon_bundle_id = 'com.apple.messages.URLBalloonProvider'`)
- Message effects (`expressive_send_style_id`)
- Edit history for edited messages
