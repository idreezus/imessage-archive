import { getDatabaseInstance } from "../database/connection";
import { appleToJsTimestamp, jsToAppleTimestamp } from "../database/timestamps";
import { startTimer } from "../perf";
import { getReactionsForMessages, processReactions } from "./reactions";
import { getAttachmentsForMessages } from "../attachments/queries";
import { Message, MessageRow, MessagesOptions } from "./types";
import { parseAttributedBody } from "./attributedBody";

// Extract text from message row, falling back to attributedBody if text is empty
function getMessageText(row: MessageRow): string | null {
  // Use plain text if available
  if (row.text && row.text.trim().length > 0) {
    return row.text;
  }
  // Fall back to parsing attributedBody
  if (row.attributedBody) {
    return parseAttributedBody(row.attributedBody);
  }
  return null;
}

// Fetch messages around a specific date for scroll-to navigation.
export function getMessagesAroundDate(
  chatId: number,
  targetDate: number,
  contextCount: number = 25
): { messages: Message[]; targetIndex: number } {
  const db = getDatabaseInstance();
  const appleTargetDate = jsToAppleTimestamp(targetDate);

  // Get messages before target (older)
  const beforeQuery = `
    SELECT
      m.ROWID as rowid,
      m.guid,
      m.text,
      m.attributedBody,
      m.handle_id as handleId,
      m.date,
      m.is_from_me as isFromMe,
      m.service,
      h.id as handleIdentifier,
      h.service as handleService
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    WHERE cmj.chat_id = ?
      AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
      AND m.date <= ?
    ORDER BY m.date DESC
    LIMIT ?
  `;

  // Get messages after target (newer)
  const afterQuery = `
    SELECT
      m.ROWID as rowid,
      m.guid,
      m.text,
      m.attributedBody,
      m.handle_id as handleId,
      m.date,
      m.is_from_me as isFromMe,
      m.service,
      h.id as handleIdentifier,
      h.service as handleService
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    WHERE cmj.chat_id = ?
      AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
      AND m.date > ?
    ORDER BY m.date ASC
    LIMIT ?
  `;

  const beforeRows = db
    .prepare(beforeQuery)
    .all(chatId, appleTargetDate, contextCount + 1) as MessageRow[];
  const afterRows = db
    .prepare(afterQuery)
    .all(chatId, appleTargetDate, contextCount) as MessageRow[];

  // Combine and sort chronologically
  const allRows = [...beforeRows.reverse(), ...afterRows];

  // Get reactions for all messages in this chat
  const messageGuids = allRows.map((row) => row.guid);
  const reactionRows = getReactionsForMessages(chatId, messageGuids);
  const reactionsByGuid = processReactions(reactionRows);

  // Get attachments for all messages
  const messageRowids = allRows.map((row) => row.rowid);
  const attachmentsByMessage = getAttachmentsForMessages(messageRowids);

  // Transform to Message format
  const messages: Message[] = allRows.map((row) => ({
    rowid: row.rowid,
    guid: row.guid,
    text: getMessageText(row),
    handleId: row.handleId,
    date: appleToJsTimestamp(row.date),
    isFromMe: row.isFromMe === 1,
    service: row.service,
    senderHandle: row.handleIdentifier
      ? {
          rowid: row.handleId ?? 0,
          id: row.handleIdentifier,
          service: row.handleService ?? "iMessage",
        }
      : undefined,
    reactions: reactionsByGuid.get(row.guid) ?? [],
    attachments: attachmentsByMessage.get(row.rowid) ?? [],
  }));

  // Find index of target message (closest to targetDate)
  let targetIndex = 0;
  let minDiff = Infinity;
  for (let i = 0; i < messages.length; i++) {
    const diff = Math.abs(messages[i].date - targetDate);
    if (diff < minDiff) {
      minDiff = diff;
      targetIndex = i;
    }
  }

  return { messages, targetIndex };
}

// Fetch messages for a conversation with cursor-based pagination.
export function getMessages(options: MessagesOptions): {
  messages: Message[];
  hasMore: boolean;
} {
  const db = getDatabaseInstance();
  const { chatId, limit = 50, beforeDate } = options;

  let query = `
    SELECT
      m.ROWID as rowid,
      m.guid,
      m.text,
      m.attributedBody,
      m.handle_id as handleId,
      m.date,
      m.is_from_me as isFromMe,
      m.service,
      h.id as handleIdentifier,
      h.service as handleService
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    WHERE cmj.chat_id = ?
      AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
  `;

  const params: (number | undefined)[] = [chatId];

  // Add cursor filter for pagination
  if (beforeDate) {
    const appleDate = jsToAppleTimestamp(beforeDate);
    query += ` AND m.date < ?`;
    params.push(appleDate);
  }

  // Fetch one extra to determine if more messages exist
  query += ` ORDER BY m.date DESC LIMIT ?`;
  params.push(limit + 1);

  const queryTimer = startTimer("db", "getMessages.query");
  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as MessageRow[];
  queryTimer.end({ rows: rows.length });

  const hasMore = rows.length > limit;
  const messageRows = hasMore ? rows.slice(0, limit) : rows;

  // Fetch reactions for these messages in this chat
  const reactionsTimer = startTimer("db", "getMessages.reactions");
  const messageGuids = messageRows.map((row) => row.guid);
  const reactionRows = getReactionsForMessages(chatId, messageGuids);
  const reactionsByGuid = processReactions(reactionRows);
  reactionsTimer.end({ messages: messageGuids.length });

  // Fetch attachments for these messages
  const attachmentsTimer = startTimer("db", "getMessages.attachments");
  const messageRowids = messageRows.map((row) => row.rowid);
  const attachmentsByMessage = getAttachmentsForMessages(messageRowids);
  attachmentsTimer.end({ messages: messageRowids.length });

  // Transform rows to API response format with reactions and attachments
  const transformTimer = startTimer("db", "getMessages.transform");
  const messages: Message[] = messageRows.map((row) => ({
    rowid: row.rowid,
    guid: row.guid,
    text: getMessageText(row),
    handleId: row.handleId,
    date: appleToJsTimestamp(row.date),
    isFromMe: row.isFromMe === 1,
    service: row.service,
    senderHandle: row.handleIdentifier
      ? {
          rowid: row.handleId ?? 0,
          id: row.handleIdentifier,
          service: row.handleService ?? "iMessage",
        }
      : undefined,
    reactions: reactionsByGuid.get(row.guid) ?? [],
    attachments: attachmentsByMessage.get(row.rowid) ?? [],
  }));
  transformTimer.end({ messages: messages.length });

  // Reverse to chronological order (oldest first for display)
  return {
    messages: messages.reverse(),
    hasMore,
  };
}
