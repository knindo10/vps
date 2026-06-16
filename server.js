const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Serve static files (HTML, CSS, JS) from the current directory
app.use(express.static(path.join(__dirname)));

// API Routes Adapter
// Route untuk Checkout
app.post('/api/checkout', async (req, res) => {
    try {
        const handler = require('./api/checkout');
        await handler(req, res);
    } catch (error) {
        console.error('Checkout Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route untuk Callback
app.post('/api/callback', async (req, res) => {
    try {
        const handler = require('./api/callback');
        await handler(req, res);
    } catch (error) {
        console.error('Callback Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Fallback dihapus sementara untuk kompatibilitas
// app.get('*', ...);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n===================================================`);
    console.log(`🚀 Server BERHASIL berjalan!`);
    console.log(`👉 Buka link ini di browser: http://localhost:${PORT}`);
    console.log(`===================================================\n`);
});
