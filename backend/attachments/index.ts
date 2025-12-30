export type { Attachment, AttachmentRow, AttachmentType } from "./types";

export {
  getAttachmentsForMessages,
  classifyAttachmentType,
  resolveAttachmentPath,
} from "./queries";

export { getAttachmentsBasePath } from "./paths";

export { registerAttachmentProtocol } from "./protocol";

export { registerAttachmentHandlers } from "./handlers";
