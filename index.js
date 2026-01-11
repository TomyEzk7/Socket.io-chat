import { createServer } from 'node:http'
import express from 'express'
import { Server } from 'socket.io'

import logger from 'morgan' // loggea cada peticion
import { fileURLToPath } from 'node:url' // para convertir la url en una ruta usable
import { dirname, join } from 'node:path' // dirname devuelve directorio que contiene al archivo que le paso

const PORT = process.env.PORT ?? 3000

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer)

app.use (logger('dev'))

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req,res) => {
    res.sendFile(join(__dirname,'client','index.html')) // esto es para que sirva bien el archivo desde cualquier lugar donde se ejecute el proyecto
})


httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})

io.on('connection', (socket) => {
        socket.emit('firstConnection', 'Welcome to Socket.io Chat!')
      })

io.on('connection', (socket) => {
    console.log('A user has connected!')
    
    socket.on('chat message', (msg) => { 
        console.log('message: ' + msg)
        io.emit('chat message', msg);
  });
});

