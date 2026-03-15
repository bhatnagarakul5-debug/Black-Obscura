require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Gemini
const genAI = new GoogleGenerativeAI((process.env.GEMINI_KEY || '').trim());

// GNews API Proxy
app.get('/api/news', async (req, res) => {
  try {
    const q = req.query.q || 'war+conflict+military+crisis';
    const response = await axios.get(`https://gnews.io/api/v4/search?q=${q}&lang=en&max=20&apikey=${(process.env.GNEWS_KEY || '').trim()}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching news:', error.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// OpenSky API Proxy
app.get('/api/flights', async (req, res) => {
  try {
    const response = await axios.get('https://opensky-network.org/api/states/all?lamin=10&lomin=-20&lamax=70&lomax=145', {
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching flights:', error.message);
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
});

// Gemini Streaming Completion Proxy
app.post('/api/gemini/stream', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 400,
        temperature: 0.75,
      }
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }
  } catch (error) {
    console.error('Error generating streaming content:', error);
    res.write(`data: ${JSON.stringify({ text: "COMMS DOWN. Check API connection." })}\n\n`);
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`GOD MODE Server is running on port ${PORT}`);
});
