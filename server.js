const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System instructions for Revolt Motors
const SYSTEM_INSTRUCTIONS = `You are a helpful AI assistant for Revolt Motors, an electric vehicle company. 
You should only provide information about Revolt Motors, their electric vehicles, services, and related topics.
If asked about other topics, politely redirect the conversation back to Revolt Motors.
Be conversational, friendly, and knowledgeable about electric vehicles and Revolt Motors' offerings.`;

// Store active conversations
const activeConversations = new Map();

// Get greeting based on time
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Initialize conversation automatically
  socket.on('initializeChat', async (mode) => {
    try {
      console.log(`Initializing ${mode} chat for client:`, socket.id);
      
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash"
      });
      
      const conversation = model.startChat({
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });

      activeConversations.set(socket.id, conversation);
      console.log(`${mode} chat initialized for client:`, socket.id);
      
      // Send appropriate greeting
      const greeting = getGreeting();
      let welcomeMessage;
      
      if (mode === 'voice') {
        welcomeMessage = `${greeting} I'm your Revolt Motors voice assistant. How can I help you today?`;
      } else {
        welcomeMessage = `${greeting} I'm your Revolt Motors text assistant. How can I help you today?`;
      }
      
      socket.emit('chatInitialized', { greeting: welcomeMessage, mode: mode });
    } catch (error) {
      console.error('Error initializing chat:', error);
      socket.emit('error', 'Failed to initialize chat: ' + error.message);
    }
  });

  socket.on('textMessage', async (message) => {
    try {
      console.log('Processing text message for client:', socket.id, 'Message:', message);
      const conversation = activeConversations.get(socket.id);
      if (!conversation) {
        socket.emit('error', 'No active conversation');
        return;
      }

      let result;
      // Check if this is the first message and set system instructions
      if (!socket.hasSetInstructions) {
        const setupMessage = `${SYSTEM_INSTRUCTIONS}\n\nUser: ${message}`;
        result = await conversation.sendMessage(setupMessage);
        socket.hasSetInstructions = true;
      } else {
        result = await conversation.sendMessage(message);
      }
      
      const response = result.response;
      const text = response.text();
      
      console.log('AI Response:', text);
      socket.emit('aiResponse', {
        text: text,
        audio: null
      });

    } catch (error) {
      console.error('Error processing text message:', error);
      socket.emit('error', 'Failed to process text message: ' + error.message);
    }
  });

  socket.on('voiceMessage', async (audioData) => {
    try {
      console.log('Processing voice message for client:', socket.id);
      const conversation = activeConversations.get(socket.id);
      if (!conversation) {
        socket.emit('error', 'No active conversation');
        return;
      }

      // Simulate different voice inputs to avoid repetition
      const voiceInputs = [
        "Tell me about Revolt Motors electric vehicles",
        "What are the features of your latest model?",
        "How does the charging system work?",
        "What services do you offer?",
        "Tell me about the RV400 model",
        "What's the range of your electric bikes?",
        "How much do your motorcycles cost?",
        "What makes Revolt Motors special?"
      ];
      
      const randomIndex = Math.floor(Math.random() * voiceInputs.length);
      const simulatedText = voiceInputs[randomIndex];
      
      console.log('Simulated voice-to-text:', simulatedText);
      
      let result;
      // Check if this is the first message and set system instructions
      if (!socket.hasSetInstructions) {
        const setupMessage = `${SYSTEM_INSTRUCTIONS}\n\nUser: ${simulatedText}`;
        result = await conversation.sendMessage(setupMessage);
        socket.hasSetInstructions = true;
      } else {
        result = await conversation.sendMessage(simulatedText);
      }
      
      const response = result.response;
      const text = response.text();
      
      console.log('AI Response to voice:', text);
      socket.emit('aiResponse', {
        text: text,
        audio: null
      });

    } catch (error) {
      console.error('Error processing voice message:', error);
      socket.emit('error', 'Failed to process voice message: ' + error.message);
    }
  });

  socket.on('voiceGreeting', async () => {
    try {
      console.log('Voice greeting requested for client:', socket.id);
      
      // Initialize conversation for voice chat
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash"
      });
      
      const conversation = model.startChat({
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });

      activeConversations.set(socket.id, conversation);
      console.log('Voice conversation initialized for client:', socket.id);
      
      const greeting = getGreeting();
      const welcomeMessage = `${greeting} I'm your Revolt Motors voice assistant. How can I help you today?`;
      
      socket.emit('aiResponse', {
        text: welcomeMessage,
        audio: null
      });
    } catch (error) {
      console.error('Error sending voice greeting:', error);
      socket.emit('error', 'Failed to send greeting: ' + error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    activeConversations.delete(socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to use the voice chat`);
  console.log('API Key status:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
});
