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

  // --- ADD THIS NEW BLOCK FOR VERSION 2 ---
  if (currentVersion < 2) {
    // Add the new columns for category and unique tracking numbers
    await db.execute("ALTER TABLE equipment ADD COLUMN category TEXT DEFAULT 'General';");
    await db.execute("ALTER TABLE equipment ADD COLUMN unique_number TEXT;");
    
    // Update the version tracker
    await db.execute("UPDATE schema_version SET version = 2;");
    currentVersion = 2;
    console.log("Database migrated to Version 2 smoothly!");
  }

  // ... (Previous Version 2 block)

  // --- ADD THIS NEW BLOCK FOR VERSION 3 ---
  if (currentVersion < 3) {
    // Create the junction table to link multiple items to a single rental invoice
    await db.execute(`
      CREATE TABLE IF NOT EXISTS rental_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rental_id INTEGER NOT NULL,
        equipment_id INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        daily_rate REAL NOT NULL,
        FOREIGN KEY(rental_id) REFERENCES rentals(id),
        FOREIGN KEY(equipment_id) REFERENCES equipment(id)
      );
    `);
    
    // Add a status column to track if a rental is Active or Completed
    await db.execute("ALTER TABLE rentals ADD COLUMN status TEXT DEFAULT 'Active';");
    
    // Update the version tracker
    await db.execute("UPDATE schema_version SET version = 3;");
    currentVersion = 3;
    console.log("Database migrated to Version 3 smoothly!");
  }

  if (currentVersion < 4) {
    // Add NIC tracking to customers
    await db.execute("ALTER TABLE customers ADD COLUMN nic TEXT;");
    await db.execute("ALTER TABLE customers ADD COLUMN nic_photo_path TEXT;");
    
    // Add advanced billing tracking to rentals
    await db.execute("ALTER TABLE rentals ADD COLUMN invoice_number TEXT;");
    await db.execute("ALTER TABLE rentals ADD COLUMN issue_time TEXT;");
    await db.execute("ALTER TABLE rentals ADD COLUMN return_date TEXT;");
    await db.execute("ALTER TABLE rentals ADD COLUMN return_time TEXT;");
    await db.execute("ALTER TABLE rentals ADD COLUMN billed_days INTEGER;");
    
    await db.execute("UPDATE schema_version SET version = 4;");
    currentVersion = 4;
    console.log("Database migrated to Version 4 smoothly!");
  }
};


