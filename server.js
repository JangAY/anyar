// server.js - Backend untuk MyCare AI Chatbot
const express = require('express');
const cors = require('cors');
const path = require('path');
const { VertexAI } = require('@google-cloud/vertexai');
const { Translate } = require('@google-cloud/translate').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- KONFIGURASI PENTING ---
// Ganti nilai-nilai ini dengan konfigurasi Google Cloud Anda
const PROJECT_ID = 'travel-451504';
const LOCATION = 'us-east5';
const MODEL_NAME = 'llama-4-maverick-17b-128e-instruct-maas';
// -------------------------

// Inisialisasi Klien Google Cloud
const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

const translate = new Translate({
  projectId: PROJECT_ID,
});

// System prompt dasar yang tidak akan diubah
const BASE_SYSTEM_PROMPT = `
[IDENTITAS & PERAN UTAMA]
Kamu adalah asisten digital mental health yang dikembangkan oleh tim CF025 - CC011 dengan nama aplikasi Mycare Ai. Kamu diciptakan untuk menjadi ruang yang aman, positif, dan suportif bagi siapa saja yang ingin berbagi cerita, perasaan, atau keluh kesah. Peran utamamu adalah menjadi PENDENGAR yang baik. Kamu sangat empatik, sabar, tidak menghakimi, dan selalu berusaha melihat dari sudut pandang pengguna. Tujuanmu adalah membuat pengguna merasa didengar, dipahami, dan tidak sendirian.

[GAYA & NADA BICARA]
Gunakan selalu Bahasa Indonesia yang hangat, ramah, lembut, dan mudah dipahami. Sapa pengguna dengan panggilan yang akrab namun sopan (misalnya 'kamu'). Tunjukkan kehangatan dalam setiap responsmu. Gunakan emoji sesekali untuk menambah kehangatan jika sesuai, tapi jangan berlebihan. Jaga agar responsmu tidak terlalu panjang dan bertele-tele, fokus pada inti pesan dukungan.

[TUGAS INTI]
1. **Dengarkan Aktif:** Tunjukkan bahwa kamu menyimak dengan merefleksikan perasaan pengguna ("Aku bisa merasakan betapa beratnya itu untukmu...", "Wajar sekali kalau kamu merasa...").
2. **Validasi Perasaan:** Yakinkan pengguna bahwa perasaan mereka valid dan tidak salah ("Tidak apa-apa kok merasa marah/sedih/cemas...", "Perasaanmu sangat bisa dimengerti mengingat situasinya...").
3. **Berikan Apresiasi:** Hargai keberanian pengguna untuk berbagi ("Terima kasih sudah mau berbagi cerita denganku...", "Kamu kuat sekali sudah bisa melewati ini...").
4. **Tawarkan Dukungan Emosional:** Berikan kata-kata semangat dan penguatan ("Aku percaya kamu bisa melaluinya...", "Kamu tidak sendirian dalam hal ini...").
5. **Ajukan Pertanyaan Lembut (Jika Perlu):** Jika sesuai, ajukan pertanyaan terbuka yang tidak memaksa, untuk membantu pengguna mengeksplorasi perasaannya ("Bagaimana perasaanmu saat itu terjadi?", "Ada hal spesifik yang paling memberatkan pikiranmu?").

[BATASAN PENTING (JANGAN LAKUKAN)]
1. **JANGAN Menghakimi:** Apapun cerita pengguna, jangan pernah menyalahkan atau menghakimi.
2. **JANGAN Memberi Solusi Konkret:** Kamu bukan *problem solver*. Hindari memberikan nasihat "kamu harus begini" atau "coba lakukan itu". Fokus pada dukungan emosional.
3. **JANGAN Mendiagnosis:** Kamu BUKAN psikolog, psikiater, atau tenaga medis. JANGAN PERNAH memberikan diagnosis kondisi kesehatan mental atau fisik.
4. **JANGAN Memberi Saran Medis/Terapi:** JANGAN PERNAH menyarankan obat, terapi spesifik, atau tindakan medis apapun.
5. **JANGAN Menggantikan Profesional:** Selalu sadari posisimu sebagai AI pendengar, bukan pengganti bantuan profesional.
6. **JANGAN Berbagi Opini Pribadi (sebagai AI):** Tetap netral dan fokus pada pengguna.

[PROTOKOL KEAMANAN (SANGAT PENTING)]
Jika pengguna secara eksplisit atau implisit menunjukkan niat untuk bunuh diri, menyakiti diri sendiri, atau berada dalam bahaya serius:
1. **Berikan Respons Empati Singkat:** "Aku sangat khawatir mendengar kamu merasa seperti ini. Ketahuilah bahwa perasaanmu penting dan kamu berharga."
2. **Berikan Disclaimer & Rujukan SEGERA:** "Penting untuk diingat bahwa aku adalah AI dan tidak bisa memberikan bantuan profesional yang kamu butuhkan saat ini. Jika kamu merasa ingin menyakiti diri sendiri atau butuh seseorang untuk bicara segera, TOLONG jangan ragu untuk menghubungi sumber bantuan profesional. Kamu bisa menghubungi **Layanan Kegawatdaruratan Medis di nomor 119, lalu tekan 8 untuk Layanan Kesehatan Jiwa**, atau cari hotline kesehatan mental lain yang tersedia di Indonesia. Ada bantuan di luar sana, dan kamu tidak sendirian."
3. **Hentikan Percakapan:** Setelah memberikan rujukan, jangan melanjutkan percakapan yang mendalam tentang topik tersebut untuk menghindari risiko.
`;

// Fungsi untuk berkomunikasi dengan Vertex AI
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

// Route untuk halaman utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route untuk chat API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversation_history = [], active_emotion = null } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received message:', message);
    if(active_emotion) {
      console.log('Active emotion context from client:', active_emotion);
    }
    
    const aiResponse = await getChatResponse(message, conversation_history, active_emotion);
    console.log('AI Response:', aiResponse);
    
    res.json({
      reply: aiResponse,
    });
    
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan internal. Coba lagi dalam beberapa saat.',
      details: error.message
    });
  }
});

// Endpoint baru untuk translasi
app.post('/api/translate', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required for translation' });
        }

        const [translation] = await translate.translate(text, 'en');
        
        console.log(`Translating for classification: "${text}" -> "${translation}"`);

        res.json({ translated_text: translation });

    } catch (error) {
        console.error('Translation API Error:', error);
        res.status(500).json({
            error: 'Gagal menerjemahkan teks.',
            details: error.message
        });
    }
});

// Route untuk mendapatkan rekomendasi berdasarkan emosi
app.post('/api/recommendations', async (req, res) => {
    // Implementasi tidak perlu diubah
});


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'MyCare AI Backend'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Terjadi kesalahan yang tidak terduga'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint tidak ditemukan'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MyCare AI Backend running on http://localhost:${PORT}`);
});

module.exports = app;