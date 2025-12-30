import { app, BrowserWindow, ipcMain, protocol } from "electron";
import * as path from "path";
import * as fs from "fs";
import { Readable } from "stream";
// @ts-expect-error - heic-convert has no type definitions
import heicConvert from "heic-convert";
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

// Resolve attachments base path.
function getAttachmentsBasePath(): string {
  if (app.isPackaged) {
    // Production: actual iMessage attachments location
    return path.join(app.getPath("home"), "Library/Messages/Attachments");
  }
  // Development: local copy in data directory
  return path.join(__dirname, "..", "data", "attachments");
}

// Get MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".webm": "video/webm",
    ".m4a": "audio/x-m4a",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".caf": "audio/x-caf",
    ".amr": "audio/amr",
    ".pdf": "application/pdf",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// Parse Range header (e.g., "bytes=0-1023" or "bytes=0-")
function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

// Register custom protocol for serving attachments
// This bypasses same-origin restrictions when running from Vite dev server
function registerAttachmentProtocol(): void {
  protocol.handle("attachment", async (request) => {
    try {
      // Extract relative path from URL (attachment://path/to/file)
      // URL structure: attachment://firstSegment/rest/of/path
      // - hostname = firstSegment (e.g., "c7")
      // - pathname = /rest/of/path (e.g., "/07/GUID/file.jpg")
      const url = new URL(request.url);
      const hostname = decodeURIComponent(url.hostname);
      const pathname = decodeURIComponent(url.pathname);
      // Combine hostname + pathname (removing leading slash from pathname)
      const relativePath = hostname + pathname;

      const basePath = getAttachmentsBasePath();
      const fullPath = path.join(basePath, relativePath);

      // Security: Ensure resolved path is within attachments directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedBase = path.resolve(basePath);
      if (!resolvedPath.startsWith(resolvedBase)) {
        return new Response("Forbidden", { status: 403 });
      }

      // Get file stats
      let stats: fs.Stats;
      try {
        stats = await fs.promises.stat(resolvedPath);
      } catch {
        return new Response("Not Found", { status: 404 });
      }

      const fileSize = stats.size;
      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeType = getMimeType(resolvedPath);

      // Handle HEIC conversion to JPEG for browser compatibility
      if (ext === ".heic" || ext === ".heif") {
        try {
          const inputBuffer = await fs.promises.readFile(resolvedPath);
          const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: "JPEG",
            quality: 0.9,
          });
          return new Response(outputBuffer, {
            headers: { "Content-Type": "image/jpeg" },
          });
        } catch (conversionError) {
          console.error("HEIC conversion failed:", conversionError);
          // Return error response for HEIC since browsers can't display it
          return new Response("HEIC conversion failed", { status: 500 });
        }
      }

      // Check for Range header (needed for video/audio streaming)
      const rangeHeader = request.headers.get("Range");

      if (rangeHeader) {
        const range = parseRangeHeader(rangeHeader, fileSize);

        if (!range) {
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: { "Content-Range": `bytes */${fileSize}` },
          });
        }

        const { start, end } = range;
        const chunkSize = end - start + 1;

        // Use streaming for efficient large file handling
        const nodeStream = fs.createReadStream(resolvedPath, { start, end });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return new Response(webStream, {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      // No range header - stream full file
      const nodeStream = fs.createReadStream(resolvedPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new Response(webStream, {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
        },
      });
    } catch (error) {
      console.error("Protocol handler error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
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

  // Get attachment file URL from relative path
  // Uses custom attachment:// protocol to bypass same-origin restrictions in dev mode
  ipcMain.handle("attachment:get-file-url", async (_event, { relativePath }) => {
    if (!relativePath) return null;

    const basePath = getAttachmentsBasePath();
    const fullPath = path.join(basePath, relativePath);

    try {
      // Check if file exists
      await fs.promises.access(fullPath, fs.constants.R_OK);
      // Return attachment:// URL for renderer (works in both dev and production)
      return `attachment://${relativePath}`;
    } catch {
      // File doesn't exist or isn't readable
      return null;
    }
  });
}

// Application lifecycle handlers
app.whenReady().then(() => {
  registerAttachmentProtocol();
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
