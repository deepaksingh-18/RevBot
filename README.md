# RevBot
# Revolt Motors Voice Chat

A real-time conversational voice interface using the Gemini Live API, replicating the functionality of the Revolt Motors chatbot.

## Features

- 🎤 **Real-time Voice Chat**: Speak naturally with the AI assistant
- 🔄 **Interruption Support**: Interrupt the AI while it's speaking
- 💬 **Text Chat**: Type messages as an alternative to voice
- 🎯 **Revolt Motors Focused**: AI trained specifically on Revolt Motors information
- ⚡ **Low Latency**: Optimized for quick responses (1-2 seconds)
- 🎨 **Modern UI**: Clean, responsive interface
- 🔒 **Secure**: Server-to-server architecture for enhanced security

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google AI Studio API key
- Modern web browser with microphone support

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd mybot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Get your Gemini API key:
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Create a free account
   - Generate an API key
   - Copy the API key

3. Edit the `.env` file and add your API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   PORT=3000
   ```

### 4. Start the Application

#### Development Mode (with auto-restart):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

### 5. Access the Application

Open your web browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Start the Conversation**: Click the "Start Voice Chat" button
2. **Voice Interaction**: Click the microphone button and speak your question
3. **Text Interaction**: Type your message in the text input field
4. **Interruptions**: You can interrupt the AI while it's speaking by starting a new voice input

## API Model Configuration

The application is configured to use the native audio dialog model:
- **Production**: `gemini-2.5-flash-preview-native-audio-dialog`
- **Development**: `gemini-2.0-flash-live-001` (for testing to avoid rate limits)

## System Instructions

The AI is configured with specific instructions to focus on Revolt Motors:

```
You are a helpful AI assistant for Revolt Motors, an electric vehicle company. 
You should only provide information about Revolt Motors, their electric vehicles, services, and related topics.
If asked about other topics, politely redirect the conversation back to Revolt Motors.
Be conversational, friendly, and knowledgeable about electric vehicles and Revolt Motors' offerings.
```

## Architecture

- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: Vanilla JavaScript with Web Audio API
- **Real-time Communication**: Socket.IO for bidirectional communication
- **Audio Processing**: Web Audio API for recording and playback
- **AI Integration**: Google Generative AI (Gemini Live API)

## File Structure

```
mybot/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── env.example           # Environment variables template
├── .env                  # Environment variables (create this)
├── README.md             # This file
└── public/               # Frontend files
    ├── index.html        # Main HTML file
    ├── styles.css        # CSS styles
    └── app.js           # Frontend JavaScript
```

## Troubleshooting

### Common Issues

1. **Microphone Permission Denied**
   - Ensure your browser has permission to access the microphone
   - Check browser settings and allow microphone access

2. **API Key Issues**
   - Verify your Gemini API key is correct
   - Check that the API key has the necessary permissions
   - Ensure you're not exceeding rate limits

3. **Audio Not Working**
   - Check if your microphone is properly connected
   - Try refreshing the page
   - Check browser console for errors

4. **Connection Issues**
   - Ensure the server is running on the correct port
   - Check firewall settings
   - Verify network connectivity

### Rate Limits

The free tier of Gemini API has rate limits. For development and testing:
- Use `gemini-2.0-flash-live-001` model to avoid daily request limits
- Switch to `gemini-2.5-flash-preview-native-audio-dialog` for production

## Development

### Adding New Features

1. **Backend Changes**: Modify `server.js`
2. **Frontend Changes**: Modify files in the `public/` directory
3. **Styling Changes**: Update `public/styles.css`

### Testing

1. Test voice recording functionality
2. Verify interruption capabilities
3. Check response latency
4. Test on different browsers and devices

## Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment
1. Set up environment variables
2. Run `npm start`
3. Use a process manager like PM2 for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the browser console for errors
3. Verify API key configuration
4. Test with different browsers

## Demo Requirements

For the demo video, ensure you demonstrate:
- Natural conversation flow
- Clear interruption of AI responses
- Overall responsiveness and low latency
- Both voice and text interaction modes
