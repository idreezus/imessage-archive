import type { Reaction, AggregatedReaction, ReactionTypeCode } from '@/types';
import { REACTION_EMOJI } from '@/types';

// Aggregate reactions by type for display.
export function aggregateReactions(reactions: Reaction[]): AggregatedReaction[] {
  const grouped = new Map<ReactionTypeCode, AggregatedReaction>();

  for (const reaction of reactions) {
    if (!grouped.has(reaction.type)) {
      grouped.set(reaction.type, {
        type: reaction.type,
        emoji: reaction.customEmoji ?? REACTION_EMOJI[reaction.type],
        count: 0,
        reactors: [],
      });
    }

    const agg = grouped.get(reaction.type)!;
    agg.count++;
    agg.reactors.push({
      identifier: reaction.isFromMe
        ? 'You'
        : reaction.reactor?.identifier ?? 'Unknown',
      isFromMe: reaction.isFromMe,
    });

    // If any reaction has custom emoji, use it (latest wins)
    if (reaction.customEmoji) {
      agg.emoji = reaction.customEmoji;
    }
  }

  // Sort by count (most popular first), then by type code
  return Array.from(grouped.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.type - b.type;
  });
}

// Get display-ready reactions with overflow handling.
export function getDisplayReactions(
  reactions: Reaction[],
  maxVisible: number = 3
): {
  visible: AggregatedReaction[];
  overflow: number;
  total: number;
} {
  const aggregated = aggregateReactions(reactions);
  const total = aggregated.reduce((sum, r) => sum + r.count, 0);

  if (aggregated.length <= maxVisible) {
    return { visible: aggregated, overflow: 0, total };
  }

  const visible = aggregated.slice(0, maxVisible);
  const overflowCount = aggregated
    .slice(maxVisible)
    .reduce((sum, r) => sum + r.count, 0);

  return { visible, overflow: overflowCount, total };
}
