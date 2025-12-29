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
};
// Expose API to renderer process securely
electron_1.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
