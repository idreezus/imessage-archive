"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Electron API bridge exposed to renderer via window.electronAPI.
const electronAPI = {
    // Fetch paginated list of conversations
    getConversations: (options) => electron_1.ipcRenderer.invoke("db:get-conversations", options),
    // Fetch messages for a conversation with cursor pagination
    getMessages: (options) => electron_1.ipcRenderer.invoke("db:get-messages", options),
    // Fetch single conversation by ID
    getConversationById: (chatId) => electron_1.ipcRenderer.invoke("db:get-conversation-by-id", { chatId }),
    // Check database connection status
    getDatabaseStatus: () => electron_1.ipcRenderer.invoke("db:get-status"),
    // Theme controls
    getTheme: () => electron_1.ipcRenderer.invoke("theme:get"),
    setTheme: (theme) => electron_1.ipcRenderer.invoke("theme:set", theme),
    shouldUseDarkColors: () => electron_1.ipcRenderer.invoke("theme:shouldUseDarkColors"),
    // Search API
    search: (options) => electron_1.ipcRenderer.invoke("search:query", options),
    getSearchStatus: () => electron_1.ipcRenderer.invoke("search:status"),
    rebuildSearchIndex: () => electron_1.ipcRenderer.invoke("search:rebuild"),
    getHandles: () => electron_1.ipcRenderer.invoke("search:get-handles"),
    getChatsForFilter: () => electron_1.ipcRenderer.invoke("search:get-chats"),
    // Get messages around a specific date (for scroll-to navigation)
    getMessagesAroundDate: (chatId, targetDate, contextCount) => electron_1.ipcRenderer.invoke("db:get-messages-around-date", { chatId, targetDate, contextCount }),
    // Get attachment file URL from relative path
    getAttachmentFileUrl: (relativePath) => electron_1.ipcRenderer.invoke("attachment:get-file-url", { relativePath }),
};
// Expose API to renderer process securely
electron_1.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
