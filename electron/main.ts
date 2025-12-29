import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import * as path from "path";
import { DatabaseService } from "./lib/database";

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService | null = null;

// Resolve database path based on environment.
function getDatabasePath(): string {
  if (app.isPackaged) {
    // Production: actual iMessage database location
    return path.join(app.getPath("home"), "Library/Messages/chat.db");
  }
  // Development: local copy in project root
  return path.join(__dirname, "..", "chat.db");
}

// Create the main application window.
function createWindow(): void {
  mainWindow = new BrowserWindow({
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
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Initialize SQLite database connection.
function initializeDatabase(): void {
  const dbPath = getDatabasePath();
  try {
    dbService = new DatabaseService(dbPath);
    console.log("Database connected:", dbPath);
  } catch (error) {
    console.error("Failed to connect to database:", error);
  }
}

// Register IPC handlers for renderer communication.
function registerIpcHandlers(): void {
  // Fetch paginated conversation list
  ipcMain.handle("db:get-conversations", async (_event, options) => {
    if (!dbService) throw new Error("Database not initialized");
    return dbService.getConversations(options);
  });

  // Fetch messages for a specific conversation
  ipcMain.handle("db:get-messages", async (_event, options) => {
    if (!dbService) throw new Error("Database not initialized");
    return dbService.getMessages(options);
  });

  // Fetch single conversation by ID
  ipcMain.handle("db:get-conversation-by-id", async (_event, { chatId }) => {
    if (!dbService) throw new Error("Database not initialized");
    return dbService.getConversationById(chatId);
  });

  // Get database connection status
  ipcMain.handle("db:get-status", () => {
    return {
      connected: dbService !== null,
      path: getDatabasePath(),
    };
  });
}

// Application lifecycle handlers
app.whenReady().then(() => {
  initializeDatabase();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("quit", () => {
  if (dbService) {
    dbService.close();
  }
});
