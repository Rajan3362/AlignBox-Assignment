class ChatApp {
    constructor() {
        this.currentChatId = null;
        this.messages = [];
        this.chats = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadChats();
        this.setupWebSocket();
    }

    bindEvents() {
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');

        sendButton.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Simulate receiving messages
        setInterval(() => {
            if (this.currentChatId && Math.random() > 0.7) {
                this.receiveMessage();
            }
        }, 10000);
    }

    async loadChats() {
        try {
            const response = await fetch('/api/chats');
            this.chats = await response.json();
            this.renderChats();
            
            // Select first chat by default
            if (this.chats.length > 0) {
                this.selectChat(this.chats[0].id);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            // Fallback to sample data
            this.chats = this.getSampleChats();
            this.renderChats();
            if (this.chats.length > 0) {
                this.selectChat(this.chats[0].id);
            }
        }
    }

    getSampleChats() {
        return [
            {
                id: 1,
                name: "Rajan",
                lastMessage: "Hey, how are you doing?",
                time: "10:30 AM",
                unread: 2
            },
            {
                id: 2,
                name: "Ashok",
                lastMessage: "Meeting at 3 PM tomorrow",
                time: "Yesterday",
                unread: 0
            },
            {
                id: 3,
                name: "Arichelvan",
                lastMessage: "Did you see the latest design?",
                time: "12:45 PM",
                unread: 1
            }
        ];
    }

    renderChats() {
        const chatList = document.querySelector('.chat-list');
        chatList.innerHTML = this.chats.map(chat => `
            <div class="chat-item ${this.currentChatId === chat.id ? 'active' : ''}" 
                 onclick="chatApp.selectChat(${chat.id})">
                <div class="avatar"></div>
                <div class="chat-info">
                    <h4>${chat.name}</h4>
                    <p>${chat.lastMessage}</p>
                </div>
                <div class="chat-meta">
                    <div>${chat.time}</div>
                    ${chat.unread > 0 ? `<div style="margin-top: 5px; background: #667eea; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">${chat.unread}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    async selectChat(chatId) {
        this.currentChatId = chatId;
        this.renderChats();
        
        try {
            const response = await fetch(`/api/messages/${chatId}`);
            this.messages = await response.json();
            this.renderMessages();
        } catch (error) {
            console.error('Error loading messages:', error);
            // Fallback to sample messages
            this.messages = this.getSampleMessages();
            this.renderMessages();
        }

        // Update chat header
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            document.querySelector('.user-details h3').textContent = chat.name;
        }
    }

    getSampleMessages() {
        return [
            {
                id: 1,
                content: "Hello! How are you doing today?",
                sender: "other",
                timestamp: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 2,
                content: "I'm doing great! Just working on some new projects.",
                sender: "user",
                timestamp: new Date(Date.now() - 1800000).toISOString()
            },
            {
                id: 3,
                content: "That sounds interesting. Can you tell me more about it?",
                sender: "other",
                timestamp: new Date(Date.now() - 600000).toISOString()
            }
        ];
    }

    renderMessages() {
        const messagesContainer = document.querySelector('.messages');
        messagesContainer.innerHTML = this.messages.map(message => `
            <div class="message ${message.sender === 'user' ? 'sent' : 'received'}">
                <div class="message-content">${message.content}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
            </div>
        `).join('');

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content || !this.currentChatId) return;

        const message = {
            content: content,
            sender: 'user',
            timestamp: new Date().toISOString(),
            chatId: this.currentChatId
        };

        // Add message immediately for better UX
        this.messages.push(message);
        this.renderMessages();
        input.value = '';

        try {
            await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message)
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    receiveMessage() {
        const responses = [
            "That's great to hear!",
            "I understand what you mean.",
            "Let me think about that...",
            "Can you explain more?",
            "I agree with you!",
            "That sounds interesting!"
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        const message = {
            id: Date.now(),
            content: randomResponse,
            sender: 'other',
            timestamp: new Date().toISOString(),
            chatId: this.currentChatId
        };

        this.messages.push(message);
        this.renderMessages();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    }

    setupWebSocket() {
        // WebSocket implementation for real-time messaging
        // This would be implemented with your WebSocket server
        console.log('WebSocket setup would go here');
    }
}

// Initialize the chat application
const chatApp = new ChatApp();