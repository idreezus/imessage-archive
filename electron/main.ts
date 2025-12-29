import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { DatabaseService } from "./lib/database";
import { SearchIndexService, SearchOptions } from "./lib/search-index";

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService | null = null;
let searchService: SearchIndexService | null = null;

// Resolve database path based on environment.
function getDatabasePath(): string {
  if (app.isPackaged) {
    // Production: actual iMessage database location
    return path.join(app.getPath("home"), "Library/Messages/chat.db");
  }
  // Development: local copy in data directory
  return path.join(__dirname, "..", "data", "chat.db");
}

// Resolve search index path.
function getSearchIndexPath(): string {
  if (app.isPackaged) {
    // Production: store in app data directory
    return path.join(app.getPath("userData"), "search-index.db");
  }
  // Development: store alongside data directory
  return path.join(__dirname, "..", "data", "search-index.db");
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

// Initialize search index service.
function initializeSearchIndex(): void {
  const indexPath = getSearchIndexPath();
  try {
    searchService = new SearchIndexService(indexPath);
    searchService.setChatDbPath(getDatabasePath());
    console.log("Search index initialized:", indexPath);

    // Check if index needs to be built
    const status = searchService.getIndexStatus();
    if (!status.indexed && dbService) {
      console.log("Building search index...");
      const result = searchService.buildIndex(dbService.getDb());
      if (result.success) {
        console.log(`Search index built: ${result.messageCount} messages in ${result.duration}ms`);
      } else {
        console.error("Failed to build search index:", result.error);
      }
    }
  } catch (error) {
    console.error("Failed to initialize search index:", error);
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

  // Get messages around a specific date (for scroll-to navigation)
  ipcMain.handle("db:get-messages-around-date", async (_event, { chatId, targetDate, contextCount }) => {
    if (!dbService) throw new Error("Database not initialized");
    return dbService.getMessagesAroundDate(chatId, targetDate, contextCount);
  });

  // Search messages
  ipcMain.handle("search:query", async (_event, options: SearchOptions) => {
    if (!searchService) throw new Error("Search index not initialized");
    return searchService.search(options);
  });

  // Get search index status
  ipcMain.handle("search:status", async () => {
    if (!searchService) return { indexed: false, messageCount: 0, lastSyncTime: null, chatDbPath: null };
    return searchService.getIndexStatus();
  });

  // Rebuild search index
  ipcMain.handle("search:rebuild", async () => {
    if (!searchService || !dbService) throw new Error("Services not initialized");
    return searchService.buildIndex(dbService.getDb());
  });

  // Get all handles for sender autocomplete
  ipcMain.handle("search:get-handles", async () => {
    if (!dbService) throw new Error("Database not initialized");
    return dbService.getAllHandles();
  });

  // Get all chats for filter dropdown
  ipcMain.handle("search:get-chats", async () => {
    if (!dbService) throw new Error("Database not initialized");
    return dbService.getAllChats();
  });
}

// Application lifecycle handlers
app.whenReady().then(() => {
  initializeDatabase();
  initializeSearchIndex();
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
  if (searchService) {
    searchService.close();
  }
  if (dbService) {
    dbService.close();
  }
});
