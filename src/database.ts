import Database from '@tauri-apps/plugin-sql';

// Keep a single instance of the database connection
let dbInstance: Database | null = null;

// Function to connect to the SQLite file
export const loadDatabase = async () => {
  if (dbInstance) return dbInstance;
  dbInstance = await Database.load('sqlite:rental_data.db');
  return dbInstance;
};

// Function to set up and version-control the tables
export const initializeDatabase = async () => {
  const db = await loadDatabase();

  // 1. Create a system table to track the database schema version
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  // 2. Check the current version of the database
  const result = await db.select<{ version: number }[]>(
    "SELECT version FROM schema_version LIMIT 1;"
  );
  
  let currentVersion = result.length > 0 ? result[0].version : 0;

  // 3. Version 1: Initial Tables setup
  if (currentVersion < 1) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        company TEXT
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_qty INTEGER DEFAULT 1,
        daily_rate REAL NOT NULL,
        status TEXT DEFAULT 'Available'
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS rentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        start_date TEXT NOT NULL,
        expected_return TEXT NOT NULL,
        total_amount REAL,
        FOREIGN KEY(customer_id) REFERENCES customers(id)
      );
    `);

    // Insert the starting version tracking record
    await db.execute("INSERT INTO schema_version (version) VALUES (1);");
    currentVersion = 1;
    console.log("Database initialized at Version 1!");
  }
};