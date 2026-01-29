import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import logger from 'morgan';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

/* ==== REDIS ADAPTER ==== */
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

/* =========================
  CONFIG
========================= */

const PORT = process.env.PORT ?? 3000;
const HOST = '0.0.0.0';

/* =========================
  REDIS
========================= */
const pubClient = createClient({
  url: 'redis://localhost:6379'
});
const subClient = pubClient.duplicate();

await pubClient.connect();
await subClient.connect();


/* =========================
  HELPERS
========================= */

function emitWithRetry(socket, event, args, retries = 3) {
  if (!socket.connected) return;

  socket
    .timeout(5000)
    .emit(event, ...args, (err) => {
      if (err && retries > 0) {
        emitWithRetry(socket, event, args, retries - 1);
      }
    });
}

/* =========================
  WORKER LOGIC
========================= */

async function startWorker() {
  const app = express();
  const server = createServer(app);

  const io = new Server(server, {
    connectionStateRecovery: {},
    adapter: createAdapter (pubClient, subClient)
  });

/* ---------- DB ---------- */

  const db = await open({
    filename: 'Socket.io-chat.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL
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

/* ---------- EXPRESS ---------- */

  app.use(logger('dev'));

  const __dirname = dirname(fileURLToPath(import.meta.url));
  app.use(express.static(join(__dirname, 'client')));

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'client', 'index.html'));
  });

/* ---------- STATE ---------- */

  function createPrivateRoom(a, b) {
    return [a, b].sort((x, y) => x - y).join('#');
  }

/* ---------- SOCKET.IO ---------- */

  io.on('connection', async (socket) => {
    const { username, serverOffset = 0 } = socket.handshake.auth;

    if (!username) {
      socket.disconnect();
      return;
    }

    let user = await db.get(
      'SELECT id FROM users WHERE username = ?',
      username
    );

    let userId;
    if (!user) {
      const result = await db.run(
        'INSERT INTO users (username) VALUES (?)',
        username
      );
      userId = result.lastID;
    } else {
      userId = user.id;
    }

    socket.userId = userId;
    
    const userRoom = `user#${userId}`;
    socket.join(userRoom);

/* ----- CHAT GLOBAL ----- */

    socket.on('chat message', async (msg, clientOffset, ack) => {
      try {
        const result = await db.run(
          'INSERT INTO messages (content, client_offset) VALUES (?, ?)',
          msg,
          clientOffset
        );

        io.emit('chat message', msg, result.lastID);
        ack?.();
      } catch {
        ack?.();
      }
    });

/* ----- CHAT PRIVADO ----- */

    socket.on('private message', async ({ toUserId, msg }, _, ack) => {
      if (!toUserId || !msg) return;

      const room = createPrivateRoom(socket.userId, toUserId);

      socket.join(room);
      io.to(`user#${toUserId}`).socketsJoin(room);

      const result = await db.run(
        `INSERT INTO private_messages
        (from_user_id, to_user_id, content)
        VALUES (?, ?, ?)`,
        socket.userId,
        toUserId,
        msg
      );

      io.to(room).emit('private message', {
        fromUserId: socket.userId,
        msg,
        id: result.lastID
      });

      ack?.();
    });

/* ----- RECOVERY ----- */

    if (!socket.recovered) {
      await db.each(
        'SELECT id, content FROM messages WHERE id > ?',
        [serverOffset],
        (_err, row) => {
          emitWithRetry(socket, 'chat message', [row.content, row.id]);
        }
      );
    }

    socket.on('disconnect', () => {
      console.log('A user has disconnected!')
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`Worker ${process.pid} escuchando en ${PORT}`);
  });
}

/* =========================
  CLUSTER
========================= */

if (cluster.isPrimary) {
  setupPrimary();

  const cpus = availableParallelism();
  for (let i = 0; i < cpus; i++) {
    cluster.fork();
  }
  console.log(`Primary ${process.pid} active`);
  return;
} 

startWorker();