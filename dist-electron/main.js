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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const database_1 = require("./lib/database");
let mainWindow = null;
let dbService = null;
// Resolve database path based on environment.
function getDatabasePath() {
    if (electron_1.app.isPackaged) {
        // Production: actual iMessage database location
        return path.join(electron_1.app.getPath("home"), "Library/Messages/chat.db");
    }
    // Development: local copy in project root
    return path.join(__dirname, "..", "chat.db");
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
}
// Application lifecycle handlers
electron_1.app.whenReady().then(() => {
    initializeDatabase();
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
    if (dbService) {
        dbService.close();
    }
});
