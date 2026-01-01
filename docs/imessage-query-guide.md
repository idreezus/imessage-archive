# iMessage Query Performance Guide

A production-ready reference for writing performant queries against the iMessage database (`chat.db`). Includes benchmarks, EXPLAIN plans, and copy-paste ready SQL.

## Benchmark Environment

- **Database size**: 2.7 GB
- **Total messages**: 2.6M+
- **Largest conversation**: 590K messages
- **Total attachments**: 124K
- **Hardware**: Apple Silicon Mac

---

## Critical Performance Concepts

### The Covering Index

The most important index for message queries:

```sql
CREATE INDEX chat_message_join_idx_message_date_id_chat_id
ON chat_message_join(chat_id, message_date, message_id)
```

This is a **covering index** — it contains all columns needed for sorted message retrieval without touching the main table. Always use it with the `INDEXED BY` hint for consistent performance.

### Index Hints

SQLite's query planner sometimes chooses suboptimal indexes. Use `INDEXED BY` to force correct index usage:

```sql
-- GOOD: Forces covering index, ~8ms
SELECT m.ROWID, m.text, m.date
FROM message m
JOIN chat_message_join cmj
  INDEXED BY chat_message_join_idx_message_date_id_chat_id
  ON m.ROWID = cmj.message_id
WHERE cmj.chat_id = ?
ORDER BY cmj.message_date DESC
LIMIT 50;

-- BAD: May use wrong index, ~5800ms on large chats
SELECT m.ROWID, m.text, m.date
FROM message m INDEXED BY message_idx_handle
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
WHERE cmj.chat_id = ?
ORDER BY cmj.message_date DESC
LIMIT 50;
```

---

## Query Patterns

### 1. Paginated Message Fetch

**Use case**: Load messages for display in a virtualized list.

```sql
SELECT
    m.ROWID,
    m.guid,
    m.text,
    m.attributedBody,
    m.date,
    m.is_from_me,
    m.handle_id,
    m.service,
    m.cache_has_attachments,
    m.associated_message_type,
    m.reply_to_guid,
    m.is_audio_message,
    m.error,
    cmj.message_date
FROM message m
JOIN chat_message_join cmj
    INDEXED BY chat_message_join_idx_message_date_id_chat_id
    ON m.ROWID = cmj.message_id
WHERE cmj.chat_id = :chatId
ORDER BY cmj.message_date DESC
LIMIT :limit;
```

**EXPLAIN QUERY PLAN:**
```
SEARCH cmj USING COVERING INDEX chat_message_join_idx_message_date_id_chat_id (chat_id=?)
SEARCH m USING INTEGER PRIMARY KEY (rowid=?)
```

**Benchmark**: ~8ms for 50 messages (590K message chat)

---

### 2. Cursor-Based Pagination

**Use case**: Load next/previous page without OFFSET.

```sql
-- Next page (older messages)
SELECT
    m.ROWID, m.text, m.date, m.is_from_me, cmj.message_date
FROM message m
JOIN chat_message_join cmj
    INDEXED BY chat_message_join_idx_message_date_id_chat_id
    ON m.ROWID = cmj.message_id
WHERE cmj.chat_id = :chatId
    AND cmj.message_date < :cursorDate
ORDER BY cmj.message_date DESC
LIMIT :limit;
```

**EXPLAIN QUERY PLAN:**
```
SEARCH cmj USING COVERING INDEX chat_message_join_idx_message_date_id_chat_id (chat_id=? AND message_date<?)
SEARCH m USING INTEGER PRIMARY KEY (rowid=?)
```

**Benchmark**: ~7ms for 50 messages

**Why cursor > OFFSET**: OFFSET 100,000 takes ~550ms because SQLite must scan and discard 100K rows. Cursor-based pagination is O(1).

---

### 3. Bidirectional Fetch (Jump to Date)

**Use case**: Navigate to a specific date in conversation history.

```sql
WITH before AS (
    SELECT m.ROWID, m.text, m.date, cmj.message_date
    FROM message m
    JOIN chat_message_join cmj
        INDEXED BY chat_message_join_idx_message_date_id_chat_id
        ON m.ROWID = cmj.message_id
    WHERE cmj.chat_id = :chatId
        AND cmj.message_date < :targetDate
    ORDER BY cmj.message_date DESC
    LIMIT :halfLimit
),
after AS (
    SELECT m.ROWID, m.text, m.date, cmj.message_date
    FROM message m
    JOIN chat_message_join cmj
        INDEXED BY chat_message_join_idx_message_date_id_chat_id
        ON m.ROWID = cmj.message_id
    WHERE cmj.chat_id = :chatId
        AND cmj.message_date >= :targetDate
    ORDER BY cmj.message_date ASC
    LIMIT :halfLimit
)
SELECT * FROM before
UNION ALL
SELECT * FROM after;
```

**EXPLAIN QUERY PLAN:**
```
COMPOUND QUERY
├── LEFT-MOST SUBQUERY
│   ├── CO-ROUTINE before
│   │   ├── SEARCH cmj USING COVERING INDEX (chat_id=? AND message_date<?)
│   │   └── SEARCH m USING INTEGER PRIMARY KEY (rowid=?)
│   └── SCAN before
└── UNION ALL
    ├── CO-ROUTINE after
    │   ├── SEARCH cmj USING COVERING INDEX (chat_id=? AND message_date>?)
    │   └── SEARCH m USING INTEGER PRIMARY KEY (rowid=?)
    └── SCAN after
```

**Benchmark**: ~9ms for 50 messages (25 before + 25 after)

---

### 4. Batch Attachment Fetch

**Use case**: Get attachments for a batch of messages.

```sql
SELECT
    a.ROWID,
    a.guid,
    a.filename,
    a.mime_type,
    a.uti,
    a.total_bytes,
    a.transfer_state,
    a.is_sticker,
    a.created_date,
    maj.message_id
FROM attachment a
JOIN message_attachment_join maj
    ON a.ROWID = maj.attachment_id
WHERE maj.message_id IN (:id1, :id2, :id3, ...)
    AND a.hide_attachment = 0
    AND a.transfer_state IN (0, 5);
```

**EXPLAIN QUERY PLAN:**
```
SEARCH maj USING COVERING INDEX sqlite_autoindex_message_attachment_join_1 (message_id=?)
SEARCH a USING INTEGER PRIMARY KEY (rowid=?)
```

**Benchmark**: ~15ms for 100 message IDs

---

### 5. Reaction Lookup

**Use case**: Get reactions for messages.

```sql
SELECT
    m.ROWID,
    m.guid,
    m.associated_message_guid,
    m.associated_message_type,
    m.associated_message_emoji,
    m.handle_id,
    m.is_from_me,
    m.date
FROM message m
WHERE m.associated_message_guid IN (
    'p:0/' || :messageGuid,
    'p:1/' || :messageGuid,
    'p:2/' || :messageGuid,
    'p:3/' || :messageGuid,
    'bp:' || :messageGuid
)
AND m.associated_message_type >= 2000;
```

**EXPLAIN QUERY PLAN:**
```
SEARCH m USING INDEX message_idx_associated_message2 (associated_message_guid=?)
```

**Benchmark**: ~9ms

**Note**: The `message_idx_associated_message2` is a partial index (WHERE associated_message_guid IS NOT NULL), so it's very efficient for this use case.

---

### 6. Conversation List

**Use case**: Get list of chats for sidebar.

```sql
SELECT
    c.ROWID,
    c.guid,
    c.chat_identifier,
    c.display_name,
    c.style,
    c.service_name,
    c.is_archived
FROM chat c
WHERE c.is_archived = 0
ORDER BY c.ROWID DESC
LIMIT :limit;
```

**Benchmark**: ~6ms for 50 chats

**Note**: For sorted-by-last-message order, you'll need a cache layer (see below).

---

### 7. Chat Participants

**Use case**: Get participants for multiple chats.

```sql
SELECT
    chj.chat_id,
    h.ROWID as handle_id,
    h.id,
    h.service
FROM chat_handle_join chj
JOIN handle h ON chj.handle_id = h.ROWID
WHERE chj.chat_id IN (:chatId1, :chatId2, :chatId3, ...);
```

**Benchmark**: ~8ms for 5 chat IDs

---

### 8. Message Count

**Use case**: Get total messages in a conversation.

```sql
SELECT COUNT(*)
FROM chat_message_join
WHERE chat_id = :chatId;
```

**Benchmark**: ~20ms for 590K message chat

---

### 9. Date Index for Timeline

**Use case**: Build a month-by-month index for timeline navigation.

```sql
SELECT
    strftime('%Y-%m', datetime(
        cmj.message_date / 1000000000 + 978307200,
        'unixepoch'
    )) as month,
    MIN(cmj.message_id) as first_message_id,
    MAX(cmj.message_id) as last_message_id,
    COUNT(*) as message_count
FROM chat_message_join cmj
WHERE cmj.chat_id = :chatId
GROUP BY month
ORDER BY month;
```

**EXPLAIN QUERY PLAN:**
```
SEARCH cmj USING INDEX idx_cmj_chat (chat_id=?)
USE TEMP B-TREE FOR GROUP BY
```

**Benchmark**: ~450ms for 590K message chat

**Optimization tip**: Cache this result and invalidate when new messages arrive.

---

### 10. Images in Conversation

**Use case**: Get all images for a media gallery.

```sql
SELECT
    a.ROWID,
    a.filename,
    a.mime_type,
    a.total_bytes,
    m.ROWID as message_id,
    m.date
FROM attachment a
JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
JOIN message m ON maj.message_id = m.ROWID
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
WHERE cmj.chat_id = :chatId
    AND a.mime_type LIKE 'image/%'
    AND a.hide_attachment = 0
    AND a.transfer_state IN (0, 5)
ORDER BY m.date DESC
LIMIT :limit;
```

**EXPLAIN QUERY PLAN:**
```
SEARCH cmj USING INDEX idx_cmj_chat (chat_id=?)
SEARCH m USING INTEGER PRIMARY KEY (rowid=?)
SEARCH maj USING COVERING INDEX sqlite_autoindex_message_attachment_join_1 (message_id=?)
SEARCH a USING INTEGER PRIMARY KEY (rowid=?)
USE TEMP B-TREE FOR ORDER BY
```

**Benchmark**: ~480ms for 590K message chat (full scan required)

---

## Anti-Patterns

### 1. Using OFFSET for Deep Pagination

```sql
-- BAD: O(n) where n = offset
SELECT * FROM message m
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
WHERE cmj.chat_id = ?
ORDER BY cmj.message_date
LIMIT 50 OFFSET 100000;  -- ~550ms
```

**Fix**: Use cursor-based pagination with `message_date < :cursor`.

### 2. N+1 Attachment Queries

```sql
-- BAD: One query per message
FOR each message:
    SELECT * FROM attachment WHERE ... message_id = ?
```

**Fix**: Batch fetch all attachments in one query with `message_id IN (...)`.

### 3. Missing Index Hints on Large Tables

```sql
-- BAD: SQLite may choose wrong index
SELECT * FROM message m
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
WHERE cmj.chat_id = ?
ORDER BY cmj.message_date;

-- GOOD: Force covering index
JOIN chat_message_join cmj
    INDEXED BY chat_message_join_idx_message_date_id_chat_id
    ON m.ROWID = cmj.message_id
```

### 4. Full Table Scans on Message

```sql
-- BAD: Scans 2.6M rows
SELECT * FROM message WHERE text LIKE '%search%';

-- BETTER: Use FTS5 or limit scope
SELECT * FROM message m
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
WHERE cmj.chat_id = ? AND m.text LIKE '%search%';
```

### 5. Sorting Without Index Support

```sql
-- BAD: Requires temp B-tree
SELECT * FROM chat ORDER BY last_message_date DESC;
-- (last_message_date doesn't exist in chat table)
```

**Fix**: Use a cache table with proper indexes.

---

## Caching Strategies

### Conversation List Cache

The conversation list sorted by last message requires an expensive query (join + aggregate). Create a cache:

```sql
CREATE TABLE conversation_cache (
    chat_id INTEGER PRIMARY KEY,
    last_message_date INTEGER,
    last_message_text TEXT,
    unread_count INTEGER,
    updated_at INTEGER
);

CREATE INDEX idx_cache_last_date ON conversation_cache(last_message_date DESC);
```

**Invalidation**: Update cache entry when new message arrives in chat.

### Timeline Index Cache

Cache the month-by-month index per conversation:

```sql
CREATE TABLE timeline_cache (
    chat_id INTEGER,
    month TEXT,
    first_message_id INTEGER,
    message_count INTEGER,
    PRIMARY KEY (chat_id, month)
);
```

---

## Positional Indexing for Virtualization

For virtualized lists that need "jump to position N", you have options:

### Option 1: Cursor-Based (Recommended)

Store `message_date` cursors, not positions. Jump by date, not index.

### Option 2: Precomputed Position Table

For very large conversations where position matters:

```sql
CREATE TABLE message_positions (
    chat_id INTEGER,
    message_id INTEGER,
    position INTEGER,
    PRIMARY KEY (chat_id, message_id)
);

CREATE INDEX idx_pos_lookup ON message_positions(chat_id, position);
```

**Trade-off**: Requires maintenance on message insert/delete.

### Option 3: Approximate Position

Use `COUNT(*)` with date bounds:

```sql
-- Get approximate position of message
SELECT COUNT(*)
FROM chat_message_join
WHERE chat_id = :chatId
    AND message_date < :targetDate;
```

---

## Full-Text Search

SQLite FTS5 provides efficient text search:

```sql
-- Create FTS index
CREATE VIRTUAL TABLE message_fts USING fts5(
    text,
    content='message',
    content_rowid='ROWID'
);

-- Populate
INSERT INTO message_fts(rowid, text)
SELECT ROWID, text FROM message WHERE text IS NOT NULL;

-- Search
SELECT m.* FROM message m
JOIN message_fts fts ON m.ROWID = fts.rowid
WHERE message_fts MATCH :query
ORDER BY rank;
```

**Note**: FTS index requires maintenance (triggers or manual rebuild).

---

## Benchmark Summary

| Query | Time | Notes |
|-------|------|-------|
| Paginated fetch (50) | ~8ms | With covering index |
| Cursor pagination | ~7ms | O(1) regardless of position |
| Bidirectional fetch | ~9ms | For jump-to-date |
| Attachment batch (100) | ~15ms | Single query for N messages |
| Reaction lookup | ~9ms | Uses partial index |
| Conversation list | ~6ms | Without last-message sort |
| Participant batch (5) | ~8ms | Single query for N chats |
| Message count | ~20ms | Simple COUNT(*) |
| Date index (590K) | ~450ms | GROUP BY month |
| Images in chat | ~480ms | Multi-table join + filter |
| OFFSET 100K | ~550ms | Anti-pattern |
| Wrong index | ~5800ms | Critical to avoid |

---

## Quick Reference

### Essential Index Hints

```sql
-- Message pagination
INDEXED BY chat_message_join_idx_message_date_id_chat_id

-- Attachment lookup
INDEXED BY message_attachment_join_idx_message_id

-- Reaction queries (automatic, partial index)
message_idx_associated_message2
```

### Timestamp Conversion

```sql
-- Apple nanoseconds to Unix seconds
message_date / 1000000000 + 978307200

-- In JavaScript
const APPLE_EPOCH_OFFSET_MS = 978307200000;
const jsTime = Math.floor(appleNs / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
```

### Filter Patterns

```sql
-- Displayable attachments
WHERE hide_attachment = 0 AND transfer_state IN (0, 5)

-- Active chats
WHERE is_archived = 0 AND is_filtered = 0

-- Reactions only
WHERE associated_message_type >= 2000 AND associated_message_type < 3000

-- Reaction removals
WHERE associated_message_type >= 3000
```
