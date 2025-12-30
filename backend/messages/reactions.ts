import { getDatabaseInstance } from "../database/connection";
import { appleToJsTimestamp } from "../database/timestamps";
import { ReactionRow, Reaction } from "./types";

// Fetch reactions for a list of message GUIDs.
// Note: associated_message_guid has format "p:N/GUID" where N is the part index
export function getReactionsForMessages(messageGuids: string[]): ReactionRow[] {
  if (messageGuids.length === 0) return [];

  const db = getDatabaseInstance();
  const placeholders = messageGuids.map(() => "?").join(",");
  const stmt = db.prepare(`
    SELECT
      r.ROWID as rowid,
      r.guid,
      SUBSTR(r.associated_message_guid, INSTR(r.associated_message_guid, '/') + 1) as targetMessageGuid,
      r.associated_message_type as reactionType,
      r.associated_message_emoji as customEmoji,
      r.is_from_me as isFromMe,
      r.date,
      h.id as reactorIdentifier,
      h.service as reactorService
    FROM message r
    LEFT JOIN handle h ON r.handle_id = h.ROWID
    WHERE SUBSTR(r.associated_message_guid, INSTR(r.associated_message_guid, '/') + 1) IN (${placeholders})
      AND r.associated_message_type >= 2000
    ORDER BY r.date ASC
  `);

  return stmt.all(...messageGuids) as ReactionRow[];
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
