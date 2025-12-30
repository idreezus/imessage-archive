# Performance Analysis Report

**Generated:** 2024-12-30
**Environment:** Production build (not dev server)

---

## 1. Time to Interactive

| Milestone                   | Timestamp    | Elapsed from Start |
| --------------------------- | ------------ | ------------------ |
| Backend startup complete    | 02:01:16.090 | 0ms (baseline)     |
| First frontend render       | 02:01:16.350 | 260ms              |
| First DB query starts       | 02:01:16.352 | 262ms              |
| **Conversation list loads** | 02:01:26.434 | **~10 seconds**    |

**Key Finding:** The app takes approximately **10 seconds from launch to interactive**. The vast majority of this time (10,083ms) is spent in the `getConversations` IPC call.

---

## 2. getConversations Performance Breakdown

### 2.1 Timing Distribution (Production Build)

| Sub-operation    | Duration     | % of Total |
| ---------------- | ------------ | ---------- |
| count            | 2ms          | 0.02%      |
| **query**        | **7,970ms**  | **79.0%**  |
| participants     | 1ms          | 0.01%      |
| **lastMessages** | **2,109ms**  | **20.9%**  |
| transform        | 0ms          | 0%         |
| **Total IPC**    | **10,083ms** | 100%       |

### 2.2 Key Finding

The `getConversations.query` operation alone takes **~8 seconds**. This query joins `chat`, `chat_message_join`, and `message` tables with a `GROUP BY` and `ORDER BY MAX(date)` to get conversations sorted by last message date.

---

## 3. getMessages Performance Breakdown

### 3.1 Timing Distribution (Production Build)

| Sub-operation | Chat 1503   | Chat 1116   | Chat 1070   | Average      |
| ------------- | ----------- | ----------- | ----------- | ------------ |
| query         | 34ms        | 218ms       | 122ms       | 125ms        |
| **reactions** | **1,299ms** | **1,196ms** | **1,202ms** | **1,232ms**  |
| attachments   | 2ms         | 1ms         | 1ms         | 1ms          |
| transform     | 0ms         | 0ms         | 0ms         | 0ms          |
| **Total IPC** | **1,336ms** | **1,416ms** | **1,327ms** | **~1,360ms** |

### 3.2 Time Distribution Analysis

```
getMessages.reactions:   90.6% of total time (avg 1,232ms)
getMessages.query:        9.2% of total time (avg 125ms)
getMessages.attachments:  0.1% of total time (avg 1ms)
```

### 3.3 Cached Conversation Switching

When switching to a **previously opened conversation**, the response is nearly instant (~4ms) due to the frontend message cache (5-minute TTL, 10 conversation LRU).

---

## 4. Render Performance (Production Build)

### 4.1 MessageThread Render Times

| Message Count | Min | Max | Average |
| ------------- | --- | --- | ------- |
| 0 messages    | 0ms | 2ms | 1ms     |
| 50 messages   | 3ms | 8ms | 5ms     |

Production render times are significantly faster than development mode due to React optimizations being enabled.

---

## 5. Attachment URL Resolution

All `attachment:get-file-url` calls completed in **0-1ms**. This is not a performance bottleneck.

---

## 6. Fast Operations

| Operation                      | Duration |
| ------------------------------ | -------- |
| Backend startup                | 165ms    |
| Frontend initialization        | 260ms    |
| getConversations.count         | 2ms      |
| getConversations.participants  | 1ms      |
| getMessages.attachments        | 1-2ms    |
| attachment:get-file-url        | 0-1ms    |
| Cached conversation switch     | ~4ms     |
| MessageThread render (50 msgs) | 3-8ms    |

---

## 7. Slow Operations Summary

| Operation                         | Duration     | Impact                           |
| --------------------------------- | ------------ | -------------------------------- |
| **getConversations.query**        | **7,970ms**  | Blocks app startup               |
| **getConversations.lastMessages** | **2,109ms**  | Blocks app startup               |
| **getMessages.reactions**         | **~1,232ms** | Delays opening each conversation |

---

## 8. Production Timeline

```
02:01:16.090  Backend startup complete (165ms)
02:01:16.350  First frontend render (260ms from startup)
02:01:16.352  getConversations query begins
              |
              | 10+ seconds waiting for database
              |
02:01:26.434  Conversation list loads - APP IS NOW INTERACTIVE
              |
              | User selects conversation (2+ minutes later in this session)
              |
02:03:26.526  MessageThread renders (empty)
02:03:26.561  getMessages query begins
02:03:27.862  getMessages completes (1,336ms)
02:03:27.871  MessageThread renders with 50 messages (8ms)
```

---

## 9. Key Findings

### 9.1 Startup Bottleneck

The `getConversations.query` takes **8 seconds** in production. This single SQL query:

- Joins `chat` → `chat_message_join` → `message`
- Groups by chat
- Orders by `MAX(message.date)` descending
- Returns only 50 rows

This query likely lacks proper indexing on the join columns or the date column.

### 9.2 Conversation Open Bottleneck

The `getMessages.reactions` query takes **~1.2 seconds** regardless of which conversation is opened. This query fetches reactions for 50 message GUIDs using an `IN` clause.

### 9.3 What's Fast

- Frontend rendering is very fast (3-8ms for 50 messages)
- IPC overhead is negligible (~1ms)
- Attachment URL resolution is instant (0-1ms)
- Cached conversations load instantly (~4ms)
- Participant lookups are fast (1ms)

---

## 10. Summary Statistics

| Metric                              | Value            |
| ----------------------------------- | ---------------- |
| Time to interactive (startup)       | **~10 seconds**  |
| Average time to open a conversation | **~1.4 seconds** |
| Cached conversation switch          | **~4ms**         |
| Render time (50 messages)           | **3-8ms**        |

---

## 11. Root Causes

| Bottleneck              | Root Cause                                                               | Location                           |
| ----------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| 10s startup             | `getConversations.query` - expensive GROUP BY + ORDER BY on large tables | `backend/conversations/queries.ts` |
| 2s startup (additional) | `getLastMessageTexts` - window function query                            | `backend/conversations/queries.ts` |
| 1.4s conversation open  | `getReactionsForMessages` - slow reaction lookup                         | `backend/messages/reactions.ts`    |
