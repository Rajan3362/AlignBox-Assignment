const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('../frontend'));

// Database connection
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Rajan@2003',
    database: 'alignbox_chat'
};

let db;

async function initializeDatabase() {
    try {
        db = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL database');
        
        // Create tables if they don't exist
        await db.execute(`
            CREATE TABLE IF NOT EXISTS chats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                last_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                chat_id INT,
                content TEXT NOT NULL,
                sender ENUM('user', 'other') NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats(id)
            )
        `);

        // Insert sample data if no chats exist
        const [chats] = await db.execute('SELECT COUNT(*) as count FROM chats');
        if (chats[0].count === 0) {
            await insertSampleData();
        }

    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

async function insertSampleData() {
    const sampleChats = [
        ['John Doe'],
        ['Sarah Smith'],
        ['Mike Johnson']
    ];

    for (const [name] of sampleChats) {
        const [result] = await db.execute(
            'INSERT INTO chats (name) VALUES (?)',
            [name]
        );

        // Insert sample messages for each chat
        const sampleMessages = [
            [result.insertId, 'Hello! How are you doing today?', 'other'],
            [result.insertId, "I'm doing great! Just working on some new projects.", 'user'],
            [result.insertId, "That sounds interesting. Can you tell me more about it?", 'other']
        ];

        for (const [chatId, content, sender] of sampleMessages) {
            await db.execute(
                'INSERT INTO messages (chat_id, content, sender) VALUES (?, ?, ?)',
                [chatId, content, sender]
            );
        }

        // Update last message
        await db.execute(
            'UPDATE chats SET last_message = ? WHERE id = ?',
            [sampleMessages[sampleMessages.length - 1][1], result.insertId]
        );
    }
}

// API Routes

// Get all chats
app.get('/api/chats', async (req, res) => {
    try {
        const [chats] = await db.execute(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.sender = 'other' AND m.id > COALESCE((SELECT last_read_message_id FROM user_chat WHERE chat_id = c.id), 0)) as unread_count
            FROM chats c
            ORDER BY c.updated_at DESC
        `);
        
        const formattedChats = chats.map(chat => ({
            id: chat.id,
            name: chat.name,
            lastMessage: chat.last_message,
            time: formatTime(chat.updated_at),
            unread: chat.unread_count
        }));

        res.json(formattedChats);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get messages for a chat
app.get('/api/messages/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const [messages] = await db.execute(`
            SELECT * FROM messages 
            WHERE chat_id = ? 
            ORDER BY timestamp ASC
        `, [chatId]);

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send a new message
app.post('/api/messages', async (req, res) => {
    try {
        const { content, sender, chatId } = req.body;
        
        const [result] = await db.execute(
            'INSERT INTO messages (chat_id, content, sender) VALUES (?, ?, ?)',
            [chatId, content, sender]
        );

        // Update chat's last message and timestamp
        await db.execute(
            'UPDATE chats SET last_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [content, chatId]
        );

        // Broadcast the new message to all connected clients
        const [newMessage] = await db.execute(
            'SELECT * FROM messages WHERE id = ?',
            [result.insertId]
        );

        io.emit('newMessage', newMessage[0]);
        res.json(newMessage[0]);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// WebSocket for real-time communication
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinChat', (chatId) => {
        socket.join(chatId);
    });

    socket.on('sendMessage', async (messageData) => {
        try {
            const [result] = await db.execute(
                'INSERT INTO messages (chat_id, content, sender) VALUES (?, ?, ?)',
                [messageData.chatId, messageData.content, messageData.sender]
            );

            await db.execute(
                'UPDATE chats SET last_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [messageData.content, messageData.chatId]
            );

            const [newMessage] = await db.execute(
                'SELECT * FROM messages WHERE id = ?',
                [result.insertId]
            );

            io.to(messageData.chatId).emit('newMessage', newMessage[0]);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    } else if (days === 1) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

// Start server
initializeDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});