import { cn } from '@/lib/utils';
import type { Reaction } from '@/types';
import { REACTION_NAMES } from '@/types';
import { aggregateReactions } from '@/lib/reactions';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';

type ReactionPopoverProps = {
  reactions: Reaction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

// Popover showing all reactors grouped by reaction type.
export function ReactionPopover({
  reactions,
  open,
  onOpenChange,
  children,
}: ReactionPopoverProps) {
  const aggregated = aggregateReactions(reactions);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-56 p-3 gap-2"
        side="top"
        align="center"
        sideOffset={4}
      >
        <div className="space-y-3">
          {aggregated.map((reaction) => (
            <div key={reaction.type} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base">{reaction.emoji}</span>
                <span className="text-xs text-muted-foreground">
                  {REACTION_NAMES[reaction.type]}
                </span>
              </div>
              <div className="pl-6 space-y-0.5">
                {reaction.reactors.map((reactor, idx) => (
                  <p
                    key={idx}
                    className={cn(
                      'text-xs truncate',
                      reactor.isFromMe ? 'font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {reactor.identifier}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
