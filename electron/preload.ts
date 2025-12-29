import { contextBridge, ipcRenderer } from "electron";

// Type definitions for IPC API exposed to renderer
type ConversationsOptions = {
  limit?: number;
  offset?: number;
};

type MessagesOptions = {
  chatId: number;
  limit?: number;
  beforeDate?: number;
};

// Electron API bridge exposed to renderer via window.electronAPI.
const electronAPI = {
  // Fetch paginated list of conversations
  getConversations: (options?: ConversationsOptions) =>
    ipcRenderer.invoke("db:get-conversations", options),

  // Fetch messages for a conversation with cursor pagination
  getMessages: (options: MessagesOptions) =>
    ipcRenderer.invoke("db:get-messages", options),

  // Fetch single conversation by ID
  getConversationById: (chatId: number) =>
    ipcRenderer.invoke("db:get-conversation-by-id", { chatId }),

  // Check database connection status
  getDatabaseStatus: () => ipcRenderer.invoke("db:get-status"),

  // Theme controls
  getTheme: () => ipcRenderer.invoke("theme:get") as Promise<"light" | "dark" | "system">,
  setTheme: (theme: "light" | "dark" | "system") =>
    ipcRenderer.invoke("theme:set", theme) as Promise<boolean>,
  shouldUseDarkColors: () => ipcRenderer.invoke("theme:shouldUseDarkColors") as Promise<boolean>,
};

// Expose API to renderer process securely
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
