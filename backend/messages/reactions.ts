import { getDatabaseInstance } from "../database/connection";
import { appleToJsTimestamp } from "../database/timestamps";
import { ReactionRow, Reaction } from "./types";

// Known prefixes for associated_message_guid (p:N/ for parts, bp: for bubble)
const GUID_PREFIXES = ["p:0/", "p:1/", "p:2/", "p:3/", "bp:"];

// Extract the base GUID from an associated_message_guid (strips "p:N/" or "bp:" prefix)
function extractTargetGuid(associatedGuid: string): string {
  const slashIndex = associatedGuid.indexOf("/");
  if (slashIndex >= 0) {
    return associatedGuid.slice(slashIndex + 1);
  }
  // Handle bp: prefix (no slash)
  if (associatedGuid.startsWith("bp:")) {
    return associatedGuid.slice(3);
  }
  return associatedGuid;
}

// Fetch reactions for messages in a specific chat, filtered to the given GUIDs.
// Uses the message_idx_associated_message2 index for efficient O(log n) lookups
// instead of scanning all reactions in the chat.
export function getReactionsForMessages(
  _chatId: number, // No longer needed but kept for API compatibility
  messageGuids: string[]
): ReactionRow[] {
  if (messageGuids.length === 0) return [];

  const db = getDatabaseInstance();

  // Build all possible prefixed GUIDs to match against the index
  // Each message GUID can have reactions with prefixes: p:0/, p:1/, p:2/, p:3/, bp:
  const prefixedGuids: string[] = [];
  for (const guid of messageGuids) {
    for (const prefix of GUID_PREFIXES) {
      prefixedGuids.push(prefix + guid);
    }
  }

  // Use IN clause with prefixed GUIDs to leverage the associated_message_guid index
  // This is O(n log m) where n = number of prefixed patterns, m = total reactions
  // vs O(m) for scanning all reactions in the chat
  const placeholders = prefixedGuids.map(() => "?").join(",");
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
    LEFT JOIN handle h ON r.handle_id = h.ROWID
    WHERE r.associated_message_guid IN (${placeholders})
      AND r.associated_message_type >= 2000
    ORDER BY r.date ASC
  `);

  const rows = stmt.all(...prefixedGuids) as (Omit<ReactionRow, "targetMessageGuid"> & {
    rawTargetGuid: string;
  })[];

  // Transform rows, extracting the target GUID from the prefixed format
  return rows.map((row) => ({
    rowid: row.rowid,
    guid: row.guid,
    targetMessageGuid: extractTargetGuid(row.rawTargetGuid),
    reactionType: row.reactionType,
    customEmoji: row.customEmoji,
    isFromMe: row.isFromMe,
    date: row.date,
    reactorIdentifier: row.reactorIdentifier,
    reactorService: row.reactorService,
  }));
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
