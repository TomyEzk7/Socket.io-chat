import { openDB } from './db.js';

export async function validateUser (username, password) {
    const db = await openDB();
    
    const row = await db.get(
    'SELECT * FROM users WHERE username = ? and password = ?',
    [username, password]
    );
    await db.close();

    return !!row;
}

export async function getUserByUsername(username) {
    const db = openDB();
    const user = await db.get(
        'SELECT * FROM users WHERE username = ?', username
    );
    await db.close();

    return user;
}

export async function createUser(username, password) {
    const db = openDB();
    const result = await db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)', [username, password]
    );
    await db.close();
    return result.lastID
}