import { createServer } from 'node:http'
import express from 'express'
import { Server } from 'socket.io'

import logger from 'morgan'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

const PORT = process.env.PORT ?? 1234
const HOST = '0.0.0.0' // Habilita conexiones desde cualquier dispositivo de la red local (conectarse con http:\\192.186.100.24:3000)

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  connectionStateRecovery: {}
});

const db = await open ({
  filename: 'Socket.io-chat-db',
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
  socket.on('chat message', async (msg) => {
    let result;
    try {
      // almacenar el mensaje en la base de datos
      result = await db.run('INSERT INTO messages (content) VALUES (?)', msg);
    } catch (e) {
      // TODO manejar el fallo
      return;
    }
    // incluir el offset con el mensaje
    io.emit('chat message', msg, result.lastID);
    console.log('message:', msg)
  })

  if (!socket.recovered) {
    // si la recuperación del estado de conexión no fue exitosa
    try {
      await db.each('SELECT id, content FROM messages WHERE id > ?',
        [socket.handshake.auth.serverOffset || 0],
        (_err, row) => {
          socket.emit('chat message', row.content, row.id);
        }
      )
    } catch (e) {
      // algo salió mal
    }
  }

  socket.on('disconnect', () => {
    console.log('A user has disconnected!')
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Server listening on http://<TU-IP-LOCAL>:${PORT}`)
})
