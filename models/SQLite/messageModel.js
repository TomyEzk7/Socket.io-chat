import { openDB } from './db.js'

export async function insertMessage(msg, clientOffset) {
    const db = openDB(); 
    const result = await db.run(
        'INSERT INTO messages (content, client_offset) VALUES (?, ?)', [msg, clientOffset]
    );
    await db.close(); 
    return result.lastID;
} 

export async function insertPrivateMessage (fromId, toId, msg) {
    const db = openDB(); 
    const result = await db.run(
        'INSERT INTO messages (from_user_id, to_user_id, content) VALUES (?, ?, ?)', [fromId, toId, msg]
    );
    await db.close();
    return result.lastID;
} 

export async function getMessagesSince (offset, cb) { 
    const db = openDB(); 
    await db.each('SELECT id, content FROM messages where id > ?', [offset], cb);
    await db.close();
}


  