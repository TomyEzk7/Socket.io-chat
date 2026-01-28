import { createServer } from 'node:http'
import express from 'express'
import { Server } from 'socket.io'

import logger from 'morgan'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

const PORT = process.env.PORT ?? 1234
const HOST = '0.0.0.0' // Habilita conexiones desde cualquier dispositivo de la red local

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  connectionStateRecovery: {}
});

function emitWithRetry(socket, event, args, retries = 3) {
  if (!socket.connected) return;
  
  socket
    .timeout(5000)
    .emit(event, ...args, (err) => {
      if (err) {
        if (retries > 0) {
          console.log (`retrying ${event}, remaining attemps: ${retries}`)
          emitWithRetry(socket, event, args, retries - 1)
        } else {
          console.log(`the event ${event} has failed to send`)
        }
      }
    })
}

function broadcastWithRetry(io, event, args, retries = 3) {
  for (const socket of io.sockets.sockets.values()){
    emitWithRetry(socket, event, args, retries);
  }
}
 
const db = await open ({
  filename: 'Socket.io-chat.db',
  driver: sqlite3.Database
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_offset TEXT UNIQUE, 
  content TEXT
  );
`);

app.use(logger('dev'))

const __dirname = dirname(fileURLToPath(import.meta.url))

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'client', 'index.html'))
})

io.on('connection', async (socket) => {

  socket.on('chat message', async (msg, clientOffset, serverAck) => {
    let result;
    try {
      result = await db.run(
        'INSERT INTO messages (content, client_offset) VALUES (?, ?)',
        msg,
        clientOffset
      );
    } catch (e) {
      if (e.errno === 19 && typeof serverAck === 'function') {
        serverAck();
      }
      return;
    }

    broadcastWithRetry(io, 'chat message', [msg, result.lastID]);

    if (typeof serverAck === 'function') {
      serverAck();
    }
  }); 

  if (!socket.recovered) {
    try {
      await db.each(
        'SELECT id, content FROM messages WHERE id > ?',
        [socket.handshake.auth.serverOffset || 0],
        (_err, row) => {
          emitWithRetry(socket, 'chat message', [row.content, row.id]);
        }
      );
    } catch (e) {
      console.log(e);
    }
  }

  socket.on('disconnect', () => {
    console.log('A user has disconnected!');
  });

});

httpServer.listen(PORT, HOST, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
