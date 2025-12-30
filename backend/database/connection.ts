import Database from "better-sqlite3";

let db: Database.Database | null = null;

// Open database connection in read-only mode.
export function openDatabase(dbPath: string): void {
  if (db) {
    throw new Error("Database already open");
  }
  db = new Database(dbPath, { readonly: true });
  db.pragma("foreign_keys = ON");
}

// Get the database instance. Throws if not initialized.
export function getDatabaseInstance(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

// Close database connection.
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Check if database is open.
export function isDatabaseOpen(): boolean {
  return db !== null;
}
