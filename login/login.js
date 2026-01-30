// Tengo que mandar los datos del login al servidor para validar y devolver 

async function login() {
const username = document.getElementById('username').value;
const password = document.getElementById('password').value;

try { 
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
    console.log('fetch error:', err);
}}

document.getElementById('login-button').addEventListener('click', login)


