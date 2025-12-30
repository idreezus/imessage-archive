# Performance Analysis Report

**Generated:** 2024-12-30 (Updated after optimization pass)
**Environment:** Production build (not dev server)
**Database:** 2,641,214 messages across 1,842 conversations

---

## 1. Current Performance Summary

| Metric | Before Optimization | After Optimization | Improvement |
|--------|--------------------|--------------------|-------------|
| App startup (first launch) | ~10,000ms | 1,447ms | **7x faster** |
| App startup (cached) | ~10,000ms | ~150ms | **67x faster** |
| getConversations IPC | 10,083ms | 4ms | **2,500x faster** |
| Best conversation open | 1,300ms | 49ms | **26x faster** |
| Average conversation open | 1,400ms | ~500ms | **3x faster** |
| Worst conversation open | 1,400ms | 1,744ms | Needs work |

---

## 2. Startup Performance (FIXED)

### 2.1 Before Optimization
```
Total startup: ~10,000ms
├── getConversations.query: 7,970ms (79%)
└── getConversations.lastMessages: 2,109ms (21%)
```

### 2.2 After Optimization
```
Total startup: 1,447ms (first launch with cache build)
├── registerAttachmentProtocol: 29ms
├── initializeDatabase: 14ms
├── initializeConversationCache: 1,257ms (one-time cache build)
├── initializeSearchIndex: 1ms
├── registerAllHandlers: 0ms
└── createWindow: 146ms
```

### 2.3 Conversation List Loading
```
getConversations IPC: 4ms total
├── cache lookup: 0ms
├── metadata: 2ms
├── participants: 1ms
└── transform: 0ms
```

**Solution implemented:** Created `data/cache.db` with pre-computed `last_message_date` and `last_message_text` for each conversation. Cache is built on first launch and reused on subsequent launches.

---

## 3. Conversation Open Performance (PARTIALLY FIXED)

### 3.1 Reactions Query (FIXED)

| Chat ID | Before | After | Improvement |
|---------|--------|-------|-------------|
| 993 (small chat) | 1,232ms | 3ms | **410x** |
| 1503 | 1,232ms | 12ms | **103x** |
| 1073 | 1,232ms | 33ms | **37x** |
| 1097 | 1,232ms | 106ms | **12x** |
| 1116 | 1,232ms | 146ms | **8x** |
| 1487 | 1,232ms | 156ms | **8x** |
| 1 (large chat) | 1,232ms | 323ms | **4x** |

**Solution implemented:** Changed reactions query to filter by `chat_id` (uses index) instead of using `SUBSTR()/INSTR()` in the WHERE clause (prevented index usage). GUID extraction now happens in JavaScript with O(1) Set lookups.

### 3.2 Messages Query (NEW BOTTLENECK)

| Chat ID | Query Time | Reactions | Attachments | Total IPC |
|---------|-----------|-----------|-------------|-----------|
| 993 | 44ms | 3ms | 1ms | **49ms** |
| 1503 | 164ms | 12ms | 1ms | **179ms** |
| 1073 | 395ms | 33ms | 1ms | **429ms** |
| 1097 | 395ms | 106ms | 0ms | **502ms** |
| 1487 | 933ms | 156ms | 1ms | **1,090ms** |
| 1116 | 1,513ms | 146ms | 1ms | **1,661ms** |
| 1 | 1,420ms | 323ms | 1ms | **1,744ms** |

**Problem:** The `getMessages.query` now accounts for 85-91% of conversation open time. Query times vary from 44ms to 1,513ms depending on the conversation.

---

## 4. Current Bottleneck Analysis

### 4.1 getMessages.query Performance Issue

The messages query joins `message` → `chat_message_join` with these filters:
```sql
WHERE cmj.chat_id = ?
  AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
  AND m.date < ?
ORDER BY m.date DESC
LIMIT 51
```

**Likely causes of slowness:**
1. The `OR` condition (`IS NULL OR = 0`) may prevent efficient index usage
2. Older chats require scanning more rows to find 50 non-reaction messages
3. The join between `chat_message_join` and `message` tables may not be optimized

### 4.2 Time Distribution (Current)

For a typical slow conversation (chatId: 1116):
```
getMessages.query:       1,513ms (91%)
getMessages.reactions:     146ms (9%)
getMessages.attachments:     1ms (<1%)
getMessages.transform:       0ms (<1%)
```

For a fast conversation (chatId: 993):
```
getMessages.query:          44ms (90%)
getMessages.reactions:       3ms (6%)
getMessages.attachments:     1ms (2%)
getMessages.transform:       0ms (<1%)
```

---

## 5. Fast Operations (No Issues)

| Operation | Duration |
|-----------|----------|
| Backend startup | 43ms |
| Frontend initialization | ~250ms |
| Cache lookup | 0ms |
| Metadata fetch (50 chats) | 2ms |
| Participants fetch | 1ms |
| Attachment URL resolution | 0-1ms |
| Cached conversation switch | ~4ms |
| MessageThread render (50 msgs) | 2-6ms |

---

## 6. Optimizations Completed

### 6.1 Conversation Cache (Fix 1)
- **File:** `backend/database/cache.ts`
- **Impact:** Startup reduced from 10s to 1.4s (first) / 150ms (cached)
- **Approach:** Pre-compute `last_message_date` and `last_message_text` in `data/cache.db`

### 6.2 Reactions Query (Fix 2)
- **File:** `backend/messages/reactions.ts`
- **Impact:** Reactions query reduced from 1,232ms to 3-323ms (chat-size dependent)
- **Approach:** Query by `chat_id` (indexed), filter by GUID in JavaScript

---

## 7. Remaining Work

### 7.1 Messages Query Optimization (Priority: High)

The `getMessages.query` is now the dominant bottleneck, taking 44ms-1,513ms depending on the conversation.

**Potential solutions:**
1. Create a partial index: `CREATE INDEX idx_message_regular ON message(date) WHERE associated_message_type IS NULL OR associated_message_type = 0`
2. Cache message counts per chat to avoid repeated scans
3. Use a covering index that includes all needed columns
4. Pre-filter reactions at the database level using a view or materialized query

### 7.2 Large Chat Handling (Priority: Medium)

Chats with many reactions (like chat 1 with 323ms reaction time) are still slow. Consider:
1. Paginating reactions loading
2. Lazy-loading reactions after initial message display
3. Caching reactions per conversation

---

## 8. Performance Timeline (Current)

```
02:43:45.367  App starts
02:43:45.396  Attachment protocol registered (29ms)
02:43:45.410  Database connected (14ms)
02:43:46.666  Conversation cache built (1,254ms) [first launch only]
02:43:46.667  Search index initialized (1ms)
02:43:46.814  Window created (146ms)
              ─────────────────────────────────
              STARTUP COMPLETE: 1,447ms
              ─────────────────────────────────
02:43:47.078  First render
02:43:47.084  Conversation list loaded (4ms IPC)
              ─────────────────────────────────
              APP INTERACTIVE: ~1.7 seconds
              ─────────────────────────────────
02:43:52.078  User clicks conversation
02:43:53.740  Messages loaded (1,661ms for first conversation)
```

---

## 9. Comparison: Before vs After

| Stage | Before | After | Notes |
|-------|--------|-------|-------|
| Startup to interactive | 10s | 1.7s | **5.9x faster** |
| Conversation list load | 10,083ms | 4ms | **2,500x faster** (cached) |
| Best case message load | 1,300ms | 49ms | **26x faster** |
| Worst case message load | 1,400ms | 1,744ms | Slightly worse (query bottleneck exposed) |
| Reaction fetch (avg) | 1,232ms | ~110ms | **11x faster** |

---

## 10. Next Steps

1. **Investigate messages query** - Profile with `EXPLAIN QUERY PLAN` to understand why some chats are 34x slower than others
2. **Add database indexes** - Create indexes in cache.db for messages if beneficial
3. **Consider lazy reactions** - Load messages first, fetch reactions in background
4. **Profile large chats** - Understand why chat 1 and 1116 are particularly slow
