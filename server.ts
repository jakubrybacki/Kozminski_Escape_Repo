import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

let cachedWeather: any = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minut

function readLocalWeatherFile() {
  try {
    const candidates = [
      path.resolve(__dirname, 'public', 'weather.json'),
      path.resolve(__dirname, 'dist', 'weather.json'),
      path.resolve(__dirname, 'weather.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('Nie udało się odczytać pliku weather.json:', err);
  }
  return null;
}

async function fetchFromGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const now = new Date();
  const warsawHour = (now.getUTCHours() + 1) % 24;

  const prompt = `Jesteś asystentem pogodowym kampusu Akademii Leona Koźmińskiego (ALK) w Warszawie.
Aktualny czas w Warszawie to ok. ${warsawHour}:00.
Określ aktualny stan pogody dla kampusu ALK, wybierając JEDNĄ z 3 kategorii:
- "sunny" (słonecznie/dzień)
- "rainy" (deszczowo/opady)
- "night" (noc, późny wieczór 20:00-06:00)

Zasady kolorystyki kampusu ALK w grze:
- sunny -> teren kampusu zielony
- rainy -> teren kampusu niebieski
- night -> teren kampusu czarny

Zwróć JSON:
- condition: 'sunny' | 'rainy' | 'night'
- conditionName: 'Słonecznie' | 'Deszczowo' | 'Noc'
- temperature: np. '21°C'
- description: zwięzły opis aury nad kampusem ALK (1-2 zdania)
- commentary: dowcipny komentarz Egzaminatora ALK (1 zdanie)
- terrainColorTheme: 'zielony' | 'niebieski' | 'czarny'`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          condition: { type: Type.STRING },
          conditionName: { type: Type.STRING },
          temperature: { type: Type.STRING },
          description: { type: Type.STRING },
          commentary: { type: Type.STRING },
          terrainColorTheme: { type: Type.STRING },
        },
        required: ['condition', 'conditionName', 'temperature', 'description', 'commentary', 'terrainColorTheme'],
      },
    },
  });

  const text = response.text ? response.text.trim() : null;
  if (!text) {
    return null;
  }

  const data = JSON.parse(text);
  return {
    ...data,
    source: 'Gemini 3.8 Flash (Live Server)',
    updatedAt: new Date().toISOString(),
  };
}

// Endpoint GET /api/weather
app.get('/api/weather', async (_req, res) => {
  const now = Date.now();
  if (cachedWeather && now - lastFetchTime < CACHE_DURATION_MS) {
    return res.json(cachedWeather);
  }

  // Próba pobrania przez Gemini
  try {
    const live = await fetchFromGemini();
    if (live) {
      cachedWeather = live;
      lastFetchTime = now;
      return res.json(cachedWeather);
    }
  } catch (err) {
    console.warn('Błąd podczas zapytania do Gemini na serwerze:', err);
  }

  // Fallback do pliku weather.json lub danych domyślnych
  const fileData = readLocalWeatherFile();
  if (fileData) {
    cachedWeather = fileData;
    return res.json(fileData);
  }

  return res.json({
    condition: 'sunny',
    conditionName: 'Słonecznie',
    temperature: '21°C',
    description: 'Słoneczny dzień nad kampusem ALK przy Jagiellońskiej.',
    commentary: '„Słoneczna pogoda to idealny czas na zaliczenie w pierwszym terminie!”',
    terrainColorTheme: 'zielony',
    source: 'Domyślna aura kampusu ALK',
    updatedAt: new Date().toISOString(),
  });
});

// Endpoint wymuszenia odświeżenia przez Gemini
app.post('/api/weather/refresh', async (_req, res) => {
  try {
    const live = await fetchFromGemini();
    if (live) {
      cachedWeather = live;
      lastFetchTime = Date.now();
      return res.json({ success: true, weather: cachedWeather });
    }
    return res.status(400).json({
      success: false,
      error: 'Brak konfiguracji GEMINI_API_KEY lub błąd API. Sprawdź zmienne środowiskowe.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Statyczne serwowanie plików publicznych (np. /weather.json)
app.use(express.static(path.resolve(__dirname, 'public')));

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Kozminski Escape Server działa na http://${HOST}:${PORT}`);
  });
}

startServer();
