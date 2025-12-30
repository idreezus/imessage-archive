import { getDatabaseInstance } from "../database/connection";
import { appleToJsTimestamp } from "../database/timestamps";
import { ReactionRow, Reaction } from "./types";

// Extract the base GUID from an associated_message_guid (strips "p:N/" prefix)
function extractTargetGuid(associatedGuid: string): string {
  const slashIndex = associatedGuid.indexOf("/");
  return slashIndex >= 0 ? associatedGuid.slice(slashIndex + 1) : associatedGuid;
}

// Fetch reactions for messages in a specific chat, filtered to the given GUIDs.
// This approach uses the chat_id index for efficient filtering, then filters by GUID in JS.
// Note: associated_message_guid has format "p:N/GUID" where N is the part index
export function getReactionsForMessages(
  chatId: number,
  messageGuids: string[]
): ReactionRow[] {
  if (messageGuids.length === 0) return [];

  const db = getDatabaseInstance();

  // Query all reactions in this chat using the chat_id index
  // SUBSTR/INSTR in SELECT is fine - it's only in WHERE that it prevents index usage
  const stmt = db.prepare(`
    SELECT
      r.ROWID as rowid,
      r.guid,
      r.associated_message_guid as rawTargetGuid,
      r.associated_message_type as reactionType,
      r.associated_message_emoji as customEmoji,
      r.is_from_me as isFromMe,
      r.date,
      h.id as reactorIdentifier,
      h.service as reactorService
    FROM message r
    JOIN chat_message_join cmj ON r.ROWID = cmj.message_id
    LEFT JOIN handle h ON r.handle_id = h.ROWID
    WHERE cmj.chat_id = ?
      AND r.associated_message_type >= 2000
    ORDER BY r.date ASC
  `);

  const allChatReactions = stmt.all(chatId) as (Omit<ReactionRow, "targetMessageGuid"> & {
    rawTargetGuid: string;
  })[];

  // Filter to only reactions targeting our messages using O(1) Set lookups
  const targetGuidSet = new Set(messageGuids);
  const filteredReactions: ReactionRow[] = [];

  for (const row of allChatReactions) {
    const targetGuid = extractTargetGuid(row.rawTargetGuid);
    if (targetGuidSet.has(targetGuid)) {
      filteredReactions.push({
        rowid: row.rowid,
        guid: row.guid,
        targetMessageGuid: targetGuid,
        reactionType: row.reactionType,
        customEmoji: row.customEmoji,
        isFromMe: row.isFromMe,
        date: row.date,
        reactorIdentifier: row.reactorIdentifier,
        reactorService: row.reactorService,
      });
    }
  }

  return filteredReactions;
}

// Process raw reactions: filter removals, group by target message.
export function processReactions(
  reactionRows: ReactionRow[]
): Map<string, Reaction[]> {
  // Track reactions by target message and reactor+type key
  const reactionState = new Map<
    string,
    Map<string, { reaction: Reaction; removed: boolean }>
  >();

  for (const row of reactionRows) {
    const targetGuid = row.targetMessageGuid;
    const isRemoval = row.reactionType >= 3000;
    const effectiveType = isRemoval ? row.reactionType - 1000 : row.reactionType;

    // Create unique key for reactor + reaction type combination
    const reactorKey = row.isFromMe
      ? `me:${effectiveType}`
      : `${row.reactorIdentifier}:${effectiveType}`;

    if (!reactionState.has(targetGuid)) {
      reactionState.set(targetGuid, new Map());
    }

    const messageReactions = reactionState.get(targetGuid)!;

    if (isRemoval) {
      // Mark as removed if exists
      if (messageReactions.has(reactorKey)) {
        messageReactions.get(reactorKey)!.removed = true;
      }
    } else {
      // Add or update reaction (later additions override earlier ones)
      messageReactions.set(reactorKey, {
        reaction: {
          rowid: row.rowid,
          guid: row.guid,
          type: effectiveType,
          customEmoji: row.customEmoji,
          isFromMe: row.isFromMe === 1,
          date: appleToJsTimestamp(row.date),
          reactor: row.reactorIdentifier
            ? {
                identifier: row.reactorIdentifier,
                service: row.reactorService ?? "iMessage",
              }
            : null,
        },
        removed: false,
      });
    }
  }

  // Convert to final format, filtering out removed reactions
  const result = new Map<string, Reaction[]>();

  for (const [guid, reactions] of reactionState) {
    const activeReactions = Array.from(reactions.values())
      .filter((r) => !r.removed)
      .map((r) => r.reaction)
      .sort((a, b) => a.date - b.date);

    if (activeReactions.length > 0) {
      result.set(guid, activeReactions);
    }
  }

  return result;
}
