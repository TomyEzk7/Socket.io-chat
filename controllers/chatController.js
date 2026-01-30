import { getUserByUsername, createUser } from '../models/SQLite/userModel.js';
import { insertMessage, insertPrivateMessage, getMessagesSince } from '../models/SQLite/messageModel.js';


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

export async function initChat(io) {
  function createPrivateRoom(a, b) {
    return [a, b].sort((x, y) => x - y).join('#');
  }

  io.on('connection', async (socket) => {
    const { username, serverOffset = 0 } = socket.handshake.auth;
    if (!username) return socket.disconnect();

    let user = await getUserByUsername(username);
    let userId = user ? user.id : await CreateUser(username);

    socket.userId = userId;
    socket.join(`user#${userId}`);

    /* CHAT GLOBAL */
    socket.on('chat message', async (msg, clientOffset, ack) => {
      try {
        const lastID = await insertMessage(msg, clientOffset);
        io.emit('chat message', msg, lastID);
        ack?.({ success: true, id: lastID });
      } catch (e) {
        ack?.({ success: false, error: e.message });
      }
    });

    /* CHAT PRIVADO */
    socket.on('private message', async ({ toUserId, msg }, _, ack) => {
      if (!toUserId || !msg) return ack?.({ success: false, error: 'Missing fields' });
      try {
        const room = createPrivateRoom(socket.userId, toUserId);
        socket.join(room);
        io.to(`user#${toUserId}`).socketsJoin(room);

        const lastID = await insertPrivateMessage(socket.userId, toUserId, msg);
        io.to(room).emit('private message', { fromUserId: socket.userId, msg, id: lastID });
        ack?.({ success: true, id: lastID });
      } catch (e) {
        console.log('private message error:', e);
        ack?.({ success: false, error: e.message });
      }
    });

    /* RECOVERY */
    if (!socket.recovered) {
      await getMessagesSince(serverOffset, row => {
        emitWithRetry(socket, 'chat message', [row.content, row.id]);
      });
    }

    socket.on('disconnect', () => console.log(`User ${username} disconnected!`));
  });
}
