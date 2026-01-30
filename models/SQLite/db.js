import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function openDB() {
  const db = await open({
    filename: 'socket.io-chat.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS private_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}
