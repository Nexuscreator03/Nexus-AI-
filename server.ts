import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Helper to reuse singleton GoogleGenAI client securely on the server
let cachedGeminiClient: GoogleGenAI | null = null;
let cachedGeminiKey = '';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  if (cachedGeminiClient && cachedGeminiKey === apiKey) {
    return cachedGeminiClient;
  }
  cachedGeminiKey = apiKey;
  cachedGeminiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedGeminiClient;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'online',
    system: 'NEXUS AI Neural Core v4.0',
    hasApiKey: hasKey,
    model: 'gemini-4-hydrogen',
  });
});

// Reverse geocode coordinates -> city/state/country/label
app.get('/api/location/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Coordenadas inválidas.' });
  }

  try {
    const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=pt-BR`;
    const revRes = await fetch(revUrl, {
      headers: { 'User-Agent': 'NexusAI-GeoEngine/1.0' },
      signal: AbortSignal.timeout(3500),
    });

    if (revRes.ok) {
      const data: any = await revRes.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || '';
      const state = addr.state || addr.region || '';
      const country = addr.country || '';
      const label = [city, state || country].filter(Boolean).join(', ') || data.display_name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

      return res.json({
        lat,
        lon,
        city,
        state,
        country,
        label,
        displayName: data.display_name || label,
      });
    }
  } catch (err) {
    console.warn('[NEXUS GEO] Reverse geocode falhou:', err);
  }

  return res.json({
    lat,
    lon,
    city: '',
    state: '',
    country: '',
    label: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    displayName: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
  });
});

// IP-based GeoIP fallback (reliable inside iframes or when GPS permission is denied)
app.get('/api/location/ip', async (req, res) => {
  const forwarded = (req.headers['x-forwarded-for'] as string) || '';
  const rawIp = forwarded.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const isPrivateIp =
    !rawIp ||
    rawIp === '::1' ||
    rawIp.startsWith('127.') ||
    rawIp.startsWith('::ffff:127.') ||
    rawIp.startsWith('10.') ||
    rawIp.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(rawIp);
  const ipParam = isPrivateIp ? '' : encodeURIComponent(rawIp.replace('::ffff:', ''));

  // 1. Primary: ipwho.is
  try {
    const url = `https://ipwho.is/${ipParam}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (r.ok) {
      const d: any = await r.json();
      if (d.success !== false && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        const city = d.city || '';
        const state = d.region || '';
        const country = d.country || '';
        const label = [city, state || country].filter(Boolean).join(', ') || `${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}`;
        return res.json({
          lat: d.latitude,
          lon: d.longitude,
          city,
          state,
          country,
          label,
          source: 'ip',
        });
      }
    }
  } catch {}

  // 2. Fallback: ipapi.co
  try {
    const url = `https://ipapi.co/${ipParam ? ipParam + '/' : ''}json/`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'NexusAI-GeoEngine/1.0' },
      signal: AbortSignal.timeout(3500),
    });
    if (r.ok) {
      const d: any = await r.json();
      if (!d.error && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        const city = d.city || '';
        const state = d.region || '';
        const country = d.country_name || '';
        const label = [city, state || country].filter(Boolean).join(', ') || `${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}`;
        return res.json({
          lat: d.latitude,
          lon: d.longitude,
          city,
          state,
          country,
          label,
          source: 'ip',
        });
      }
    }
  } catch {}

  return res.status(502).json({ error: 'Não foi possível detectar localização automática por IP.' });
});

// Helper: Clean location name by stripping temporal/filler trailing words
function cleanLocationCandidate(raw: string): string {
  return raw
    .replace(/\b(hoje|amanh[aã]|agora|nesta semana|nessa semana|fim de semana|atualmente|por favor|pfv|neste momento)\b/gi, '')
    .replace(/[?!.,;:()[\]]+/g, '')
    .trim();
}

// Haversine geodesic distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Geocode a single place via OpenStreetMap Nominatim + Open-Meteo Fallback
async function geocodePlace(placeName: string): Promise<{
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
  type?: string;
  elevation?: number;
  osmUrl: string;
  mapsUrl: string;
} | null> {
  const cleaned = cleanLocationCandidate(placeName);
  if (!cleaned || cleaned.length < 2) return null;

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleaned)}&format=json&addressdetails=1&limit=1&accept-language=pt-BR`;
    const nRes = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'NexusAI-GeoEngine/1.0' },
      signal: AbortSignal.timeout(3000),
    });

    if (nRes.ok) {
      const nData: any[] = await nRes.json();
      if (nData && nData.length > 0) {
        const item = nData[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);

        // Fetch elevation via Open-Meteo
        let elevation: number | undefined;
        try {
          const elevRes = await fetch(
            `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,
            { signal: AbortSignal.timeout(2000) }
          );
          if (elevRes.ok) {
            const elevData: any = await elevRes.json();
            if (Array.isArray(elevData.elevation)) {
              elevation = elevData.elevation[0];
            }
          }
        } catch {}

        return {
          name: item.name || cleaned,
          displayName: item.display_name,
          lat,
          lon,
          country: item.address?.country || '',
          state: item.address?.state || item.address?.region || '',
          type: item.type || item.class,
          elevation,
          osmUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`,
          mapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
        };
      }
    }
  } catch {}

  // Fallback to Open-Meteo Geocoding
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleaned)}&count=1&language=pt&format=json`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(3000) });
    if (!geoRes.ok) return null;
    const geoData: any = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return null;
    const p = geoData.results[0];
    return {
      name: p.name,
      displayName: `${p.name}${p.admin1 ? ', ' + p.admin1 : ''}, ${p.country || ''}`,
      lat: p.latitude,
      lon: p.longitude,
      country: p.country || '',
      state: p.admin1,
      elevation: p.elevation,
      osmUrl: `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=12/${p.latitude}/${p.longitude}`,
      mapsUrl: `https://www.google.com/maps?q=${p.latitude},${p.longitude}`,
    };
  } catch {
    return null;
  }
}

interface ClientLocPayload {
  lat: number;
  lon: number;
  label?: string;
  city?: string;
  state?: string;
  country?: string;
}

// Geographical position, coordinates, elevation & distance intelligence
async function getLiveGeoContext(
  query: string,
  clientLocation?: ClientLocPayload
): Promise<{ context: string; sources: Array<{ title: string; uri: string }> } | null> {
  const sources: Array<{ title: string; uri: string }> = [];
  const geoKeywords = /\b(coordenadas|latitude|longitude|onde fica|localiza[çc][aã]o\s+(?:de|do|da)|posi[çc][aã]o geogr[aá]fica|mapa\s+(?:de|do|da)|dist[aâ]ncia\s+entre|altitude\s+(?:de|do|da)|eleva[çc][aã]o\s+(?:de|do|da)|fuso\s+hor[aá]rio\s+(?:de|do|da)|perto de mim|minha localiza[çc][aã]o|onde estou)\b/i;

  // Check distance between two places: "distância entre X e Y" or "de X até Y" or "de X para Y"
  const distMatch = query.match(/(?:dist[aâ]ncia\s+entre|de)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s'-]{2,35}?)\s+(?:e|at[eé]|para)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s'-]{2,35})/i);
  if (distMatch && /\b(dist[aâ]ncia|km|quil[oô]metros|longe)\b/i.test(query)) {
    const [p1, p2] = await Promise.all([geocodePlace(distMatch[1]), geocodePlace(distMatch[2])]);
    if (p1 && p2) {
      const km = haversineKm(p1.lat, p1.lon, p2.lat, p2.lon);
      sources.push({ title: `Mapa: ${p1.name} (OpenStreetMap)`, uri: p1.osmUrl });
      sources.push({ title: `Mapa: ${p2.name} (OpenStreetMap)`, uri: p2.osmUrl });
      return {
        context: `[DADOS GEOGRÁFICOS EXATOS VERIFICADOS]
Origem: ${p1.displayName} (Lat: ${p1.lat.toFixed(5)}, Lon: ${p1.lon.toFixed(5)}${p1.elevation !== undefined ? `, Altitude: ${p1.elevation}m` : ''})
Destino: ${p2.displayName} (Lat: ${p2.lat.toFixed(5)}, Lon: ${p2.lon.toFixed(5)}${p2.elevation !== undefined ? `, Altitude: ${p2.elevation}m` : ''})
Distância Geodésica em Linha Reta: ${km.toFixed(2)} km (${(km * 0.621371).toFixed(2)} milhas)
Links de Mapa: ${p1.mapsUrl} | ${p2.mapsUrl}`,
        sources,
      };
    }
  }

  // If user asks about their own current location ("aqui", "minha localização", "perto de mim", "onde estou")
  if (clientLocation && /\b(aqui|minha localiza[çc][aã]o|onde estou|perto de mim|minha cidade|meu local|minhas coordenadas|qual cidade)\b/i.test(query)) {
    const mapsUrl = `https://www.google.com/maps?q=${clientLocation.lat},${clientLocation.lon}`;
    sources.push({ title: 'Sua Posição no Google Maps', uri: mapsUrl });
    let resolvedName = clientLocation.label || [clientLocation.city, clientLocation.state, clientLocation.country].filter(Boolean).join(', ');
    if (!resolvedName) {
      try {
        const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${clientLocation.lat}&lon=${clientLocation.lon}&format=json&accept-language=pt-BR`;
        const revRes = await fetch(revUrl, {
          headers: { 'User-Agent': 'NexusAI-GeoEngine/1.0' },
          signal: AbortSignal.timeout(2500),
        });
        if (revRes.ok) {
          const revData: any = await revRes.json();
          resolvedName = revData.display_name || '';
        }
      } catch {}
    }
    return {
      context: `[POSIÇÃO GEOGRÁFICA ATUAL DO USUÁRIO - VERIFICADA]
Coordenadas: Lat ${clientLocation.lat.toFixed(5)}, Lon ${clientLocation.lon.toFixed(5)}
Localidade Identificada: ${resolvedName || 'Localização detectada'}
Link Mapa: ${mapsUrl}`,
      sources,
    };
  }

  if (!geoKeywords.test(query)) return null;

  // Extract place name
  const placeMatch = query.match(/(?:onde fica|coordenadas de|latitude de|longitude de|localiza[çc][aã]o de|mapa de|altitude de|fuso hor[aá]rio de)\s+(?:a cidade de |o pa[ií]s )?([A-Za-zÀ-ÖØ-öø-ÿ\s'-]{2,35})/i);

  if (placeMatch) {
    const place = await geocodePlace(placeMatch[1]);
    if (place) {
      sources.push({ title: `${place.name} no OpenStreetMap`, uri: place.osmUrl });
      sources.push({ title: `${place.name} no Google Maps`, uri: place.mapsUrl });
      return {
        context: `[POSIÇÃO GEOGRÁFICA VERIFICADA - OPENSTREETMAP / NOMINATIM]
Local: ${place.displayName}
Latitude: ${place.lat.toFixed(5)}° | Longitude: ${place.lon.toFixed(5)}°
${place.elevation !== undefined ? `Altitude (Elevação): ${place.elevation} metros acima do nível do mar\n` : ''}País: ${place.country}${place.state ? ` | Estado/Região: ${place.state}` : ''}
Links Diretos: ${place.osmUrl} | ${place.mapsUrl}`,
        sources,
      };
    }
  }

  return null;
}

// Meteorological live data fetcher via Open-Meteo (Scientific accuracy, 5-day forecast)
async function getLiveWeatherContext(
  query: string,
  clientLocation?: ClientLocPayload
): Promise<{ context: string; sources: Array<{ title: string; uri: string }> } | null> {
  const weatherKeywords = /\b(clima|tempo|previs[aã]o|temperatura|chuva|chover|calor|frio|weather|meteorol[oó]g|umidade|vento|graus)\b/i;
  if (!weatherKeywords.test(query)) return null;

  let lat: number | null = null;
  let lon: number | null = null;
  let placeLabel = '';

  // Try extracting location from query
  const match = query.match(/(?:em|de|para|na|no|cidade\s+de)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s'-]{2,35})/i);
  let locationCandidate = match ? cleanLocationCandidate(match[1]) : '';

  if (!locationCandidate) {
    const commonCityMatch = query.match(
      /\b(São Paulo|Rio de Janeiro|Belo Horizonte|Curitiba|Brasília|Salvador|Fortaleza|Recife|Porto Alegre|Manaus|Florianópolis|Goiânia|Belém|Campinas|Santos|Londres|London|Paris|Tóquio|Tokyo|Nova York|New York|Lisboa|Madrid|Roma|Berlim|Miami|Orlando|Buenos Aires)\b/i
    );
    if (commonCityMatch) locationCandidate = commonCityMatch[1];
  }

  if (locationCandidate && locationCandidate.length >= 2 && !/\b(aqui|minha cidade|meu local)\b/i.test(locationCandidate)) {
    const geocoded = await geocodePlace(locationCandidate);
    if (geocoded) {
      lat = geocoded.lat;
      lon = geocoded.lon;
      placeLabel = geocoded.displayName;
    }
  } else if (clientLocation) {
    lat = clientLocation.lat;
    lon = clientLocation.lon;
    placeLabel = clientLocation.label || `Sua localização atual (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
  }

  if (lat === null || lon === null) return null;

  try {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`;
    const fRes = await fetch(forecastUrl, { signal: AbortSignal.timeout(4000) });
    if (!fRes.ok) return null;
    const fData: any = await fRes.json();
    const curr = fData.current;
    const daily = fData.daily;

    const codeMap: Record<number, string> = {
      0: 'Céu limpo / ensolarado ☀️',
      1: 'Predominantemente limpo 🌤️',
      2: 'Parcialmente nublado ⛅',
      3: 'Nublado / encoberto ☁️',
      45: 'Nevoeiro / neblina 🌫️',
      48: 'Nevoeiro com geada ❄️',
      51: 'Garoa leve 🌦️',
      53: 'Garoa moderada 🌦️',
      55: 'Garoa densa 🌧️',
      61: 'Chuva fraca 🌧️',
      63: 'Chuva moderada 🌧️',
      65: 'Chuva forte ⛈️',
      80: 'Pancadas de chuva leves 🌦️',
      81: 'Pancadas de chuva moderadas 🌧️',
      82: 'Pancadas de chuva violentas ⛈️',
      95: 'Trovoada / tempestade elétrica ⚡',
    };
    const condition = codeMap[curr.weather_code] || 'Condições variáveis';

    const dailyLines: string[] = [];
    if (daily?.time) {
      for (let i = 0; i < Math.min(5, daily.time.length); i++) {
        const dCode = codeMap[daily.weather_code?.[i]] || '';
        dailyLines.push(
          `  - ${daily.time[i]}: Mín ${daily.temperature_2m_min?.[i]}°C / Máx ${daily.temperature_2m_max?.[i]}°C | Chuva: ${daily.precipitation_probability_max?.[i] ?? 0}% (${dCode})`
        );
      }
    }

    return {
      context: `[DADOS METEOROLÓGICOS EM TEMPO REAL VERIFICADOS - OPEN-METEO]
Localidade: ${placeLabel} (Lat: ${lat.toFixed(3)}, Lon: ${lon.toFixed(3)})
Condição Atual: ${condition}
Temperatura Atual: ${curr.temperature_2m}°C
Sensação Térmica: ${curr.apparent_temperature}°C
Umidade Relativa do Ar: ${curr.relative_humidity_2m}%
Velocidade do Vento: ${curr.wind_speed_10m} km/h
Precipitação Imediata: ${curr.precipitation} mm
Fuso Horário Local: ${fData.timezone}
Previsão dos Próximos 5 Dias:
${dailyLines.join('\n')}`,
      sources: [
        {
          title: `Meteorologia Open-Meteo (${placeLabel.split(',')[0]})`,
          uri: `https://open-meteo.com/`,
        },
      ],
    };
  } catch (err) {
    console.warn('[NEXUS AI] Consulta meteorológica falhou:', err);
    return null;
  }
}

// Clean conversational filler words so search engines & social APIs get high-signal topic keywords
function extractSearchTerms(query: string): string {
  const cleaned = query
    .replace(
      /\b(por favor|pfv|pesquise|busque|procure|me diga|me fale|me explique|explique|a fundo|em detalhes|pesquisa avan[çc]ada|com fontes|cient[ií]ficas?|o que est[aã]o falando|est[aã]o falando|o que est[aá] rolando|o que est[aá] em alta|quais s[aã]o as novidades|quais as [uú]ltimas novidades|quais s[aã]o|quais|novidades|[uú]ltimas|not[ií]cias?|o que [eé]|quem [eé]|como funciona|tudo sobre|nas redes sociais|em redes sociais|redes sociais|rede social|no youtube|no instagram|no tiktok|no reddit|no twitter|no x|e no google|no google|do google|pelo google|youtube|instagram|tiktok|reddit|twitter|facebook|google|hoje|agora|atualmente|ultimamente|no momento|mais recentes?|sobre|para mim|pra mim)\b/gi,
      ' '
    )
    .replace(/[?!.,;:()[\]]+/g, ' ')
    .replace(/\b(e|em|na|no|nas|nos|da|do|das|dos|de|as|os|a|o|um|uma)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

  return cleaned || query.replace(/[?!.,;:()[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

type ResearchDepth = 'fast' | 'standard_search' | 'deep';

function decodeBasicEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSimpleCasualMessage(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 72) return false;
  if (/https?:\/\/\S+/i.test(trimmed)) return false;

  // Reject if it contains explicit factual/search/action/code/time/weather/location/memory-lookup intent
  if (
    /\b(pesquis[ae]|busqu[ae]|procur[ae]|explique|como\s+(?:fazer|funciona|criar|usar|resolver|instalar|calcular|saber|[eé]\s+(?:o|a|que))|por\s*qu[eê]|qual|quais|quem|quando|onde|quanto\s+(?:custa|vale|[eé])|clima|tempo|previs[aã]o|not[ií]cias?|c[oó]digo|erro|bug|tabela|resumo|compare|analise|d[oó]lar|bitcoin|horas?|data|que dia|me ajude com|fa[çc]a|crie|escreva|traduza|calcule|lembr[aeo]|conversa|falamos|conversamos|assunto)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }

  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[!?.,:;~"'()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return false;

  // Pure greetings, farewells, reactions, acknowledgements, short compliments, "como vai?"
  const casualPatterns =
    /^(oi+|ola+|e ai|eae|opa+|salve|bom dia|boa tarde|boa noite|tudo bem|tudo bom|tudo certo|td bem|como vai|como voce esta|como vc ta|beleza|blz|suave|show|top|massa|legal|muito legal|que legal|bacana|daora|da hora|incrivel|perfeito|otimo|maravilha|excelente|entendi|saquei|ah sim|sim|nao|ok+|okay|certo|combinado|valeu|vlw|obrigado|obrigada|brigado|brigada|muito obrigado|muito obrigada|agradecido|tmj|tamo junto|haha+|hehe+|kkk+|rsrs+|tchau|ate logo|ate mais|flw|falou|bom trabalho|gostei|amei|adorei)(\s+(nexus|ai|ia|amigo|cara|mano|pessoal|hoje|agora|demais|mesmo|sim|nao|aqui|por aqui|com voce|tudo bem|tudo certo|como vai|como voce esta))*\s*$/i;

  if (casualPatterns.test(normalized)) return true;

  // Ultra-short 1–3 word conversational expressions without question marks
  const wordCount = normalized.split(' ').filter(Boolean).length;
  if (wordCount <= 3 && !trimmed.includes('?') && !/\d/.test(normalized)) {
    return true;
  }

  return false;
}

function classifyQueryDepth(query: string, useSearch: boolean): ResearchDepth {
  const trimmed = query.trim();

  // Simple greetings, reactions & casual chitchat NEVER trigger search
  if (isSimpleCasualMessage(trimmed)) {
    return 'fast';
  }

  // Deep exhaustive research ONLY for explicitly deep, complex or multi-faceted analytical requests
  const explicitDeepRegex =
    /\b(pesquis[ae]\s+(?:a\s+fundo|avan[çc]ad[ao]|complet[ao]|detalhad[ao]|exaustiv[ao])|aprofunde|estudo\s+cient[ií]fico|artigo\s+cient[ií]fico|paper|estado\s+da\s+arte|arquitetura\s+completa|compara[çc][aã]o\s+(?:detalhada|completa|profunda)|an[aá]lise\s+(?:profunda|completa|detalhada)|tudo\s+sobre|refer[êe]ncias\s+acad[êe]micas|fontes\s+cient[ií]ficas|relat[oó]rio\s+completo|dossi[eê])\b/i;

  if (explicitDeepRegex.test(trimmed)) {
    return 'deep';
  }

  // Questions specifically about NexusBye / NEXUS AI / Paulo Victor / creator answer instantaneously
  if (
    /\b(nexusbye|nexus\s*ai|paulo\s*victor|quem\s+(?:te\s+|lhe\s+)?criou|quem\s+(?:te\s+|lhe\s+)?desenvolveu|quem\s+(?:criou|fundou)\s+a\s+nexusbye)\b/i.test(
      trimmed
    ) &&
    !/\b(pesquise\s+na\s+internet|no\s+google)\b/i.test(trimmed)
  ) {
    return 'fast';
  }

  const hasUrl = /https?:\/\/\S+/i.test(trimmed);
  const explicitWebSearchIntent =
    /\b(pesquis[ae]r?|busqu[ae]r?|procur[ae]r?|encontr[ae]r?|investigu[ae]|varr[ae])\b|\b(na internet|no google|nas redes sociais|fontes|refer[êe]ncias|links)\b/i.test(
      trimmed
    );
  const liveTemporalNewsFinanceSports =
    /\b(not[ií]cias?|manchetes?|[uú]ltimas\s+novidades|ultimas\s+noticias|em\s+tempo\s+real|previs[aã]o\s+do\s+tempo|como\s+est[aá]\s+o\s+tempo|clima|temperatura|vai\s+chover|umidade|coordenadas|onde\s+fica|dist[aâ]ncia\s+entre|rota\s+para|minha\s+localiza[çc][aã]o|onde\s+estou|perto\s+de\s+mim|cota[çc][aã]o|d[oó]lar|euro|bitcoin|cripto|bolsa\s+de\s+valores|a[çc][õo]es|ibovespa|placar|campe[ãa]o|elei[çc][õo]es|quem\s+ganhou|quem\s+venceu|lan[çc]amento\s+(?:de|do|da)|2025|2026|2027)\b|\b(?:not[ií]cias?|aconteceu|novidades|pre[çc]o|valor|tempo)\s+(?:de\s+)?(?:hoje|agora|ontem|atualmente|recentes?)\b/i.test(
      trimmed
    );
  const socialPlatforms =
    /\b(instagram|tiktok|youtube|youtu\.be|twitter|x\.com|reddit|linkedin|facebook|threads|twitch|mastodon|lemmy|redes?\s+sociais?|rede\s+social|trending|tend[êe]ncias|viral)\b/i.test(
      trimmed
    );

  // Only auto-search without Search toggle if truly live/URL/explicit search; when Search toggle is ON, also search factual/complex queries if helpful
  const needsLiveLookup =
    hasUrl ||
    explicitWebSearchIntent ||
    liveTemporalNewsFinanceSports ||
    socialPlatforms ||
    (useSearch && /\b(quem\s+[eé]|o\s+que\s+aconteceu|atualmente|recente|novidades|atualiza[çc][aã]o|vers[aã]o\s+atual|lan[çc]ou)\b/i.test(trimmed));

  if (needsLiveLookup) {
    // Deep research ONLY when the user asks a complex, multi-part analytical query
    const isComplexAnalytical =
      trimmed.length >= 95 &&
      /\b(compare|compara[çc][aã]o|analise|an[aá]lise|detalhe|relat[oó]rio|aprofunde|impactos?|diferen[çc]as|pr[oó]s\s+e\s+contras|cen[aá]rio|como\s+funciona\s+detalhadamente|arquitetura|tend[êe]ncias\s+e)\b/i.test(
        trimmed
      );
    if (useSearch && isComplexAnalytical) {
      return 'deep';
    }
    return 'standard_search';
  }

  // Simple math, coding, rewriting, concepts, opinions and casual chats answer fast without searching
  return 'fast';
}

function selectTopImportantSources(
  groundingChunks: any[],
  preFetchedSources: Array<{ title: string; uri: string }>,
  maxCount: number
): Array<{ title: string; uri: string }> {
  const candidates: Array<{ title: string; uri: string; priority: number }> = [];

  for (const chunk of groundingChunks) {
    if (chunk?.web?.uri) {
      candidates.push({
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri,
        priority: 2, // Highest priority: verified Google Search grounding chunk
      });
    }
  }

  for (const src of preFetchedSources) {
    if (src?.uri) {
      candidates.push({
        title: src.title || src.uri,
        uri: src.uri,
        priority: 1,
      });
    }
  }

  const seenUris = new Set<string>();
  const seenHosts = new Set<string>();
  const selected: Array<{ title: string; uri: string }> = [];

  for (const item of candidates) {
    if (selected.length >= maxCount) break;
    const cleanUri = item.uri.trim();
    if (!cleanUri || seenUris.has(cleanUri)) continue;

    let hostKey = '';
    try {
      const parsed = new URL(cleanUri);
      const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      // Google vertex redirect URLs all share the same redirect hostname, so deduplicate those by URI instead of host
      if (host !== 'vertexaisearch.cloud.google.com') {
        hostKey = host;
      }
    } catch {}

    if (hostKey && seenHosts.has(hostKey)) {
      continue;
    }

    seenUris.add(cleanUri);
    if (hostKey) seenHosts.add(hostKey);
    selected.push({ title: item.title, uri: cleanUri });
  }

  return selected;
}

const searchContextCache = new Map<
  string,
  { expiresAt: number; result: { context: string; sources: Array<{ title: string; uri: string }> } }
>();

// Adaptive Multi-Site Research Engine: fast light lookup for standard queries, deep multi-source sweep only for complex topics
async function fetchMultiSiteSearchContext(
  query: string,
  depth: ResearchDepth
): Promise<{
  context: string;
  sources: Array<{ title: string; uri: string }>;
}> {
  if (depth === 'fast') return { context: '', sources: [] };

  const rawWithoutUrls = query.replace(/https?:\/\/\S+/gi, ' ').trim();
  const searchTerms = extractSearchTerms(rawWithoutUrls || query) || (rawWithoutUrls || query).replace(/[?!]/g, '').trim();
  if (!searchTerms || searchTerms.length < 2) return { context: '', sources: [] };

  const isDeep = depth === 'deep';
  const cacheKey = `${depth}:${searchTerms.toLowerCase()}`;
  const cached = searchContextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const timeoutMs = isDeep ? 1300 : 540;
  const snippets: string[] = [];
  const sources: Array<{ title: string; uri: string }> = [];

  const needsSocialDiscussions =
    isDeep ||
    /\b(reddit|hacker news|mastodon|lemmy|f[oó]rum|comunidade|opini[oõ]es|opini[aã]o|redes?\s+sociais?|viral|trending)\b/i.test(
      query
    );

  const tasks: Array<Promise<void>> = [
    // 1. Wikipedia PT Search (+ full intro extract in Deep Mode)
    (async () => {
      try {
        const limit = isDeep ? 3 : 2;
        const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerms)}&utf8=&format=json&srlimit=${limit}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return;
        const data: any = await res.json();
        const hits = data?.query?.search || [];

        if (isDeep && hits.length > 0) {
          try {
            const extractUrl = `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exchars=1500&titles=${encodeURIComponent(hits[0].title)}&format=json`;
            const extRes = await fetch(extractUrl, { signal: AbortSignal.timeout(2500) });
            if (extRes.ok) {
              const extData: any = await extRes.json();
              const pages = extData?.query?.pages || {};
              const firstPage: any = Object.values(pages)[0];
              if (firstPage?.extract) {
                snippets.push(`[Wikipédia PT Resumo Completo - ${hits[0].title}]: ${firstPage.extract}`);
              }
            }
          } catch {}
        }

        for (const hit of hits.slice(0, limit)) {
          const cleanSnippet = (hit.snippet || '').replace(/<[^>]+>/g, '');
          const pageUrl = `https://pt.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`;
          snippets.push(`[Wikipédia PT - ${hit.title}]: ${cleanSnippet}`);
          sources.push({ title: `Wikipédia: ${hit.title}`, uri: pageUrl });
        }
      } catch {}
    })(),

    // 2. Wikipedia EN Search (only in Deep Mode for extra breadth)
    ...(isDeep
      ? [
          (async () => {
      try {
        const limit = isDeep ? 2 : 1;
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerms)}&utf8=&format=json&srlimit=${limit}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return;
        const data: any = await res.json();
        const hits = data?.query?.search || [];

        if (isDeep && hits.length > 0) {
          try {
            const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exchars=1400&titles=${encodeURIComponent(hits[0].title)}&format=json`;
            const extRes = await fetch(extractUrl, { signal: AbortSignal.timeout(2500) });
            if (extRes.ok) {
              const extData: any = await extRes.json();
              const pages = extData?.query?.pages || {};
              const firstPage: any = Object.values(pages)[0];
              if (firstPage?.extract) {
                snippets.push(`[Wikipedia EN Full Extract - ${hits[0].title}]: ${firstPage.extract}`);
              }
            }
          } catch {}
        }

        for (const hit of hits.slice(0, limit)) {
          const cleanSnippet = (hit.snippet || '').replace(/<[^>]+>/g, '');
          const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`;
          snippets.push(`[Wikipedia EN - ${hit.title}]: ${cleanSnippet}`);
          sources.push({ title: `Wikipedia (EN): ${hit.title}`, uri: pageUrl });
        }
      } catch {}
    })(),
        ]
      : []),

    // 3. DuckDuckGo Instant Answer API
    (async () => {
      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchTerms)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return;
        const data: any = await res.json();
        if (data.AbstractText) {
          snippets.push(`[DuckDuckGo / ${data.AbstractSource || 'Referência'}]: ${data.AbstractText}`);
          if (data.AbstractURL) {
            sources.push({ title: data.Heading || data.AbstractSource || 'Referência Web', uri: data.AbstractURL });
          }
        }
        if (Array.isArray(data.RelatedTopics)) {
          const topRelated = data.RelatedTopics.filter((t: any) => t.Text && t.FirstURL).slice(0, isDeep ? 3 : 2);
          for (const rel of topRelated) {
            snippets.push(`[Tópico Relacionado]: ${rel.Text}`);
            sources.push({ title: rel.Text.slice(0, 60), uri: rel.FirstURL });
          }
        }
      } catch {}
    })(),

    // 4. Bing News PT-BR Live RSS (unwraps direct publisher URLs)
    (async () => {
      try {
        const url = `https://www.bing.com/news/search?q=${encodeURIComponent(searchTerms)}&format=rss&mkt=pt-BR`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexusAI-Research/1.0)' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return;
        const xml = await res.text();
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        const maxItems = isDeep ? 4 : 3;
        for (const itemXml of itemMatches.slice(0, maxItems)) {
          const rawTitle = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
          const rawLink = decodeBasicEntities(itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '');
          const rawDesc = itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
          const rawPub = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
          const rawSource = itemXml.match(/<News:Source>([\s\S]*?)<\/News:Source>/i)?.[1] || 'Notícias Web';
          const title = decodeBasicEntities(rawTitle);
          const desc = decodeBasicEntities(rawDesc).slice(0, 180);
          const sourceName = decodeBasicEntities(rawSource);

          let cleanLink = rawLink.trim();
          try {
            const parsed = new URL(cleanLink);
            const targetUrl = parsed.searchParams.get('url');
            if (targetUrl && targetUrl.startsWith('http')) {
              cleanLink = targetUrl;
            }
          } catch {}

          if (!title || !cleanLink.startsWith('http')) continue;
          snippets.push(
            `[Notícia Google/Bing - ${sourceName}${rawPub ? ` (${rawPub.slice(0, 16)})` : ''}]: ${title}${desc ? ` — ${desc}` : ''}`
          );
          sources.push({ title: `${sourceName}: ${title.slice(0, 68)}`, uri: cleanLink });
        }
      } catch {}
    })(),

    // 5. Google News PT-BR Live RSS Feed
    (async () => {
      try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexusAI-Research/1.0)' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return;
        const xml = await res.text();
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        const maxItems = isDeep ? 4 : 3;
        for (const itemXml of itemMatches.slice(0, maxItems)) {
          const rawTitle = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
          const rawLink = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
          const rawPub = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
          const rawSource = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || 'Google Notícias';
          const title = decodeBasicEntities(rawTitle);
          const link = rawLink.trim();
          const sourceName = decodeBasicEntities(rawSource);
          if (!title || !link.startsWith('http')) continue;
          snippets.push(
            `[Google Notícias - ${sourceName}${rawPub ? ` (${rawPub.slice(0, 16)})` : ''}]: ${title}`
          );
          sources.push({ title: `${sourceName}: ${title.slice(0, 70)}`, uri: link });
        }
      } catch {}
    })(),

    // 6. Social & Tech Community Discussions (ONLY when social/opinions requested or Deep Mode)
    ...(needsSocialDiscussions
      ? [
          (async () => {
            try {
              const limit = isDeep ? 4 : 2;
              const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(searchTerms)}&sort=relevance&limit=${limit}&raw_json=1`;
              const res = await fetch(url, {
                headers: { 'User-Agent': 'web:NexusAI-ResearchEngine:v1.0' },
                signal: AbortSignal.timeout(timeoutMs),
              });
              if (!res.ok) return;
              const data: any = await res.json();
              const posts = data?.data?.children || [];
              for (const child of posts.slice(0, limit)) {
                const post = child?.data;
                if (!post?.title || !post?.permalink) continue;
                const postUrl = `https://www.reddit.com${post.permalink}`;
                const excerpt = typeof post.selftext === 'string' && post.selftext.trim()
                  ? ` — ${post.selftext.replace(/\s+/g, ' ').trim().slice(0, 200)}`
                  : '';
                snippets.push(
                  `[Reddit ${post.subreddit_name_prefixed || ''} (${post.score || 0} votos, ${post.num_comments || 0} comentários)]: ${post.title}${excerpt}`
                );
                sources.push({
                  title: `Reddit (${post.subreddit_name_prefixed || 'comunidade'}): ${post.title.slice(0, 60)}`,
                  uri: postUrl,
                });
              }
            } catch {}
          })(),
          (async () => {
            try {
              const limit = isDeep ? 3 : 2;
              const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(searchTerms)}&hitsPerPage=${limit}`;
              const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
              if (!res.ok) return;
              const data: any = await res.json();
              const hits = data?.hits || [];
              for (const hit of hits.slice(0, limit)) {
                const title = hit?.title || hit?.story_title;
                const itemUrl = hit?.url || (hit?.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : '');
                if (!title || !itemUrl) continue;
                snippets.push(`[Comunidade Hacker News (${hit.points || 0} pts)]: ${title}`);
                sources.push({ title: `Hacker News: ${title.slice(0, 65)}`, uri: itemUrl });
              }
            } catch {}
          })(),
        ]
      : []),

    // 7. Lemmy & Mastodon (Deep Mode only)
    ...(isDeep
      ? [
          (async () => {
            try {
              const url = `https://lemmy.world/api/v3/search?q=${encodeURIComponent(searchTerms)}&type_=Posts&sort=TopWeek&limit=3`;
              const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
              if (!res.ok) return;
              const data: any = await res.json();
              const posts = data?.posts || [];
              for (const item of posts.slice(0, 3)) {
                const p = item?.post;
                const comm = item?.community?.name;
                if (!p?.name || !p?.ap_id) continue;
                snippets.push(
                  `[Rede Social Lemmy${comm ? ` (!${comm})` : ''} (${item?.counts?.score || 0} votos)]: ${p.name}`
                );
                sources.push({
                  title: `Lemmy${comm ? ` (!${comm})` : ''}: ${p.name.slice(0, 62)}`,
                  uri: p.ap_id,
                });
              }
            } catch {}
          })(),
          (async () => {
            try {
              const ptStopwords = new Set([
                'quais', 'qual', 'sobre', 'como', 'para', 'mais', 'hoje', 'agora', 'novidades', 'noticias', 'ultimas',
              ]);
              const asciiWords = searchTerms
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter((w) => w.length >= 2 && !ptStopwords.has(w));
              const tag =
                asciiWords.includes('inteligencia') && asciiWords.includes('artificial')
                  ? 'ai'
                  : asciiWords.join('').length >= 3 && asciiWords.length <= 2
                  ? asciiWords.join('')
                  : asciiWords[0] || '';
              if (!tag) return;
              const url = `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=3`;
              const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
              if (!res.ok) return;
              const statuses: any[] = await res.json();
              for (const st of (Array.isArray(statuses) ? statuses : []).slice(0, 3)) {
                const cleanText = decodeBasicEntities(st?.content || '').slice(0, 200);
                const author = st?.account?.acct || 'usuário';
                if (!cleanText || !st?.url) continue;
                snippets.push(`[Rede Social Mastodon (@${author})]: ${cleanText}`);
                sources.push({
                  title: `Mastodon (@${author}): ${cleanText.slice(0, 58)}`,
                  uri: st.url,
                });
              }
            } catch {}
          })(),
        ]
      : []),
  ];

  // 7. Deep Mode Extra Source: CrossRef Academic Papers
  if (isDeep) {
    tasks.push(
      (async () => {
        try {
          const url = `https://api.crossref.org/works?query=${encodeURIComponent(searchTerms)}&rows=3&select=title,author,published,DOI,URL`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'NexusAI-ResearchEngine/1.0 (mailto:research@nexusbye.app)' },
            signal: AbortSignal.timeout(3400),
          });
          if (!res.ok) return;
          const data: any = await res.json();
          const items = data?.message?.items || [];
          for (const item of items) {
            const title = Array.isArray(item.title) ? item.title[0] : item.title;
            if (!title) continue;
            const year = item.published?.['date-parts']?.[0]?.[0] || '';
            const firstAuthor = item.author?.[0]?.family ? `${item.author[0].family} et al.` : '';
            const paperUrl = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : '');
            snippets.push(`[Artigo Acadêmico CrossRef${year ? ` (${year})` : ''}${firstAuthor ? ` - ${firstAuthor}` : ''}]: ${title}`);
            if (paperUrl) {
              sources.push({ title: `Artigo: ${title.slice(0, 65)}`, uri: paperUrl });
            }
          }
        } catch {}
      })()
    );

    // 8. Deep Mode Extra Source: GitHub Repositories for software/tech/science/AI queries
    const looksTechnical =
      /\b(c[oó]digo|programaç[aã]o|framework|biblioteca|api|github|software|algoritmo|ia\b|intelig[êe]ncia artificial|machine learning|react|node|python|typescript|rust|docker|linux|qu[aâ]ntic|cyber|web|neural|llm|dados)\b/i.test(
        query
      );
    if (looksTechnical) {
      tasks.push(
        (async () => {
          try {
            const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerms)}&sort=stars&per_page=3`;
            const res = await fetch(url, {
              headers: { 'User-Agent': 'NexusAI-ResearchEngine/1.0' },
              signal: AbortSignal.timeout(3200),
            });
            if (!res.ok) return;
            const data: any = await res.json();
            const repos = data?.items || [];
            for (const repo of repos.slice(0, 3)) {
              snippets.push(
                `[Repositório GitHub - ${repo.full_name} (${repo.stargazers_count}⭐)]: ${repo.description || 'Projeto open-source'}`
              );
              if (repo.html_url) {
                sources.push({ title: `GitHub: ${repo.full_name}`, uri: repo.html_url });
              }
            }
          } catch {}
        })()
      );
    }
  }

  await Promise.race([
    Promise.allSettled(tasks),
    sleepMs(isDeep ? 1350 : 580),
  ]);

  const result = {
    context:
      snippets.length > 0
        ? `[${isDeep ? 'PESQUISA AVANÇADA MULTI-FONTES (MODO PROFUNDO)' : 'PESQUISA RÁPIDA EM TEMPO REAL'}]\n${snippets.join('\n')}`
        : '',
    sources,
  };

  if (snippets.length > 0) {
    if (searchContextCache.size >= 50) {
      const oldestKey = searchContextCache.keys().next().value;
      if (oldestKey) searchContextCache.delete(oldestKey);
    }
    searchContextCache.set(cacheKey, {
      expiresAt: Date.now() + 90_000,
      result,
    });
  }

  return result;
}

// Helper: Clean markdown into natural spoken Brazilian Portuguese text
function cleanTextForNaturalSpeech(text: string): string {
  return text
    // Narrate poll blocks naturally
    .replace(/```(?:poll|enquete)\n([\s\S]*?)```/gi, (_m, inner) => {
      return ` Enquete: ${inner.replace(/^[-*•]\s+/gm, 'opção: ')}. `;
    })
    // Summarize regular code blocks
    .replace(/```[\s\S]*?```/g, ' Código exibido na tela. ')
    // Remove only bracketed tag badges like [IMPORTANTE], [DICA]
    .replace(/\[(DESTAQUE|IMPORTANTE|ATENÇÃO|DICA|NOTA|CRÍTICO|RESULTADO|ESSENCIAL|EXEMPLO|RESUMO)\]/gi, '')
    // Convert markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove raw URLs
    .replace(/https?:\/\/[^\s)]+/g, '')
    // Remove markdown formatting tokens & highlight color prefixes
    .replace(/==(?:(?:amarelo|amber|yellow|verde|emerald|roxo|purple|rosa|rose|azul|cyan|laranja|orange):\s*)?([^=]+)==/gi, '$1')
    .replace(/<\/?u>/gi, '')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s*(\[!.*?\]\s*)?/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\|/g, ', ')
    .replace(/^[-:|\s]+$/gm, '')
    // Clean leftover standalone asterisks or underscores
    .replace(/[*_`~]/g, '')
    // Clean common emojis so TTS doesn't read emoji names awkwardly
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Neural Voice / TTS Endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Kore' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto não fornecido.' });
    }

    const cleanSpeechText = cleanTextForNaturalSpeech(text);
    if (!cleanSpeechText) {
      return res.status(400).json({ error: 'Nada para narrar.' });
    }

    try {
      const ai = getGeminiClient();
      // Attempt Gemini Neural TTS (returns complete WAV when supported by key/endpoint)
      const ttsPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanSpeechText.slice(0, 2000),
                speechMetadata: {
                  style: 'Warm, friendly, natural Brazilian Portuguese narrator',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const response: any = await Promise.race([
        ttsPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TTS_TIMEOUT')), 7000)),
      ]);

      const audioBase64 = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      const mimeType = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';

      if (audioBase64) {
        return res.json({
          audioBase64,
          mimeType,
          cleanSpeechText,
          engine: 'gemini-neural-tts',
        });
      }
    } catch (ttsErr: any) {
      // Fallback smoothly to client enhanced natural neural voice
      console.warn('[NEXUS TTS] Usando voz neural do navegador aprimorada:', ttsErr?.message?.slice(0, 120));
    }

    return res.json({
      audioBase64: null,
      cleanSpeechText,
      engine: 'browser-neural-enhanced',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro no serviço de voz.' });
  }
});

// Helper: Build system instruction, live contexts, Gemini contents, and model cascade for both /api/chat and /api/chat/stream
async function prepareGeminiChatRequest(body: any) {
  const {
    messages,
    useSearch = false,
    systemPersona = 'standard',
    turboMode = true,
    clientTime,
    clientLocation,
    userProfile,
    globalMemoryContext,
    hasPastConversations = false,
    responsePrefs,
  } = body;

  const exactTimeInfo = clientTime
    ? `Data/Hora atual do usuário: ${clientTime.formatted || clientTime.iso} (${clientTime.dayOfWeek || 'Hoje'}, ${clientTime.timeZone || 'Automático'}).`
    : `Data/Hora do sistema: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Horário de Brasília).`;

  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const lastText = lastUserMsg?.content || '';
  const hasPriorAssistantMessage =
    Array.isArray(messages) && messages.some((m: any) => m.role === 'model' || m.role === 'assistant');
  const hasMediaAttachment = Boolean(
    lastUserMsg?.attachments?.some((a: any) => a?.base64Data || a?.textContent)
  );
  const isCasualSimple = !hasMediaAttachment && isSimpleCasualMessage(lastText);

  const hasGlobalMemory = typeof globalMemoryContext === 'string' && globalMemoryContext.trim().length > 0;
  const isReturningUser =
    hasPriorAssistantMessage ||
    Boolean(hasPastConversations) ||
    hasGlobalMemory ||
    Boolean(
      userProfile?.email ||
        userProfile?.name ||
        (Array.isArray(userProfile?.notes) && userProfile.notes.length > 0) ||
        (userProfile?.totalLikes || 0) > 0
    );

  const researchDepth: ResearchDepth = isCasualSimple
    ? 'fast'
    : lastText
    ? classifyQueryDepth(lastText, Boolean(useSearch))
    : 'fast';

  const withSoftTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([promise, sleepMs(ms).then(() => fallback)]);

  const [weatherResult, geoResult, multiSearchResult] =
    researchDepth === 'fast' || isCasualSimple
      ? [null, null, { context: '', sources: [] }]
      : await Promise.all([
          lastText ? withSoftTimeout(getLiveWeatherContext(lastText, clientLocation), 1500, null) : Promise.resolve(null),
          lastText ? withSoftTimeout(getLiveGeoContext(lastText, clientLocation), 1500, null) : Promise.resolve(null),
          lastText ? fetchMultiSiteSearchContext(lastText, researchDepth) : Promise.resolve({ context: '', sources: [] }),
        ]);

  const extraContexts: string[] = [];
  const aggregatedSources: Array<{ title: string; uri: string }> = [];

  if (clientLocation) {
    const locSummary =
      clientLocation.label ||
      [clientLocation.city, clientLocation.state, clientLocation.country].filter(Boolean).join(', ');
    extraContexts.push(
      `[LOCALIZAÇÃO ATIVA]: ${locSummary || 'Detectada'} (${clientLocation.lat.toFixed(4)}, ${clientLocation.lon.toFixed(4)})`
    );
  }

  if (weatherResult) {
    extraContexts.push(weatherResult.context);
    aggregatedSources.push(...weatherResult.sources);
  }
  if (geoResult) {
    extraContexts.push(geoResult.context);
    aggregatedSources.push(...geoResult.sources);
  }
  if (multiSearchResult.context) {
    extraContexts.push(multiSearchResult.context);
    aggregatedSources.push(...multiSearchResult.sources);
  }

  let adaptationDirectives = '';
  if (userProfile) {
    const traits: string[] = [];
    if (userProfile.email) traits.push(`- E-mail: ${userProfile.email}`);
    if (userProfile.name) traits.push(`- Nome: ${userProfile.name} (chame pelo nome naturalmente quando couber).`);
    if (userProfile.city) traits.push(`- Cidade: ${userProfile.city}`);
    if (Array.isArray(userProfile.notes) && userProfile.notes.length > 0) {
      traits.push(`- Fatos salvos: ${userProfile.notes.slice(-12).join(' | ')}`);
    }
    if (userProfile.autonomyDecisiveness) {
      traits.push('- Se pedir escolha entre opções, escolha uma claramente e justifique.');
    }
    if (userProfile.likedTopics && userProfile.likedTopics.length > 0) {
      traits.push(`- Gosta de: ${userProfile.likedTopics.slice(0, 10).join(', ')}`);
    }
    if (userProfile.dislikedTopics && userProfile.dislikedTopics.length > 0) {
      traits.push(`- Evitar (não gosta): ${userProfile.dislikedTopics.slice(0, 10).join(', ')}`);
    }
    if (traits.length > 0) {
      adaptationDirectives = `\n[PERFIL DO USUÁRIO]:\n${traits.join('\n')}\n`;
    }
  }

  const globalMemorySection = hasGlobalMemory
    ? `\n[HISTÓRICO DE CONVERSAS ANTIGAS COM ESTE USUÁRIO]\nVocê TEM ACESSO e lembra das conversas passadas listadas abaixo. Use esse histórico naturalmente para responder sobre assuntos anteriores ou manter continuidade:\n${globalMemoryContext.trim()}\n`
    : '';

  const compactPastPreview = hasGlobalMemory
    ? globalMemoryContext
        .split('\n')
        .filter((l: string) => l.startsWith('• Conversa '))
        .slice(0, 3)
        .join(' | ')
    : '';

  let personaInstruction = '';
  let isConciseMode = false;

  if (systemPersona === 'cyber') {
    personaInstruction = `MODO CYBER 🤖⚡: linguagem tecnológica/futurista criativa, mantendo clareza, simpatia e perguntas leves no tema quando útil.`;
  } else if (systemPersona === 'code') {
    personaInstruction = `MODO DEV 💻🔬: explicações técnicas detalhadas (arquitetura, bordas, boas práticas) e código limpo pronto para produção, com painéis de aviso quando importante.`;
  } else if (systemPersona === 'concise') {
    isConciseMode = true;
    personaInstruction = `MODO DIRETO ⚡: responda apenas o mínimo essencial com clareza total, sem introduções ou rodeios.`;
  } else {
    personaInstruction = `MODO PADRÃO ✨: equilibrado, acolhedor, envolvente e bem estruturado com uso moderado de recursos visuais.`;
  }

  const greetingRuleDirective = hasPriorAssistantMessage
    ? `[CONVERSA EM ANDAMENTO — NÃO SAUDE NOVAMENTE]: Já existem respostas suas acima. PROIBIDO cumprimentar ("Olá", "Oi", "Tudo bem", "Prazer", etc.). Vá direto ao assunto!`
    : isReturningUser
    ? `[USUÁRIO CONHECIDO — 1ª MENSAGEM DESTA CONVERSA]: Vocês JÁ se conhecem e já conversaram antes! PROIBIDO dizer "prazer em te conhecer", "é um prazer conhecê-lo", "muito prazer" ou agir como se fosse a primeira vez. Cumprimente de forma breve e familiar (ex: "Oi! Que bom te ver de novo!" ou "E aí! Tudo certo?") e responda com agilidade.`
    : `[PRIMEIRA MENSAGEM]: Faça uma saudação simpática e breve e responda diretamente.`;

  const richFormattingAndPersonality = isConciseMode
    ? `Regras Modo Direto:
1. Use dados reais de data/hora/memória fornecidos. Responda o mínimo essencial (sem saudar em mensagens seguintes e sem dizer "prazer em te conhecer" a usuários recorrentes).
2. Identidade: criado pela **NexusBye** (só cite **Paulo Victor** se perguntarem quem criou/fundou a NexusBye).`
    : `Diretrizes Gerais:
1. Naturalidade & Memória:
   - Saudação só na 1ª pergunta do chat; da 2ª em diante, nunca repita saudação.
   - Se já conhece o usuário (histórico/conta existente), NUNCA diga "prazer em te conhecer" nem finja que não o conhece; use [HISTÓRICO DE CONVERSAS ANTIGAS] sempre que perguntarem ou couber no assunto.
   - Seja simpático, acolhedor e respeite os gostos/limites salvos. 😊✨
2. Personalização Visual & Interatividade (CAPRICHADO E EQUILIBRADO):
   - Em respostas completas/explicativas, deixe o visual vivo escolhendo **2 a 3 recursos diferentes por resposta** (alterne entre respostas para variar sem poluir):
     • **Negrito branco (\`**termo**\`)** e __sublinhado__ (\`__termo__\`) em termos-chave.
     • **Marcadores Coloridos Variados**: use 1 a 3 marcadores alternando cores (\`==azul:termo==\`, \`==verde:termo==\`, \`==roxo:termo==\`, \`==rosa:termo==\`, \`==laranja:termo==\`, \`==amarelo:termo==\` — não fique só no amarelo!).
     • **Painéis / Quadros**: inclua **1 painel** em guias, resumos ou cuidados (\`> ⚠️ **Aviso:**\`, \`> ℹ️ **Informação Importante:**\`, \`> 💡 **Dica:**\`, \`> 🔥 **Essencial:**\` ou \`> 📌 **Quadro / Resumo:**\`).
     • **Tabelas Markdown** (\`| Col | Col |\`) ao comparar opções, prós/contras, planos ou etapas.
   - **Enquete Interativa**: sempre que fizer uma pergunta de múltipla escolha ou oferecer caminhos ao usuário, use o bloco \`\`\`poll\nPergunta curta?\n- Opção 1\n- Opção 2\n- Opção 3\n\`\`\` (sem exagerar, apenas quando houver escolha real).
3. Precisão: use dados verificados de hora/clima/local/pesquisa fornecidos (sem inventar links ou posts).
4. Identidade: criado pela **NexusBye** (só mencione **Paulo Victor** se perguntarem quem criou/fundou a NexusBye).`;

  let customStyleDirectives = '';
  if (responsePrefs && typeof responsePrefs === 'object') {
    const toneMap: Record<string, string> = {
      friendly: 'Tom amigável, acolhedor, próximo e gentil.',
      professional: 'Tom profissional, executivo, claro e objetivo (sem gírias).',
      creative: 'Tom criativo, envolvente, expressivo e inspirador.',
      didactic: 'Tom didático, paciente e educativo, explicando passo a passo com analogias claras.',
    };
    const lengthMap: Record<string, string> = {
      short: 'Tamanho CURTO: direto ao ponto.',
      balanced: 'Tamanho EQUILIBRADO: completo na medida certa sem enrolação.',
      detailed: 'Tamanho DETALHADO: aprofundado com exemplos práticos.',
    };
    const formatMap: Record<string, string> = {
      rich: 'Formato visual CAPRICHADO e VARIADO: combine negrito branco, marcadores de cores variadas (azul, verde, roxo, rosa, laranja, amarelo), 1 painel de aviso/informação/quadro quando relevante, tabelas em comparações e bloco ```poll ao perguntar opções (equilibrado, sem poluir).',
      bullets: 'Formato em TÓPICOS claros.',
      steps: 'Formato PASSO A PASSO numerado.',
      plain: 'Formato TEXTO LIMPO em prosa contínua.',
    };

    const styleLines: string[] = [];
    if (toneMap[responsePrefs.tone]) styleLines.push(`- TOM: ${toneMap[responsePrefs.tone]}`);
    if (lengthMap[responsePrefs.length]) styleLines.push(`- EXTENSÃO: ${lengthMap[responsePrefs.length]}`);
    if (formatMap[responsePrefs.format]) styleLines.push(`- VISUAL: ${formatMap[responsePrefs.format]}`);
    if (responsePrefs.useEmojis === false) {
      styleLines.push('- EMOJIS: NÃO use emojis.');
    } else if (responsePrefs.useEmojis === true) {
      styleLines.push('- EMOJIS: Use emojis com moderação.');
    }
    if (typeof responsePrefs.customInstructions === 'string' && responsePrefs.customInstructions.trim()) {
      styleLines.push(
        `- REGRA DO USUÁRIO: ${responsePrefs.customInstructions.trim().slice(0, 400)}`
      );
    }
    if (styleLines.length > 0) {
      customStyleDirectives = `\n[PREFERÊNCIAS DO USUÁRIO]:\n${styleLines.join('\n')}\n`;
    }
  }

  const systemInstruction = isCasualSimple && !isConciseMode
    ? `Você é o NEXUS AI, assistente da **NexusBye**.
${userProfile?.name ? `Usuário: ${userProfile.name}.` : ''}
${compactPastPreview ? `Assuntos recentes que vocês já conversaram: ${compactPastPreview}` : ''}
${greetingRuleDirective}
- Mensagem casual simples: responda **super rápido, natural e leve em 1 ou 2 frases curtas** (sem tabelas ou painéis).
- Identidade: criado pela **NexusBye** (só cite **Paulo Victor** se perguntarem quem fundou a NexusBye).`
    : `Você é o NEXUS AI, inteligência artificial desenvolvida pela **NexusBye**.
${exactTimeInfo}
${greetingRuleDirective}
${extraContexts.length > 0 ? `\n${extraContexts.join('\n\n')}\n` : ''}${adaptationDirectives}${globalMemorySection}
${personaInstruction}
${richFormattingAndPersonality}${customStyleDirectives}`;

  const contents = messages.map((m: any) => {
    const parts: any[] = [];
    let hasAudioAttachment = false;

    if (m.attachments && Array.isArray(m.attachments)) {
      for (const att of m.attachments) {
        if (att.base64Data && att.mimeType) {
          if (att.type === 'audio' || att.mimeType.startsWith('audio/')) {
            hasAudioAttachment = true;
          }
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.base64Data,
            },
          });
        } else if (att.textContent) {
          parts.push({
            text: `[Conteúdo do arquivo anexado: ${att.name}]\n${att.textContent}`,
          });
        }
      }
    }

    if (m.content) {
      parts.push({ text: m.content });
    } else if (hasAudioAttachment) {
      parts.push({
        text: 'O usuário enviou esta mensagem de voz/áudio. Ouça com atenção tudo o que foi falado no áudio e responda diretamente em português do Brasil de forma natural.',
      });
    } else if (parts.length === 0) {
      parts.push({ text: 'Analise este anexo e responda em português.' });
    }

    return {
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const hasAudioInConversation = contents.some((c: any) =>
    c.parts.some((p: any) => p.inlineData?.mimeType?.startsWith('audio/'))
  );
  const hasUrlsInPrompt = /https?:\/\/\S+/i.test(lastText);

  const attempts: Array<{
    model: string;
    search: boolean;
    urlContext?: boolean;
    timeout: number;
    thinkingLevel?: ThinkingLevel;
    maxOutputTokens?: number;
  }> = [];

  const pushAttempt = (candidate: {
    model: string;
    search: boolean;
    urlContext?: boolean;
    timeout: number;
    thinkingLevel?: ThinkingLevel;
    maxOutputTokens?: number;
    allowDuplicate?: boolean;
  }) => {
    const exists =
      !candidate.allowDuplicate &&
      attempts.some(
        (a) =>
          a.model === candidate.model &&
          a.search === candidate.search &&
          Boolean(a.urlContext) === Boolean(candidate.urlContext) &&
          a.thinkingLevel === candidate.thinkingLevel
      );
    if (!exists) {
      const { allowDuplicate: _ignore, ...cleanAttempt } = candidate;
      attempts.push(cleanAttempt);
    }
  };

  if (isCasualSimple) {
    // Fast primary + quick retry against Gemini Flash-Lite tail stalls, then reliable gemini-4-hydrogen LOW fallback
    // IMPORTANT: Never set maxOutputTokens on gemini-4-hydrogen (its internal thinking tokens cause EMPTY_RESPONSE)
    pushAttempt({ model: 'gemini-3.1-flash-lite', search: false, timeout: 3200, maxOutputTokens: 130 });
    pushAttempt({
      model: 'gemini-3.1-flash-lite',
      search: false,
      timeout: 4200,
      maxOutputTokens: 130,
      allowDuplicate: true,
    });
    pushAttempt({
      model: 'gemini-4-hydrogen',
      search: false,
      timeout: 11000,
      thinkingLevel: ThinkingLevel.LOW,
    });
    pushAttempt({ model: 'gemini-4-hydrogen', search: false, timeout: 14000 });
  } else if (researchDepth === 'deep' && !hasAudioInConversation) {
    pushAttempt({
      model: 'gemini-3.1-flash-lite',
      search: true,
      urlContext: hasUrlsInPrompt,
      timeout: 11000,
    });
    pushAttempt({
      model: 'gemini-4-hydrogen',
      search: true,
      urlContext: false,
      timeout: 14000,
      thinkingLevel: ThinkingLevel.LOW,
    });
    pushAttempt({ model: 'gemini-3.1-flash-lite', search: false, timeout: 8500 });
    pushAttempt({
      model: 'gemini-4-hydrogen',
      search: false,
      timeout: 14000,
      thinkingLevel: ThinkingLevel.LOW,
    });
  } else if (researchDepth === 'standard_search' && !hasAudioInConversation) {
    const hasRichPreFetchedContext =
      !hasUrlsInPrompt && (aggregatedSources.length >= 2 || Boolean(weatherResult) || Boolean(geoResult));

    if (hasRichPreFetchedContext) {
      // Fast path: pre-fetched live news/web/weather/geo context is already rich — respond fast without tool overhead
      pushAttempt({
        model: 'gemini-3.1-flash-lite',
        search: false,
        timeout: 5500,
      });
      pushAttempt({
        model: 'gemini-4-hydrogen',
        search: false,
        timeout: 12000,
        thinkingLevel: ThinkingLevel.LOW,
      });
      pushAttempt({
        model: 'gemini-3.1-flash-lite',
        search: false,
        timeout: 9500,
        allowDuplicate: true,
      });
      pushAttempt({ model: 'gemini-4-hydrogen', search: false, timeout: 14000 });
    } else {
      pushAttempt({
        model: 'gemini-3.1-flash-lite',
        search: true,
        urlContext: hasUrlsInPrompt,
        timeout: 8500,
      });
      // Fast fallback using pre-fetched live search context if Google Search tool stalls or hits 429/503
      pushAttempt({
        model: 'gemini-3.1-flash-lite',
        search: false,
        timeout: 5500,
      });
      pushAttempt({
        model: 'gemini-4-hydrogen',
        search: false,
        timeout: 12000,
        thinkingLevel: ThinkingLevel.LOW,
      });
      pushAttempt({
        model: 'gemini-4-hydrogen',
        search: true,
        urlContext: false,
        timeout: 14000,
        thinkingLevel: ThinkingLevel.LOW,
      });
    }
  }

  if (systemPersona === 'code') {
    pushAttempt({
      model: 'gemini-4-hydrogen',
      search: false,
      timeout: 15000,
      thinkingLevel: ThinkingLevel.LOW,
    });
    pushAttempt({ model: 'gemini-3.1-flash-lite', search: false, timeout: 9500 });
    pushAttempt({ model: 'gemini-4-hydrogen', search: false, timeout: 16000 });
  } else if (!isCasualSimple) {
    pushAttempt({ model: 'gemini-3.1-flash-lite', search: false, timeout: 5200 });
    pushAttempt({
      model: 'gemini-4-hydrogen',
      search: false,
      timeout: 12000,
      thinkingLevel: ThinkingLevel.LOW,
    });
    pushAttempt({
      model: 'gemini-3.1-flash-lite',
      search: false,
      timeout: 9500,
      allowDuplicate: true,
    });
    pushAttempt({ model: 'gemini-4-hydrogen', search: false, timeout: 15000 });
  }

  return {
    systemInstruction,
    contents,
    attempts,
    aggregatedSources,
    lastText,
    researchDepth,
    isCasualSimple,
    useSearch: researchDepth !== 'fast',
  };
}

const sleepMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableGeminiError(err: any, hadTool = false): boolean {
  const errMsg = String(err?.message || err?.status || err?.code || '').toLowerCase();
  const baseRetryable =
    errMsg.includes('429') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('rate limit') ||
    errMsg.includes('quota') ||
    errMsg.includes('500') ||
    errMsg.includes('502') ||
    errMsg.includes('503') ||
    errMsg.includes('504') ||
    errMsg.includes('internal') ||
    errMsg.includes('unavailable') ||
    errMsg.includes('service unavailable') ||
    errMsg.includes('high demand') ||
    errMsg.includes('overloaded') ||
    errMsg.includes('over capacity') ||
    errMsg.includes('temporarily') ||
    errMsg.includes('timeout_exceeded') ||
    errMsg.includes('deadline_exceeded') ||
    errMsg.includes('deadline') ||
    errMsg.includes('aborted') ||
    errMsg.includes('empty_response') ||
    errMsg.includes('404') ||
    errMsg.includes('not_found') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('etimedout') ||
    errMsg.includes('enotfound') ||
    errMsg.includes('socket') ||
    errMsg.includes('unexpected end') ||
    errMsg.includes('fetch failed') ||
    errMsg.includes('network');

  if (baseRetryable) return true;
  if (hadTool && (errMsg.includes('400') || errMsg.includes('invalid_argument') || errMsg.includes('failed_precondition'))) {
    return true;
  }
  return false;
}

function buildAttemptConfig(
  systemInstruction: string,
  attempt: {
    model: string;
    search: boolean;
    urlContext?: boolean;
    thinkingLevel?: ThinkingLevel;
    maxOutputTokens?: number;
  },
  abortSignal?: AbortSignal
): any {
  const config: any = { systemInstruction };
  if (attempt.search) {
    config.tools = attempt.urlContext
      ? [{ googleSearch: {} }, { urlContext: {} }]
      : [{ googleSearch: {} }];
  }
  if (attempt.thinkingLevel) {
    config.thinkingConfig = { thinkingLevel: attempt.thinkingLevel };
  }
  // Never constrain maxOutputTokens on thinking models like gemini-4-hydrogen
  if (attempt.maxOutputTokens && attempt.model === 'gemini-3.1-flash-lite') {
    config.maxOutputTokens = attempt.maxOutputTokens;
  }
  if (abortSignal) {
    config.abortSignal = abortSignal;
  }
  return config;
}

function formatFriendlyGeminiError(error: any): string {
  const errorMsg = String(error?.message || 'Erro desconhecido ao processar requisição');
  const lower = errorMsg.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted')) {
    return 'Limite de cota da API Gemini excedido temporariamente (Erro 429). Aguarde alguns segundos e tente novamente.';
  }
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return 'Os servidores do núcleo Gemini estão com pico temporário de tráfego neste momento (503). Clique em tentar novamente em alguns segundos.';
  }
  if (lower.includes('timeout_exceeded') || lower.includes('deadline_exceeded')) {
    return 'A resposta demorou mais do que o esperado devido à instabilidade momentânea da rede. Tente novamente agora.';
  }
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied')) {
    return 'Chave da API Gemini inválida ou sem permissão. Verifique as configurações no painel **Settings > Secrets**.';
  }
  return 'Ocorreu um erro temporário ao conectar com o núcleo do NEXUS AI. Tente novamente em alguns segundos.';
}

async function runWithAbortTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalController?: AbortController
): Promise<T> {
  const controller = externalController || new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promiseFactory(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('TIMEOUT_EXCEEDED'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Main Chat endpoint (non-streaming JSON)
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    }

    let ai: GoogleGenAI;
    try {
      ai = getGeminiClient();
    } catch {
      return res.status(500).json({
        error: 'Chave de API Gemini não encontrada no servidor.',
        details: 'Por favor, configure GEMINI_API_KEY nas variáveis de ambiente ou Secrets.',
      });
    }

    const prepared = await prepareGeminiChatRequest(req.body);
    const startTime = Date.now();
    let response: any;
    let usedModel = 'gemini-3.1-flash-lite';
    let searchUsed = prepared.useSearch;
    let lastError: any = null;

    for (let idx = 0; idx < prepared.attempts.length; idx++) {
      const attempt = prepared.attempts[idx];
      try {
        const candidateResp = await runWithAbortTimeout(
          (signal) =>
            ai.models.generateContent({
              model: attempt.model,
              contents: prepared.contents,
              config: buildAttemptConfig(prepared.systemInstruction, attempt, signal),
            }),
          attempt.timeout
        );

        const candidateText = typeof candidateResp?.text === 'string' ? candidateResp.text : '';
        if (!candidateText.trim()) {
          throw new Error('EMPTY_RESPONSE');
        }

        response = candidateResp;
        usedModel = attempt.model;
        searchUsed = attempt.search || prepared.aggregatedSources.length > 0;
        break;
      } catch (err: any) {
        lastError = err;
        const hasTool = Boolean(attempt.search || attempt.thinkingLevel);
        if (isRetryableGeminiError(err, hasTool)) {
          console.warn(
            `[NEXUS AI] Fallback de ${attempt.model} (search: ${attempt.search}): ${(err?.message || '').slice(0, 140)}`
          );
          if (idx < prepared.attempts.length - 1) {
            const isTimeout = String(err?.message || '').includes('TIMEOUT_EXCEEDED');
            await sleepMs(isTimeout || prepared.isCasualSimple ? 40 : Math.min(200 * Math.pow(1.4, idx), 650));
          }
          continue;
        }
        throw err;
      }
    }

    // Rescue pass on /api/chat if all primary attempts hit a brief 503/429 wave
    if (!response) {
      const rescueSteps = [
        { model: 'gemini-3.1-flash-lite', delay: 450, timeout: 11000 },
        { model: 'gemini-4-hydrogen', delay: 850, timeout: 14000, thinkingLevel: ThinkingLevel.LOW },
        { model: 'gemini-3.1-flash-lite', delay: 1200, timeout: 14000 },
      ];
      for (const step of rescueSteps) {
        try {
          await sleepMs(step.delay);
          const rescueResp: any = await runWithAbortTimeout(
            (signal) =>
              ai.models.generateContent({
                model: step.model,
                contents: prepared.contents,
                config: buildAttemptConfig(
                  prepared.systemInstruction,
                  { model: step.model, search: false, thinkingLevel: step.thinkingLevel },
                  signal
                ),
              }),
            step.timeout
          );
          const rescueText = typeof rescueResp?.text === 'string' ? rescueResp.text : '';
          if (rescueText.trim()) {
            response = rescueResp;
            usedModel = step.model;
            searchUsed = prepared.aggregatedSources.length > 0;
            break;
          }
        } catch (rescueErr: any) {
          lastError = rescueErr;
          console.warn(`[NEXUS AI RESCUE] ${step.model} falhou: ${(rescueErr?.message || '').slice(0, 120)}`);
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Falha ao obter resposta de todos os modelos disponíveis.');
    }

    const durationMs = Date.now() - startTime;
    const text = response.text || '';

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    const webSearchQueries: string[] = groundingMetadata?.webSearchQueries || [];

    const maxSources = prepared.researchDepth === 'deep' ? 5 : 4;
    const groundingSources =
      prepared.researchDepth === 'fast'
        ? []
        : selectTopImportantSources(groundingChunks, prepared.aggregatedSources, maxSources);

    if (groundingSources.length > 0 && webSearchQueries.length === 0 && prepared.lastText) {
      webSearchQueries.push(prepared.lastText.slice(0, 60));
    }

    return res.json({
      text,
      groundingSources,
      webSearchQueries,
      durationMs,
      model: usedModel,
      searchUsed,
      usageMetadata: response.usageMetadata,
    });
  } catch (error: any) {
    console.error('Erro na chamada da API Gemini:', error);
    return res.status(500).json({
      error: formatFriendlyGeminiError(error),
      rawError: error?.message || 'Erro desconhecido ao processar requisição',
    });
  }
});

// Real-time SSE Streaming Chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
  }

  let ai: GoogleGenAI;
  try {
    ai = getGeminiClient();
  } catch {
    return res.status(500).json({
      error: 'Chave de API Gemini não encontrada no servidor.',
      details: 'Por favor, configure GEMINI_API_KEY nas variáveis de ambiente ou Secrets.',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let clientClosed = false;
  let activeAbortController: AbortController | null = null;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      activeAbortController?.abort();
    }
  });

  const sendEvent = (payload: Record<string, any>) => {
    if (clientClosed) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const prepared = await prepareGeminiChatRequest(req.body);
    if (clientClosed) return res.end();

    const startTime = Date.now();
    let usedModel = 'gemini-3.1-flash-lite';
    let searchUsed = prepared.useSearch;
    let fullText = '';
    const groundingChunksAll: any[] = [];
    const webSearchQueriesSet = new Set<string>();
    let succeeded = false;
    let lastError: any = null;

    for (let idx = 0; idx < prepared.attempts.length; idx++) {
      const attempt = prepared.attempts[idx];
      if (clientClosed) break;
      let hasEmittedChunk = false;
      const attemptController = new AbortController();
      activeAbortController = attemptController;

      try {
        const attemptConfig = buildAttemptConfig(
          prepared.systemInstruction,
          attempt,
          attemptController.signal
        );

        const stream: AsyncIterable<any> = await runWithAbortTimeout(
          () =>
            ai.models.generateContentStream({
              model: attempt.model,
              contents: prepared.contents,
              config: attemptConfig,
            }),
          attempt.timeout,
          attemptController
        );

        usedModel = attempt.model;
        searchUsed = attempt.search || prepared.aggregatedSources.length > 0;

        const iterator = stream[Symbol.asyncIterator]();
        while (true) {
          if (clientClosed) break;
          const { value: chunk, done } = await runWithAbortTimeout(
            () => iterator.next(),
            hasEmittedChunk ? 10000 : attempt.timeout,
            attemptController
          );
          if (done) break;

          const chunkText = typeof chunk?.text === 'string' ? chunk.text : '';
          if (chunkText) {
            hasEmittedChunk = true;
            fullText += chunkText;
            sendEvent({ type: 'chunk', text: chunkText });
          }

          const gm = chunk?.candidates?.[0]?.groundingMetadata;
          if (gm?.groundingChunks && Array.isArray(gm.groundingChunks)) {
            groundingChunksAll.push(...gm.groundingChunks);
          }
          if (gm?.webSearchQueries && Array.isArray(gm.webSearchQueries)) {
            for (const q of gm.webSearchQueries) {
              if (typeof q === 'string' && q.trim()) webSearchQueriesSet.add(q);
            }
          }
        }

        if (!clientClosed && !fullText.trim()) {
          throw new Error('EMPTY_RESPONSE');
        }

        succeeded = true;
        break;
      } catch (err: any) {
        attemptController.abort();
        lastError = err;
        const hasTool = Boolean(attempt.search || attempt.thinkingLevel);
        // If stream cut late after delivering substantial answer, finish cleanly instead of throwing an error
        if (hasEmittedChunk && fullText.trim().length >= 80 && isRetryableGeminiError(err, hasTool)) {
          console.warn(
            `[NEXUS AI STREAM] Corte tardio recuperado (${fullText.length} chars) em ${attempt.model}: ${(err?.message || '').slice(0, 100)}`
          );
          succeeded = true;
          break;
        }
        // If stream failed before or with tiny fragment, reset client buffer and retry cleanly
        if (isRetryableGeminiError(err, hasTool)) {
          if (hasEmittedChunk) {
            fullText = '';
            sendEvent({ type: 'reset' });
          }
          console.warn(
            `[NEXUS AI STREAM] Fallback de ${attempt.model} (search: ${attempt.search}): ${(err?.message || '').slice(0, 140)}`
          );
          if (idx < prepared.attempts.length - 1 && !clientClosed) {
            const isTimeout = String(err?.message || '').includes('TIMEOUT_EXCEEDED');
            await sleepMs(isTimeout || prepared.isCasualSimple ? 40 : Math.min(200 * Math.pow(1.4, idx), 650));
          }
          continue;
        }
        throw err;
      } finally {
        if (activeAbortController === attemptController) {
          activeAbortController = null;
        }
      }
    }

    // Rescue pass via standard generateContent if all streaming attempts hit transient 503/429/timeout
    if (!succeeded && !clientClosed) {
      const rescueSteps = [
        { model: 'gemini-3.1-flash-lite', delay: 450, timeout: 11000 },
        { model: 'gemini-4-hydrogen', delay: 850, timeout: 14000, thinkingLevel: ThinkingLevel.LOW },
        { model: 'gemini-3.1-flash-lite', delay: 1200, timeout: 14000 },
      ];
      for (const step of rescueSteps) {
        if (clientClosed) break;
        const rescueController = new AbortController();
        activeAbortController = rescueController;
        try {
          await sleepMs(step.delay);
          const rescueResp: any = await runWithAbortTimeout(
            (signal) =>
              ai.models.generateContent({
                model: step.model,
                contents: prepared.contents,
                config: buildAttemptConfig(
                  prepared.systemInstruction,
                  { model: step.model, search: false, thinkingLevel: step.thinkingLevel },
                  signal
                ),
              }),
            step.timeout,
            rescueController
          );
          const rescueText = typeof rescueResp?.text === 'string' ? rescueResp.text : '';
          if (rescueText.trim()) {
            fullText = rescueText;
            usedModel = step.model;
            searchUsed = prepared.aggregatedSources.length > 0;
            sendEvent({ type: 'chunk', text: rescueText });
            succeeded = true;
            break;
          }
        } catch (rescueErr: any) {
          rescueController.abort();
          lastError = rescueErr;
          console.warn(`[NEXUS AI STREAM RESCUE] ${step.model} falhou: ${(rescueErr?.message || '').slice(0, 120)}`);
        } finally {
          if (activeAbortController === rescueController) {
            activeAbortController = null;
          }
        }
      }
    }

    if (clientClosed) {
      return res.end();
    }

    if (!succeeded) {
      throw lastError || new Error('Falha ao obter resposta de todos os modelos disponíveis.');
    }

    const durationMs = Date.now() - startTime;
    const maxSources = prepared.researchDepth === 'deep' ? 5 : 4;
    const groundingSources =
      prepared.researchDepth === 'fast'
        ? []
        : selectTopImportantSources(groundingChunksAll, prepared.aggregatedSources, maxSources);

    const webSearchQueries = Array.from(webSearchQueriesSet);
    if (groundingSources.length > 0 && webSearchQueries.length === 0 && prepared.lastText) {
      webSearchQueries.push(prepared.lastText.slice(0, 60));
    }

    sendEvent({
      type: 'done',
      text: fullText,
      groundingSources,
      webSearchQueries,
      durationMs,
      model: usedModel,
      searchUsed,
    });
    return res.end();
  } catch (error: any) {
    console.error('Erro no streaming da API Gemini:', error);
    sendEvent({
      type: 'error',
      error: formatFriendlyGeminiError(error),
      rawError: error?.message || 'Erro desconhecido ao processar requisição',
    });
    return res.end();
  }
});

// Setup Vite middleware in dev or serve dist in prod
async function startServer() {
  const distDir = path.resolve(__dirname, 'dist');
  const distIndex = path.resolve(distDir, 'index.html');
  const hasBuiltDist = fs.existsSync(distIndex);

  if (process.env.NODE_ENV === 'production' && hasBuiltDist) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(distIndex);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEXUS AI] Sistema operacional online na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[NEXUS AI] Falha ao iniciar servidor:', err);
});
