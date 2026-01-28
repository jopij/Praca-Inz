const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Disable cache for development
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        time: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Favicon - empty response
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

const PORT = process.env.PORT || 3000;
let server;

// Check for SSL certificates
const hasSSL = fs.existsSync('key.pem') && fs.existsSync('cert.pem');

if (hasSSL) {
    console.log('SSL certificates found, starting HTTPS server...');
    const privateKey = fs.readFileSync('key.pem', 'utf8');
    const certificate = fs.readFileSync('cert.pem', 'utf8');
    server = https.createServer({ key: privateKey, cert: certificate }, app);
} else {
    console.log('No SSL certificates, starting HTTP server...');
    console.log('Note: Camera/mic may not work without HTTPS');
    server = http.createServer(app);
}

// Import WebSocket server
const { initializeWebSocket } = require('./src/server/signaling');

// Initialize WebSocket
const wss = initializeWebSocket(server);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    if (hasSSL) {
        console.log('WebRTC Video Chat Server (HTTPS)');
        console.log('https://localhost:' + PORT);
        console.log('wss://localhost:' + PORT);
    } else {
        console.log('WebRTC Video Chat Server (HTTP)');
        console.log('http://localhost:' + PORT);
        console.log('ws://localhost:' + PORT);
    }
    console.log('\nFeatures:');
    console.log('   • Video calls with temporary chat');
    console.log('   • Camera disabled by default');
    console.log('   • Unique usernames');
    console.log('   • Media stream control');
    console.log('='.repeat(60));
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { server, wss };