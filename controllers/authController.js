import { validateUser } from '../models/SQLite/userModel.js'
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function getLoginPage(req, res) { 
    res.sendFile(join(__dirname, '../views/login/login.html'
    ))
}

export async function postLogin (req, res) {
    const { username, password } = req.body;
    
    try {
        const valid = await validateUser(username, password);

        if (valid) {
            res.redirect('/chat/index.html')
        } else {
            res.status(401).send('Invalid credentials')
        }
    } catch (e) {
        console.log(e);
        res.status(500).send('Server Error');
    }
}