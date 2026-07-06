const express = require('express');
const http = require('http');
const bcrypt = require('bcrypt');
const cors = require('cors');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 2846;
const GATEWAY_KEYWORD = process.env.GATEWAY_KEYWORD || 'neopix-super-secret-2026';

// Cloudflare D1 Credentials
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || 'your_cf_account_id';
const CF_D1_DATABASE_ID = process.env.CF_D1_DATABASE_ID || 'your_d1_database_id';
const CF_API_TOKEN = process.env.CF_API_TOKEN || 'your_cf_api_token';

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- SECURE API GATEWAY ---
app.use('/api', (req, res, next) => {
    const clientKey = req.headers['x-host-keyword'];
    if (clientKey !== GATEWAY_KEYWORD) {
        return res.status(403).json({ error: 'Gateway Access Denied. Invalid Host Keyword.' });
    }
    next();
});

// --- CLOUDFLARE D1 ADAPTER ---
// This function strictly handles the POST request to Cloudflare's D1 query endpoint
async function queryD1(sql, params = []) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql, params })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            console.error("[D1 Error]", data.errors);
            throw new Error('Cloudflare D1 Query Failed');
        }
        
        // Cloudflare returns results nested inside an array
        return data.result[0].results; 
    } catch (err) {
        console.error("[D1 Fetch Exception]", err);
        throw err;
    }
}

// --- CORE UTILITY: RANDOM NUMBER GENERATOR ---
// Continually checks D1 to ensure the 6-digit number is 100% unique before assigning
async function generateUniqueNumber() {
    let isUnique = false;
    let newNumber;
    
    while (!isUnique) {
        newNumber = Math.floor(100000 + Math.random() * 900000).toString();
        const existing = await queryD1('SELECT id FROM users WHERE assigned_number = ?', [newNumber]);
        
        if (existing.length === 0) {
            isUnique = true;
        }
    }
    return newNumber;
}

// --- API ROUTES ---

// 1. REGISTER
app.post('/api/register', async (req, res) => {
    const { username, display_name, password } = req.body;
    
    try {
        // Check if username already exists
        const userCheck = await queryD1('SELECT id FROM users WHERE username = ?', [username]);
        if (userCheck.length > 0) {
            return res.status(400).json({ error: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const assignedNumber = await generateUniqueNumber();

        // Insert into D1
        await queryD1(
            'INSERT INTO users (username, display_name, password_hash, assigned_number) VALUES (?, ?, ?, ?)',
            [username, display_name, hashedPassword, assignedNumber]
        );

        res.status(201).json({
            success: true,
            user: { username, display_name, assigned_number: assignedNumber }
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// 2. LOGIN & AUTH LOGGING
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    try {
        const users = await queryD1('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Store the Auth Log in D1 for compliance (Metadata only)
        await queryD1(
            'INSERT INTO auth_logs (user_id, ip_address, login_time) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [user.id, ipAddress]
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                assigned_number: user.assigned_number
            }
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

server.listen(PORT, () => {
    console.log(`[Acnos Core] Headless signaling engine running on port ${PORT}. D1 Gateway Active.`);
});
