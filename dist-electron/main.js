"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const url_1 = require("url");
// @ts-expect-error - heic-convert has no type definitions
const heic_convert_1 = __importDefault(require("heic-convert"));
const database_1 = require("./lib/database");
const search_index_1 = require("./lib/search-index");
// MUST be called before app.whenReady() - enables video/audio streaming
// We use "file/" prefix in URLs to prevent numeric path normalization (42 -> 0.0.0.42)
electron_1.protocol.registerSchemesAsPrivileged([
    {
        scheme: "attachment",
        privileges: {
            standard: true, // Required for proper URL parsing with video
            secure: true, // Treat as secure origin
            supportFetchAPI: true, // Allow fetch API
            stream: true, // CRITICAL: Enable video/audio streaming
            bypassCSP: true, // Bypass CSP for local files
        },
    },
]);
let mainWindow = null;
let dbService = null;
let searchService = null;
// Resolve database path based on environment.
function getDatabasePath() {
    if (electron_1.app.isPackaged) {
        // Production: actual iMessage database location
        return path.join(electron_1.app.getPath("home"), "Library/Messages/chat.db");
    }
    // Development: local copy in data directory
    return path.join(__dirname, "..", "data", "chat.db");
}
// Resolve search index path.
function getSearchIndexPath() {
    if (electron_1.app.isPackaged) {
        // Production: store in app data directory
        return path.join(electron_1.app.getPath("userData"), "search-index.db");
    }
    // Development: store alongside data directory
    return path.join(__dirname, "..", "data", "search-index.db");
}
// Resolve attachments base path.
function getAttachmentsBasePath() {
    if (electron_1.app.isPackaged) {
        // Production: actual iMessage attachments location
        return path.join(electron_1.app.getPath("home"), "Library/Messages/Attachments");
    }
    // Development: local copy in data directory
    return path.join(__dirname, "..", "data", "attachments");
}
// Register custom protocol for serving attachments
function registerAttachmentProtocol() {
    electron_1.protocol.handle("attachment", async (request) => {
        try {
            // Extract relative path from URL
            // URL format: attachment://file/42/02/GUID/file.jpg
            // The "file/" prefix prevents browser from normalizing numeric paths as IPs
            let relativePath = decodeURIComponent(request.url.slice("attachment://".length));
            // Strip the "file/" prefix that we added to prevent IP normalization
            if (relativePath.startsWith("file/")) {
                relativePath = relativePath.slice("file/".length);
            }
            const basePath = getAttachmentsBasePath();
            const fullPath = path.join(basePath, relativePath);
            // Security: Ensure resolved path is within attachments directory
            const resolvedPath = path.resolve(fullPath);
            const resolvedBase = path.resolve(basePath);
            if (!resolvedPath.startsWith(resolvedBase)) {
                return new Response("Forbidden", { status: 403 });
            }
            // Check file exists
            try {
                await fs.promises.access(resolvedPath, fs.constants.R_OK);
            }
            catch {
                return new Response("Not Found", { status: 404 });
            }
            const ext = path.extname(resolvedPath).toLowerCase();
            // Handle HEIC conversion to JPEG for browser compatibility
            if (ext === ".heic" || ext === ".heif") {
                try {
                    const inputBuffer = await fs.promises.readFile(resolvedPath);
                    const outputBuffer = await (0, heic_convert_1.default)({
                        buffer: inputBuffer,
                        format: "JPEG",
                        quality: 0.9,
                    });
                    return new Response(outputBuffer, {
                        headers: { "Content-Type": "image/jpeg" },
                    });
                }
                catch (conversionError) {
                    console.error("HEIC conversion failed:", conversionError);
                    return new Response("HEIC conversion failed", { status: 500 });
                }
            }
            // Use net.fetch - handles range requests automatically for video/audio
            // Requires: standard: true + stream: true in registerSchemesAsPrivileged
            return electron_1.net.fetch((0, url_1.pathToFileURL)(resolvedPath).toString());
        }
        catch (error) {
            console.error("Protocol handler error:", error);
            return new Response("Internal Server Error", { status: 500 });
        }
    });
}
// Create the main application window.
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // Required for better-sqlite3 native module
        },
        titleBarStyle: "hiddenInset",
        trafficLightPosition: { x: 16, y: 16 },
    });
    // Load renderer from Vite dev server or built files.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
// Initialize SQLite database connection.
function initializeDatabase() {
    const dbPath = getDatabasePath();
    try {
        dbService = new database_1.DatabaseService(dbPath);
        console.log("Database connected:", dbPath);
    }
    catch (error) {
        console.error("Failed to connect to database:", error);
    }
}
// Initialize search index service.
function initializeSearchIndex() {
    const indexPath = getSearchIndexPath();
    try {
        searchService = new search_index_1.SearchIndexService(indexPath);
        searchService.setChatDbPath(getDatabasePath());
        console.log("Search index initialized:", indexPath);
        // Check if index needs to be built
        const status = searchService.getIndexStatus();
        if (!status.indexed && dbService) {
            console.log("Building search index...");
            const result = searchService.buildIndex(dbService.getDb());
            if (result.success) {
                console.log(`Search index built: ${result.messageCount} messages in ${result.duration}ms`);
            }
            else {
                console.error("Failed to build search index:", result.error);
            }
        }
    }
    catch (error) {
        console.error("Failed to initialize search index:", error);
    }
}
// Register IPC handlers for renderer communication.
function registerIpcHandlers() {
    // Fetch paginated conversation list
    electron_1.ipcMain.handle("db:get-conversations", async (_event, options) => {
        if (!dbService)
            throw new Error("Database not initialized");
        return dbService.getConversations(options);
    });
    // Fetch messages for a specific conversation
    electron_1.ipcMain.handle("db:get-messages", async (_event, options) => {
        if (!dbService)
            throw new Error("Database not initialized");
        return dbService.getMessages(options);
    });
    // Fetch single conversation by ID
    electron_1.ipcMain.handle("db:get-conversation-by-id", async (_event, { chatId }) => {
        if (!dbService)
            throw new Error("Database not initialized");
        return dbService.getConversationById(chatId);
    });
    // Get database connection status
    electron_1.ipcMain.handle("db:get-status", () => {
        return {
            connected: dbService !== null,
            path: getDatabasePath(),
        };
    });
    // Get messages around a specific date (for scroll-to navigation)
    electron_1.ipcMain.handle("db:get-messages-around-date", async (_event, { chatId, targetDate, contextCount }) => {
        if (!dbService)
            throw new Error("Database not initialized");
        return dbService.getMessagesAroundDate(chatId, targetDate, contextCount);
    });
    // Search messages
    electron_1.ipcMain.handle("search:query", async (_event, options) => {
        if (!searchService)
            throw new Error("Search index not initialized");
        return searchService.search(options);
    });
    // Get search index status
    electron_1.ipcMain.handle("search:status", async () => {
        if (!searchService)
            return { indexed: false, messageCount: 0, lastSyncTime: null, chatDbPath: null };
        return searchService.getIndexStatus();
    });
    // Rebuild search index
    electron_1.ipcMain.handle("search:rebuild", async () => {
        if (!searchService || !dbService)
            throw new Error("Services not initialized");
        return searchService.buildIndex(dbService.getDb());
    });
    // Get all handles for sender autocomplete
    electron_1.ipcMain.handle("search:get-handles", async () => {
        if (!dbService)
            throw new Error("Database not initialized");
        return dbService.getAllHandles();
    });
    // Get all chats for filter dropdown
    electron_1.ipcMain.handle("search:get-chats", async () => {
        if (!dbService)
            throw new Error("Database not initialized");
        return dbService.getAllChats();
    });
    // Get attachment file URL from relative path
    // Uses custom attachment:// protocol to bypass same-origin restrictions in dev mode
    electron_1.ipcMain.handle("attachment:get-file-url", async (_event, { relativePath }) => {
        if (!relativePath)
            return null;
        const basePath = getAttachmentsBasePath();
        const fullPath = path.join(basePath, relativePath);
        try {
            // Check if file exists
            await fs.promises.access(fullPath, fs.constants.R_OK);
            // Return attachment:// URL for renderer
            // Use "file/" prefix to prevent browser from normalizing numeric paths as IP addresses
            // (e.g., "42/..." would become "0.0.0.42/..." without a prefix)
            return `attachment://file/${relativePath}`;
        }
        catch {
            // File doesn't exist or isn't readable
            return null;
        }
    });
}
// Application lifecycle handlers
electron_1.app.whenReady().then(() => {
    registerAttachmentProtocol();
    initializeDatabase();
    initializeSearchIndex();
    registerIpcHandlers();
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("quit", () => {
    if (searchService) {
        searchService.close();
    }
    if (dbService) {
        dbService.close();
    }
});
