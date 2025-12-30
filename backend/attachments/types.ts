// Attachment row from database query
export type AttachmentRow = {
  rowid: number;
  guid: string;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  transferName: string | null;
  totalBytes: number;
  isSticker: number;
  transferState: number;
  isAudioMessage: number;
  messageId: number;
};

// Attachment type classification
export type AttachmentType =
  | "image"
  | "video"
  | "audio"
  | "voice-memo"
  | "sticker"
  | "document"
  | "other";

// Processed attachment for API response
export type Attachment = {
  rowid: number;
  guid: string;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  transferName: string | null;
  totalBytes: number;
  isSticker: boolean;
  isAudioMessage: boolean;
  localPath: string | null;
  type: AttachmentType;
};
