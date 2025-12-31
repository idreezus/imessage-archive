// Message helper functions

// Format timestamp as time string (e.g., "2:30 PM").
export function formatTime(timestamp: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Format timestamp as date string with relative terms.
export function formatDate(timestamp: number): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Map expressive send style IDs to human-readable names
const EFFECT_NAMES: Record<string, string> = {
  // Screen effects
  'com.apple.messages.effect.CKConfettiEffect': 'Confetti',
  'com.apple.messages.effect.CKFireworksEffect': 'Fireworks',
  'com.apple.messages.effect.CKHappyBirthdayEffect': 'Balloons',
  'com.apple.messages.effect.CKHeartEffect': 'Hearts',
  'com.apple.messages.effect.CKLasersEffect': 'Lasers',
  'com.apple.messages.effect.CKShootingStarEffect': 'Shooting Star',
  'com.apple.messages.effect.CKSparklesEffect': 'Sparkles',
  'com.apple.messages.effect.CKSpotlightEffect': 'Spotlight',
  'com.apple.messages.effect.CKEchoEffect': 'Echo',
  // Bubble effects
  'com.apple.MobileSMS.expressivesend.gentle': 'Gentle',
  'com.apple.MobileSMS.expressivesend.loud': 'Loud',
  'com.apple.MobileSMS.expressivesend.slam': 'Slam',
  'com.apple.MobileSMS.expressivesend.invisibleink': 'Invisible Ink',
};

// Get human-readable name for an expressive send style ID
export function getEffectName(styleId: string | null): string | null {
  if (!styleId) return null;
  return EFFECT_NAMES[styleId] || styleId;
}

// Format a timestamp for display in context menu
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Format a full date and time for display
export function formatMessageDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}
