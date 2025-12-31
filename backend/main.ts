import { config } from "dotenv";
import * as path from "path";

// Load .env.local for local development (includes PERF_ENABLED)
config({ path: path.join(__dirname, "../.env.local") });

import { app, BrowserWindow } from "electron";

// CRITICAL: Import attachments first - registerSchemesAsPrivileged runs on module load
import { registerAttachmentProtocol, registerAttachmentHandlers } from "./attachments";

import {
  openDatabase,
  closeDatabase,
  getDatabaseInstance,
  openCacheDatabase,
  closeCacheDatabase,
  isCacheStale,
  buildConversationCache,
} from "./database";
import { getDatabasePath, getSearchIndexPath } from "./shared";
import { registerConversationHandlers } from "./conversations";
import { registerMessageHandlers } from "./messages";
import {
  SearchIndexService,
  registerSearchHandlers,
  initializeSearchService,
} from "./search";
import { registerGalleryHandlers } from "./gallery";
import { startPhase, endStartup } from "./perf";
import { shutdownThumbnailPool } from "./attachments/thumbnail-pool";
import { shutdownDimensionPool } from "./attachments/dimension-pool";
import {
  loadDimensionsCache,
  saveDimensionsCache,
  clearPendingSave,
} from "./attachments/dimensions-cache";
import { registerIndexingHandlers } from "./indexing";

let mainWindow: BrowserWindow | null = null;
let searchService: SearchIndexService | null = null;

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
    openDatabase(dbPath);
    console.log("Database connected:", dbPath);
  } catch (error) {
    console.error("Failed to connect to database:", error);
  }
}

// Initialize conversation cache for fast startup.
function initializeConversationCache(): void {
  try {
    openCacheDatabase();

    if (isCacheStale()) {
      console.log("Building conversation cache...");
      const result = buildConversationCache();
      if (result.success) {
        console.log(
          `Conversation cache built: ${result.chatCount} chats in ${result.duration}ms`
        );
      } else {
        console.error("Failed to build conversation cache");
      }
    } else {
      console.log("Using existing conversation cache");
    }
  } catch (error) {
    console.error("Failed to initialize conversation cache:", error);
  }
}

// Initialize search index service.
function initializeSearchIndex(): void {
  const indexPath = getSearchIndexPath();
  try {
    searchService = new SearchIndexService(indexPath);
    searchService.setChatDbPath(getDatabasePath());
    console.log("Search index initialized:", indexPath);

    // Initialize search handlers with dependencies
    const db = getDatabaseInstance();
    initializeSearchService(searchService, db);

    // Check if index needs to be built
    const status = searchService.getIndexStatus();
    if (!status.indexed) {
      console.log("Building search index...");
      const result = searchService.buildIndex(db);
      if (result.success) {
        console.log(
          `Search index built: ${result.messageCount} messages in ${result.duration}ms`
        );
      } else {
        console.error("Failed to build search index:", result.error);
      }
    }
  } catch (error) {
    console.error("Failed to initialize search index:", error);
  }
}

// Register all IPC handlers.
function registerAllHandlers(): void {
  registerConversationHandlers();
  registerMessageHandlers();
  registerSearchHandlers();
  registerAttachmentHandlers();
  registerGalleryHandlers();
  registerIndexingHandlers();
}

// Application lifecycle handlers
app.whenReady().then(async () => {
  startPhase("registerAttachmentProtocol");
  registerAttachmentProtocol();

  // Load cached dimensions for layout shift prevention
  await loadDimensionsCache();

  startPhase("initializeDatabase");
  initializeDatabase();

  startPhase("initializeConversationCache");
  initializeConversationCache();

  startPhase("initializeSearchIndex");
  initializeSearchIndex();

  startPhase("registerAllHandlers");
  registerAllHandlers();

  startPhase("createWindow");
  createWindow();

  endStartup();

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

app.on("quit", async () => {
  // Shutdown worker pools
  await shutdownThumbnailPool();
  await shutdownDimensionPool();

  // Save dimensions cache (cancel pending debounced save first)
  clearPendingSave();
  await saveDimensionsCache();

  if (searchService) {
    searchService.close();
  }
  closeCacheDatabase();
  closeDatabase();
});
