import { memo, useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { UnavailableAttachment } from './unavailable-attachment';
import { formatFileSize } from '@/lib/attachments';

type AudioAttachmentProps = {
  attachment: Attachment;
  isVoiceMemo?: boolean;
};

// Format seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Check if audio format is playable in browser
function isPlayableFormat(attachment: Attachment): boolean {
  const filename = attachment.filename?.toLowerCase() || '';
  const localPath = attachment.localPath?.toLowerCase() || '';

  // CAF (Core Audio Format) and AMR are not playable in browsers
  const unplayableExtensions = ['.caf', '.amr'];
  return !unplayableExtensions.some(ext => filename.endsWith(ext) || localPath.endsWith(ext));
}

export const AudioAttachment = memo(function AudioAttachment({
  attachment,
  isVoiceMemo = false,
}: AudioAttachmentProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const canPlay = isPlayableFormat(attachment);

  useEffect(() => {
    if (!attachment.localPath || !canPlay) {
      if (!canPlay) {
        // Don't show as error, just mark as not playable
        setIsLoading(false);
      } else {
        setError(true);
        setIsLoading(false);
      }
      return;
    }

    window.electronAPI
      .getAttachmentFileUrl(attachment.localPath)
      .then((url) => {
        if (url) {
          setAudioUrl(url);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [attachment.localPath, canPlay]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-muted rounded-lg h-14 w-48" />
    );
  }

  // Show informative UI for unplayable formats (CAF, AMR)
  if (!canPlay) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg min-w-[200px]',
          isVoiceMemo ? 'bg-primary/10' : 'bg-muted'
        )}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            isVoiceMemo ? 'bg-primary/30' : 'bg-muted-foreground/20'
          )}
        >
          <Mic className={cn('w-5 h-5', isVoiceMemo ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">Voice memo</p>
          <p className="text-xs text-muted-foreground/70">
            {attachment.totalBytes ? formatFileSize(attachment.totalBytes) : 'Format not playable in browser'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !audioUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg min-w-[200px]',
        isVoiceMemo ? 'bg-primary/10' : 'bg-muted'
      )}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        preload="metadata"
      />

      <button
        onClick={togglePlay}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          isVoiceMemo ? 'bg-primary' : 'bg-foreground'
        )}
      >
        {isPlaying ? (
          <Pause className={cn('w-5 h-5', isVoiceMemo ? 'text-primary-foreground' : 'text-background')} />
        ) : (
          <Play className={cn('w-5 h-5 ml-0.5', isVoiceMemo ? 'text-primary-foreground' : 'text-background')} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className={cn(
              'h-full transition-all',
              isVoiceMemo ? 'bg-primary' : 'bg-foreground'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
});
