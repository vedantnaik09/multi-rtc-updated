const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
  headers: {
    "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
    "OpenAI-Beta": "realtime=v1",
  },
});

openaiWs.on('open', () => {
  console.log('Connected to OpenAI WebSocket');
  openaiWs.send(JSON.stringify({
    type: "response.create",
    response: {
      modalities: ["text"],
      instructions: "Please assist the user.",
    }
  }));
});

openaiWs.on('message', (message) => {
  const parsedMessage = JSON.parse(message.toString());
  io.emit('openai_message', parsedMessage);
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('start_recording', (data) => {
    // Handle start recording logic
    console.log('Start recording', data);
  });

  socket.on('stop_recording', () => {
    // Handle stop recording logic
    console.log('Stop recording');
  });

  socket.on('send_message', (message) => {
    openaiWs.send(JSON.stringify({
      type: "text.create",
      text: {
        content: message,
      }
    }));
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));