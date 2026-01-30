

async function login() {
const username = document.getElementById('username').value;
const password = document.getElementById('password').value;

try {
    console.log({username, password}) 
    const res = await fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'Application/json'},
        body: JSON.stringify({username, password})
    });
    
    if (!res.ok) {
        const text = await res.text();
        alert(text);
    }
    
} catch (e) {
    console.log('fetch error:', e);
}} // esto manda los datos del login al servidor y espera una respuesta

document.getElementById('login-button').addEventListener('click', login)


