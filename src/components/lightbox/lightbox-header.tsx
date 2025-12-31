import { memo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LightboxHeaderProps = {
  onClose: () => void;
};

export const LightboxHeader = memo(function LightboxHeader({
  onClose,
}: LightboxHeaderProps) {
  return (
    <div className="shrink-0 h-lightbox-header flex items-center justify-end px-lightbox-x-padding">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="text-white hover:bg-white/20 hover:text-white"
      >
        <X className="size-6" />
      </Button>
    </div>
  );
});
