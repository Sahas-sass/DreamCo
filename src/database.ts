import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

export const loadDatabase = async () => {
  // If we already connected, don't open a second connection
  if (dbInstance) return dbInstance;
  
  // This creates (or loads) a 'rental_data.db' file locally 
  dbInstance = await Database.load('sqlite:rental_data.db');
  return dbInstance;
};


export const initializeDatabase = async () => {
  const db = await loadDatabase();

  // Create Customers Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      company TEXT
    );
  `);

  // Create Equipment Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_qty INTEGER DEFAULT 1,
      daily_rate REAL NOT NULL,
      status TEXT DEFAULT 'Available'
    );
  `);

  // Create Rentals Table
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

  console.log("Database initialized successfully!");
};