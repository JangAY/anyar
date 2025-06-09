const express = require('express');
const cors = require('cors');
const path = require('path');
const { JWT } = require('google-auth-library');
const { VertexAI } = require('@google-cloud/vertexai');
const { Translate } = require('@google-cloud/translate').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// === Gunakan Environment Variable GCP_KEY_JSON ===
const credentials = JSON.parse(process.env.GCP_KEY_JSON);

// Inisialisasi Google Auth client
const client = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

// Gunakan klien ini untuk VertexAI dan Translate
const PROJECT_ID = credentials.project_id;
const LOCATION = 'us-east5';
const MODEL_NAME = 'llama-4-maverick-17b-128e-instruct-maas';

// Inisialisasi Klien Google Cloud
const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
  authClient: client
});

const translate = new Translate({
  projectId: PROJECT_ID,
  authClient: client
});

// === Prompt Sistem Tetap Sama ===
const BASE_SYSTEM_PROMPT = `...`; // (potong agar tidak duplikatif, tetap sama dengan yang kamu tulis)

async function getChatResponse(message, conversationHistory = [], activeEmotion = null) {
  try {
    let dynamicSystemPrompt = BASE_SYSTEM_PROMPT;
    const emotionMap = {
      sadness: 'kesedihan',
      anger: 'kemarahan',
      fear: 'kecemasan atau ketakutan',
      suicidal: 'perasaan ingin menyerah atau krisis'
    };

    if (activeEmotion && emotionMap[activeEmotion]) {
      const emotionText = emotionMap[activeEmotion];
      dynamicSystemPrompt += `\n\n[KONTEKS TAMBAHAN PENTING]\nModel frontend telah mendeteksi bahwa pengguna kemungkinan sedang merasakan ${emotionText}. Berikan perhatian khusus pada perasaan ini. Validasi emosi mereka, tawarkan dukungan yang lebih mendalam terkait ${emotionText}, dan tunjukkan empati ekstra. Fokuslah percakapan untuk membantu mereka merasa didengar mengenai isu ini.`;
      console.log(`System prompt diperkaya dengan konteks: ${activeEmotion}`);
    }

    const model = vertexAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: { parts: [{ text: dynamicSystemPrompt }] },
    });

    const history = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const response = result.response;
    
    return response.candidates[0].content.parts[0].text;
    
  } catch (error) {
    console.error('Error getting chat response:', error);
    throw error;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversation_history = [], active_emotion = null } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    console.log('Received message:', message);
    if (active_emotion) {
      console.log('Active emotion context from client:', active_emotion);
    }

    const aiResponse = await getChatResponse(message, conversation_history, active_emotion);
    console.log('AI Response:', aiResponse);

    res.json({ reply: aiResponse });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Internal error', details: error.message });
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const [translation] = await translate.translate(text, 'en');
    console.log(`Translating: "${text}" -> "${translation}"`);

    res.json({ translated_text: translation });
  } catch (error) {
    console.error('Translation API Error:', error);
    res.status(500).json({ error: 'Gagal menerjemahkan teks.', details: error.message });
  }
});

app.post('/api/recommendations', async (req, res) => {
  // Implementasi opsional
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'MyCare AI Backend'
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Terjadi kesalahan yang tidak terduga'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint tidak ditemukan'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 MyCare AI Backend running on http://localhost:${PORT}`);
});

module.exports = app;
