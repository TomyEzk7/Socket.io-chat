import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* REDIS ADAPTER */
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

/* CONTROLLERS */
import { getLoginPage, postLogin } from '../controllers/authController.js';
import { initChat } from '../controllers/chatController.js';

import authRouter from '../routes/authRoutes.js'

/* CONFIG */
const PORT = process.env.PORT ?? 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startWorker() {
  const app = express();
  const server = createServer(app);

  /* Redis */
  const pubClient = createClient({ url: 'redis://localhost:6379' }); // Crea clientes de REDIS (Publish, Subscribe)
  const subClient = pubClient.duplicate();

  /* Socket.io */
  const io = new Server(server, {
    connectionStateRecovery: {},
    adapter: createAdapter(pubClient, subClient) // Aplica capa de Socket.io para WebSocket. Prepara para REDIS
  });

  pubClient.on('error', e => console.error('Redis error:', e));
  subClient.on('error', e => console.error('Redis error:', e)); // Controla errores de REDIS

  await pubClient.connect();
  await subClient.connect(); // Conecta los clientes

 
  /* Middlewares */
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // ?

  /* Carpetas estáticas */
  app.use('/login', express.static(join(__dirname, '../views/login')));
  app.use('/chat', express.static(join(__dirname, '../views/chat'))); // para poder servir carpetas estaticas

  app.use('/', authRouter);

  await initChat(io); 

  server.listen(PORT, () => {
    console.log(`Worker ${process.pid} listening on ${PORT}`);
  });
}
