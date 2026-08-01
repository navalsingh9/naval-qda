const fs = require('node:fs');
const path = require('node:path');

let dbInstance = null;
let appContext = null;

const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT,
  content TEXT,
  paragraph_offsets TEXT,
  media_path TEXT,
  transcript_timestamps TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS codings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  source_id INTEGER NOT NULL,
  coder_id INTEGER NOT NULL,
  node_id INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  timestamp_start TEXT,
  timestamp_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY(coder_id) REFERENCES coders(id) ON DELETE CASCADE,
  FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'text',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS case_attribute_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  attribute_id INTEGER NOT NULL,
  value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY(attribute_id) REFERENCES attributes(id) ON DELETE CASCADE,
  UNIQUE(case_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS source_case_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  case_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE,
  UNIQUE(source_id, case_id)
);

CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  linked_type TEXT NOT NULL,
  linked_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function ensureDatabaseDirectory(dbPath) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
}

function applyMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = new Set(
    database.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name)
  );

  const migrations = [
    {
      name: '001_initial_schema',
      sql: schemaSql,
    },
    {
      name: '002_memos_and_cases_schema',
      sql: null,
    },
    {
      name: '003_ai_settings_schema',
      sql: null,
    },
  ];

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    if (migration.name === '002_memos_and_cases_schema') {
      const attributesColumns = new Set(database.prepare('PRAGMA table_info(attributes)').all().map((column) => column.name));
      if (!attributesColumns.has('value_type')) {
        database.exec("ALTER TABLE attributes ADD COLUMN value_type TEXT NOT NULL DEFAULT 'text'");
      }

      database.exec(`
        CREATE TABLE IF NOT EXISTS case_attribute_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER NOT NULL,
          attribute_id INTEGER NOT NULL,
          value TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE,
          FOREIGN KEY(attribute_id) REFERENCES attributes(id) ON DELETE CASCADE,
          UNIQUE(case_id, attribute_id)
        );
      `);

      database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_case_attribute_values_case_attribute ON case_attribute_values(case_id, attribute_id)');

      const memosColumns = new Set(database.prepare('PRAGMA table_info(memos)').all().map((column) => column.name));
      if (!memosColumns.has('title')) {
        database.exec("ALTER TABLE memos ADD COLUMN title TEXT NOT NULL DEFAULT ''");
      }
      if (!memosColumns.has('linked_type')) {
        database.exec("ALTER TABLE memos ADD COLUMN linked_type TEXT NOT NULL DEFAULT 'source'");
      }
      if (!memosColumns.has('linked_id')) {
        database.exec('ALTER TABLE memos ADD COLUMN linked_id INTEGER NOT NULL DEFAULT 0');
      }
      if (!memosColumns.has('updated_at')) {
        database.exec("ALTER TABLE memos ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
      }
    } else if (migration.name === '003_ai_settings_schema') {
      database.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    } else {
      database.exec(migration.sql);
    }

    database.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(migration.name);
  }
}

function loadDatabaseConstructor() {
  try {
    return require('better-sqlite3');
  } catch (error) {
    if (!error || !/better-sqlite3/i.test(error.message)) {
      throw error;
    }
  }

  const sqliteModule = require('node:sqlite');
  if (sqliteModule.DatabaseSync) {
    return sqliteModule;
  }

  throw new Error('No compatible SQLite implementation is available.');
}

function createDatabaseInstance(dbPath) {
  const databaseModule = loadDatabaseConstructor();
  const DatabaseCtor = databaseModule.DatabaseSync || databaseModule.default?.DatabaseSync || databaseModule.Database || databaseModule.default;

  if (!DatabaseCtor) {
    throw new Error('Unable to locate a compatible SQLite constructor.');
  }

  return new DatabaseCtor(dbPath);
}

function initializeDatabase(electronApp) {
  if (dbInstance) {
    return dbInstance;
  }

  if (!electronApp?.getPath) {
    throw new Error('initializeDatabase requires an Electron app-like object with getPath()');
  }

  appContext = electronApp;
  const dbPath = path.join(electronApp.getPath('userData'), 'navalqda.db');
  ensureDatabaseDirectory(dbPath);

  dbInstance = createDatabaseInstance(dbPath);
  dbInstance.exec('PRAGMA journal_mode = WAL');
  applyMigrations(dbInstance);

  return dbInstance;
}

function getDatabase() {
  if (!dbInstance) {
    throw new Error('Database has not been initialized yet.');
  }
  return dbInstance;
}

function getUserDataPath() {
  if (!appContext?.getPath) {
    throw new Error('Database has not been initialized yet.');
  }
  return appContext.getPath('userData');
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getUserDataPath,
  closeDatabase,
  schemaSql,
};
