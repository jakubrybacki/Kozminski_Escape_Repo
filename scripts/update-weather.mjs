/**
 * scripts/update-weather.mjs
 * Skrypt uruchamiany przez GitHub Actions lub serwer do pobierania pogody z chatbota Gemini
 * i zapisywania jej do public/weather.json.
 * 
 * Klucz do API: process.env.GEMINI_API_KEY (z Secrets w repozytorium GitHub / środowiska)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const apiKey = process.env.GEMINI_API_KEY;

async function fetchWeatherFromGemini() {
  if (!apiKey) {
    console.warn('⚠️ Brak zmiennej środowiskowej GEMINI_API_KEY. Generowanie danych domyślnych na podstawie aktualnej godziny...');
    return getFallbackWeather('Brak GEMINI_API_KEY w środowisku');
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const now = new Date();
    const warsawHour = (now.getUTCHours() + 1) % 24; // Strefa czasowa Polski (CET/CEST orientacyjnie)

    const prompt = `Jesteś asystentem pogodowym kampusu Akademii Leona Koźmińskiego (ALK) w Warszawie przy ul. Jagiellońskiej 57/59.
Aktualna godzina w Warszawie to około ${warsawHour}:00.
Określ aktualny stan pogody dla kampusu ALK, wybierając JEDNĄ z 3 dozwolonych kategorii:
- "sunny" (jeśli w Warszawie jest dzień i słonecznie/pogodnie)
- "rainy" (jeśli pada deszcz/mżawka lub są opady)
- "night" (jeśli jest noc, zmierzch lub godzina pomiędzy 20:00 a 06:00 rano)

Uwzględnij zasady kolorystyki kampusu w grze Kozminski Escape:
- Słonecznie = kampus pomalowany na ZIELONO
- Deszczowo = kampus pomalowany na NIEBIESKO
- Noc = kampus pomalowany na CZARNO

Zwróć odpowiedź w czystym formacie JSON:
- condition: 'sunny' | 'rainy' | 'night'
- conditionName: nazwa po polsku ('Słonecznie' | 'Deszczowo' | 'Noc')
- temperature: aktualna lub realistyczna temperatura z jednostką (np. '18°C', '12°C', '7°C')
- description: 1-2 zdania plastycznego opisu aury nad kampusem ALK (budynki A-D, Zielone Patio)
- commentary: dowcipny komentarz Surowego Egzaminatora ALK nawiązujący do tej pogody i egzaminu studenta
- terrainColorTheme: 'zielony' dla słonecznie, 'niebieski' dla deszczowo, 'czarny' dla nocy
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            condition: {
              type: Type.STRING,
              description: 'Jedna z wartości: sunny, rainy, night',
            },
            conditionName: {
              type: Type.STRING,
              description: 'Nazwa pogody po polsku (Słonecznie, Deszczowo, Noc)',
            },
            temperature: {
              type: Type.STRING,
              description: 'Temperatura np. 19°C',
            },
            description: {
              type: Type.STRING,
              description: 'Opis aury nad kampusem ALK',
            },
            commentary: {
              type: Type.STRING,
              description: 'Komentarz Egzaminatora ALK',
            },
            terrainColorTheme: {
              type: Type.STRING,
              description: 'zielony, niebieski lub czarny',
            },
          },
          required: ['condition', 'conditionName', 'temperature', 'description', 'commentary', 'terrainColorTheme'],
        },
      },
    });

    const parsed = JSON.parse(response.text.trim());
    return {
      ...parsed,
      source: 'Gemini 3.8 Flash via GitHub Actions',
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Błąd podczas zapytania do Gemini:', error);
    return getFallbackWeather(`Błąd API: ${error.message}`);
  }
}

function getFallbackWeather(reason) {
  const now = new Date();
  const warsawHour = (now.getUTCHours() + 1) % 24;
  let condition = 'sunny';
  let conditionName = 'Słonecznie';
  let terrainColorTheme = 'zielony';
  let temp = '20°C';
  let desc = 'Słoneczny dzień nad kampusem ALK przy Jagiellońskiej. Zielone Patio lśni w słońcu.';
  let comment = '„Świetna pogoda na zaliczenie w pierwszym terminie! Zielony kampus dodaje energii!”';

  if (warsawHour >= 21 || warsawHour < 6) {
    condition = 'night';
    conditionName = 'Noc';
    terrainColorTheme = 'czarny';
    temp = '9°C';
    desc = 'Noc nad Pragą Północ i kampusem Koźmińskiego. Korytarze opustoszały, a teren spowija czerń nocy.';
    comment = '„Nocna sesja w Bibliotece ALK? Lepiej zbieraj ECTS przed świtem!”';
  } else if (now.getMinutes() % 2 === 1) {
    condition = 'rainy';
    conditionName = 'Deszczowo';
    terrainColorTheme = 'niebieski';
    temp = '14°C';
    desc = 'Deszcz bębni o szklane zadaszenie Patio ALK. Kampus skąpany w chłodnym błękicie deszczu.';
    comment = '„Żadnych wymówek przez deszcz! Prawdziwy menedżer zdaje egzamin w każdą pogodę!”';
  }

  return {
    condition,
    conditionName,
    temperature: temp,
    description: desc,
    commentary: comment,
    terrainColorTheme,
    source: `Fallback / Auto-symulacja (${reason})`,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log('🤖 Pobieranie informacji o pogodzie z chatbota Gemini dla kampusu ALK...');
  const weatherData = await fetchWeatherFromGemini();

  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const publicPath = path.join(publicDir, 'weather.json');
  fs.writeFileSync(publicPath, JSON.stringify(weatherData, null, 2), 'utf-8');
  console.log(`✅ Zapisano pomyślnie do ${publicPath}`);

  // Jeśli istnieje katalog dist, również aktualizujemy
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    const distPath = path.join(distDir, 'weather.json');
    fs.writeFileSync(distPath, JSON.stringify(weatherData, null, 2), 'utf-8');
    console.log(`✅ Zaktualizowano również w katalogu ${distPath}`);
  }

  console.log('Stan pogody:', weatherData.conditionName, '| Kolor terenu:', weatherData.terrainColorTheme);
}

main().catch((err) => {
  console.error('Krytyczny błąd skryptu:', err);
  process.exit(1);
});
