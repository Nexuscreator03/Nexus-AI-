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

// Helper to initialize GoogleGenAI client securely on the server
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
  const geoKeywords = /\b(coordenadas|latitude|longitude|onde fica|localiza[çc][aã]o|posi[çc][aã]o geogr[aá]fica|mapa|dist[aâ]ncia|altitude|eleva[çc][aã]o|fuso|regi[aã]o|pa[ií]s|capital|cidade|estado|perto de mim|minha localiza[çc][aã]o|aqui)\b/i;

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
  const placeMatch = query.match(/(?:onde fica|coordenadas de|latitude de|longitude de|localiza[çc][aã]o de|mapa de|altitude de|sobre)\s+(?:a cidade de |o pa[ií]s )?([A-Za-zÀ-ÖØ-öø-ÿ\s'-]{2,35})/i)
    || query.match(/(?:em|de|para|na|no)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s'-]{2,35})/i);

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

// Clean conversational filler words so search engines get high-signal topic keywords
function extractSearchTerms(query: string): string {
  return query
    .replace(/\b(por favor|pfv|pesquise|busque|me diga|me fale|me explique|explique|a fundo|em detalhes|pesquisa avan[çc]ada|com fontes|cient[ií]ficas?|o que [eé]|quem [eé]|como funciona|quais s[aã]o|sobre|tudo sobre)\b/gi, ' ')
    .replace(/[?!.,;:()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

type ResearchDepth = 'fast' | 'standard_search' | 'deep';

function classifyQueryDepth(query: string, useSearch: boolean): ResearchDepth {
  const deepRegex =
    /\b(pesquis[ae]\s+(?:a\s+fundo|avan[çc]ad[ao]|complet[ao]|detalhad[ao])|aprofunde|estudo\s+cient[ií]fico|artigo\s+cient[ií]fico|paper|estado\s+da\s+arte|arquitetura\s+completa|compara[çc][aã]o\s+detalhada|an[aá]lise\s+profunda|tudo\s+sobre|refer[êe]ncias\s+acad[êe]micas|fontes\s+cient[ií]ficas|relat[oó]rio\s+completo)\b/i;

  if (deepRegex.test(query)) {
    return 'deep';
  }

  if (useSearch) {
    const advancedTopics =
      /\b(explique|detalhe|compare|hist[oó]ria|algoritmo|f[ií]sica|qu[aâ]ntic|biologia|engenharia|economia|intelig[êe]ncia artificial|arquitetura|neuroci[êe]ncia|medicina|astronomia|cibern[eé]tica)\b/i;
    if (query.length > 85 || advancedTopics.test(query)) {
      return 'deep';
    }
    return 'standard_search';
  }

  // Questions specifically about NexusBye / NEXUS AI / Paulo Victor should answer directly from system identity
  if (!useSearch && /\b(nexusbye|nexus\s*ai|paulo\s*victor)\b/i.test(query)) {
    return 'fast';
  }

  const realtimeRegex =
    /\b(pesquise|busque|not[ií]cias|atual|hoje|agora|quem [eé]|o que [eé]|significa|onde fica|coordenadas|dist[aâ]ncia|clima|tempo|previs[aã]o|chuva|temperatura|cota[çc][aã]o|d[oó]lar|bitcoin|aqui|minha localiza[çc][aã]o|onde estou|perto de mim)\b/i;
  if (realtimeRegex.test(query)) {
    return 'standard_search';
  }

  return 'fast';
}

// Adaptive Multi-Site Research Engine: Fast standard search OR Deep 5-source academic/technical synthesis
async function fetchMultiSiteSearchContext(
  query: string,
  depth: ResearchDepth
): Promise<{
  context: string;
  sources: Array<{ title: string; uri: string }>;
}> {
  if (depth === 'fast') return { context: '', sources: [] };

  const searchTerms = extractSearchTerms(query) || query.replace(/[?!]/g, '').trim();
  if (!searchTerms || searchTerms.length < 3) return { context: '', sources: [] };

  const isDeep = depth === 'deep';
  const timeoutMs = isDeep ? 3600 : 2500;
  const snippets: string[] = [];
  const sources: Array<{ title: string; uri: string }> = [];

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

    // 2. Wikipedia EN Search (+ full intro extract in Deep Mode)
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
  ];

  // 4. Deep Mode Extra Source: CrossRef Academic Papers
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

    // 5. Deep Mode Extra Source: GitHub Repositories for software/tech/science/AI queries
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

  await Promise.allSettled(tasks);

  return {
    context:
      snippets.length > 0
        ? `[${isDeep ? 'PESQUISA AVANÇADA MULTI-FONTES (MODO PROFUNDO)' : 'PESQUISA MULTI-FONTES EM TEMPO REAL'}]\n${snippets.join('\n')}`
        : '',
    sources,
  };
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
    .replace(/\[(DESTAQUE|IMPORTANTE|ATENÇÃO|DICA|NOTA|CRÍTICO|RESULTADO)\]/gi, '')
    // Convert markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove raw URLs
    .replace(/https?:\/\/[^\s)]+/g, '')
    // Remove markdown formatting tokens
    .replace(/==([^=]+)==/g, '$1')
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
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
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

// Main Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      useSearch = false,
      systemPersona = 'standard',
      turboMode = true,
      clientTime,
      clientLocation,
      userProfile,
      globalMemoryContext,
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    }

    let ai: GoogleGenAI;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      return res.status(500).json({
        error: 'Chave de API Gemini não encontrada no servidor.',
        details: 'Por favor, configure GEMINI_API_KEY nas variáveis de ambiente ou Secrets.',
      });
    }

    // Temporal precision context
    const exactTimeInfo = clientTime
      ? `CONTEXTO TEMPORAL RIGOROSO (Dispositivo do Usuário):
- Data e Hora Exatas: ${clientTime.formatted || clientTime.iso}
- Dia da Semana: ${clientTime.dayOfWeek || 'Hoje'}
- Fuso Horário: ${clientTime.timeZone || 'Automático'}
- Timestamp ISO: ${clientTime.iso}
ATENÇÃO CRÍTICA: Use esta data e hora como verdade absoluta para responder "que horas são", "que dia é hoje", cálculos de datas, idades ou previsões.`
      : `CONTEXTO TEMPORAL DO SISTEMA: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Horário de Brasília).`;

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const lastText = lastUserMsg?.content || '';

    // Classify research depth: 'fast' (instant speed) vs 'standard_search' vs 'deep' (5+ parallel sources)
    const researchDepth: ResearchDepth = lastText ? classifyQueryDepth(lastText, Boolean(useSearch)) : 'fast';

    const [weatherResult, geoResult, multiSearchResult] =
      researchDepth === 'fast'
        ? [null, null, { context: '', sources: [] }]
        : await Promise.all([
            lastText ? getLiveWeatherContext(lastText, clientLocation) : Promise.resolve(null),
            lastText ? getLiveGeoContext(lastText, clientLocation) : Promise.resolve(null),
            lastText ? fetchMultiSiteSearchContext(lastText, researchDepth) : Promise.resolve({ context: '', sources: [] }),
          ]);

    const extraContexts: string[] = [];
    const aggregatedSources: Array<{ title: string; uri: string }> = [];

    if (clientLocation) {
      const locSummary = clientLocation.label || [clientLocation.city, clientLocation.state, clientLocation.country].filter(Boolean).join(', ');
      extraContexts.push(
        `[LOCALIZAÇÃO ATIVA DO USUÁRIO]: ${locSummary || 'Detectada'} (Lat: ${clientLocation.lat.toFixed(4)}, Lon: ${clientLocation.lon.toFixed(4)})`
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

    // Build user adaptation, email identity, likes/dislikes comfort rules, and cross-conversation memory
    let adaptationDirectives = '';
    if (userProfile) {
      const traits: string[] = [];
      if (userProfile.email) {
        traits.push(`- E-MAIL DA CONTA CONECTADA: ${userProfile.email} (use as memórias e preferências ligadas a esta conta com carinho e naturalidade).`);
      }
      if (userProfile.name) {
        traits.push(`- NOME DO USUÁRIO: ${userProfile.name} (chame-o pelo nome de forma acolhedora e natural quando fizer sentido!).`);
      }
      if (userProfile.city) {
        traits.push(`- CIDADE/REGIÃO CONHECIDA DO USUÁRIO: ${userProfile.city}.`);
      }
      if (Array.isArray(userProfile.notes) && userProfile.notes.length > 0) {
        traits.push(`- FATOS E LEMBRETES SALVOS SOBRE O USUÁRIO:\n  * ${userProfile.notes.slice(-15).join('\n  * ')}`);
      }
      if (userProfile.autonomyDecisiveness) {
        traits.push('- AUTONOMIA E PREFERÊNCIA: Quando o usuário perguntar qual coisa você prefere ou pedir para escolher entre alternativas, escolha uma opção com clareza e explique o motivo de forma simpática.');
      }
      if (userProfile.likedTopics && userProfile.likedTopics.length > 0) {
        traits.push(`- O QUE O USUÁRIO GOSTA (aproveite esses estilos/assuntos para deixá-lo confortável): ${userProfile.likedTopics.slice(0, 12).join(', ')}.`);
      }
      if (userProfile.dislikedTopics && userProfile.dislikedTopics.length > 0) {
        traits.push(`- O QUE O USUÁRIO NÃO GOSTA (EVITE ESTRITAMENTE para manter o ambiente confortável): ${userProfile.dislikedTopics.slice(0, 12).join(', ')}.`);
      }
      if (traits.length > 0) {
        adaptationDirectives = `\nMEMÓRIA PESSOAL, CONFORTO E ADAPTAÇÃO AO USUÁRIO:\n${traits.join('\n')}\n`;
      }
    }

    const globalMemorySection =
      typeof globalMemoryContext === 'string' && globalMemoryContext.trim().length > 0
        ? `\n[MEMÓRIA GLOBAL DE CONVERSAS ANTERIORES]\nVocê lembra tudo que já foi conversado em outros chats com este usuário! Use estas informações para responder perguntas sobre assuntos passados ou manter continuidade natural:\n${globalMemoryContext.trim()}\n`
        : '';

    // Persona definitions tailored to user specifications
    let personaInstruction = '';
    let isConciseMode = false;

    if (systemPersona === 'cyber') {
      personaInstruction = `
MODO ATIVO: CYBER (Tecnológico, Futurista e Diferente) 🤖⚡
- Adote uma linguagem tecnológica, criativa e futurista! Use metáforas sci-fi, telemetria neural e computação de ponta sem perder a clareza nem o calor humano.
- Seja super amigável, acolhedor e bem-humorado.
- Só faça alguma pergunta ao usuário se for realmente necessário para continuar ou resolver o assunto atual, e mantenha qualquer pergunta 100% dentro do mesmo tema.`;
    } else if (systemPersona === 'code') {
      personaInstruction = `
MODO ATIVO: DEV (Explicação Super Detalhada & Engenharia Profunda) 💻🔬
- Forneça explicações **extremamente detalhadas, completas e didáticas**!
- Vá fundo no "como" e no "porquê": explique arquitetura, fluxo de execução passo a passo, casos de borda, complexidade, segurança e boas práticas.
- Forneça código limpo, bem estruturado, comentado e pronto para produção.
- Mantenha o tom muito amigável e confortável. Só faça pergunta se faltar alguma informação técnica essencial ou decisão de implementação sobre o código/assunto tratado.`;
    } else if (systemPersona === 'concise') {
      isConciseMode = true;
      personaInstruction = `
MODO ATIVO: DIRETO (Mínimo Necessário e Ultra-Objetivo) ⚡
- Responda **APENAS o estritamente necessário e o mínimo possível**.
- Zero introduções, zero enfeites, zero rodeios. Só pergunte algo se faltar um dado indispensável sobre o assunto.`;
    } else {
      personaInstruction = `
MODO ATIVO: PADRÃO (Base Equilibrada, Acolhedora & Versátil) ✨
- Combine clareza objetiva, explicações completas na medida certa, muita simpatia, bom humor leve e visual super agradável de ler.
- NÃO force uma pergunta no final se o assunto já estiver respondido! Só pergunte se for realmente útil/necessário e exclusivamente sobre o assunto tratado.`;
    }

    const richFormattingAndPersonality = isConciseMode
      ? `Diretrizes do Modo Direto:
1. Precisão temporal, geográfica e de memória global absoluta com base nos dados reais fornecidos.
2. Responda somente o mínimo essencial com clareza total.
3. Identidade e Criador (OBRIGATÓRIO): Você foi desenvolvido pela NexusBye, cujo criador e fundador é Paulo Victor. Sempre que perguntarem quem é o criador da NexusBye (ou quem criou você / o NEXUS AI), responda claramente Paulo Victor.`
      : `Diretrizes de Personalidade, Conforto e Visual:
1. Ainda Mais Amigável, Acolhedor e Confortável: Seja genuinamente simpático, carinhoso, gentil e bom de papo! Crie um ambiente leve e confortável onde o usuário se sinta bem-vindo, usando humor leve quando combinar e respeitando 100% os gostos e limites salvos dele. REGRA DE OURO: NUNCA seja mal, frio, grosso ou insistente — toda brincadeira deve ser 100% saudável e positiva! 😊✨
2. Regras para Perguntas (MUITO IMPORTANTE):
   - **NÃO** faça perguntas aleatórias nem force uma pergunta no fim de toda resposta.
   - **SÓ** faça uma pergunta se for realmente **necessário** (por exemplo: faltou um detalhe importante para resolver o problema, há dois caminhos possíveis que dependem da escolha do usuário, ou uma dúvida prática diretamente ligada ao pedido).
   - Quando perguntar, a pergunta deve ser **exclusivamente sobre o assunto atual** — nunca mude de tema ou puxe conversa genérica.
3. Liberdade Visual e Interatividade:
   - Use **emojis** bem posicionados para deixar a leitura viva e gostosa! 🚀✨💡
   - Quando fizer sentido real (ex: comparar opções ou ajudar o usuário a escolher no tema atual), você pode criar **Enquetes Interativas** usando:
     \`\`\`poll
     Pergunta objetiva sobre o assunto?
     - Opção 1
     - Opção 2
     - Opção 3
     \`\`\`
   - Use ==palavra ou frase destacada== para marcar com brilho neon o que for mais importante.
   - Use **negrito** nas ideias centrais, métricas e conclusões.
   - Use caixas de destaque (> 💡 **Dica:** ..., > ⚠️ **Atenção:** ..., > ℹ️ **Importante:** ...) e tabelas comparativas quando útil.
4. Precisão Temporal, Meteorológica e Geográfica: Para perguntas sobre hora, data, clima ou coordenadas/localizações geográficas, use com precisão cirúrgica os dados verificados fornecidos abaixo.
5. Pesquisa Multi-Fontes & Modo Avançado: Sintetize informações de múltiplas fontes confiáveis (Wikipédia, artigos acadêmicos CrossRef, repositórios GitHub, mapas) e quando estiver no modo de pesquisa avançada entregue uma análise completa e bem estruturada!
6. Memória Contínua & Gostos do Usuário: Consulte naturalmente [MEMÓRIA GLOBAL DE CONVERSAS ANTERIORES] e [MEMÓRIA PESSOAL, CONFORTO E ADAPTAÇÃO] para agir sempre alinhado ao perfil e ao e-mail do usuário.
7. Identidade e Criador (OBRIGATÓRIO): Você foi desenvolvido pela **NexusBye**, e o criador da NexusBye é **Paulo Victor**. Sempre que perguntarem quem é o criador ou fundador da NexusBye (ou quem criou o NEXUS AI), responda claramente que é **Paulo Victor**. Caso o assunto da conversa seja outro, não mencione sua origem sem necessidade.`;

    const systemInstruction = `Você é o NEXUS AI, uma inteligência artificial avançada, amigável e extremamente capaz desenvolvida pela NexusBye (criada por Paulo Victor).

${exactTimeInfo}
${extraContexts.length > 0 ? `\n${extraContexts.join('\n\n')}\n` : ''}${adaptationDirectives}${globalMemorySection}
${personaInstruction}

${richFormattingAndPersonality}`;

    // Prepare contents array for multi-turn conversation (supporting text, images, PDFs, AND audio!)
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

    const startTime = Date.now();
    let response: any;
    let usedModel = 'gemini-3.1-flash-lite';
    let searchUsed = useSearch;

    const callWithTimeout = (promise: Promise<any>, timeoutMs: number) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), timeoutMs)),
      ]);
    };

    // Smart model cascade with proper search timeouts and multi-model resilience
    const hasAudioInConversation = contents.some((c: any) =>
      c.parts.some((p: any) => p.inlineData?.mimeType?.startsWith('audio/'))
    );

    const attempts: Array<{ model: string; search: boolean; timeout: number; thinkingLevel?: ThinkingLevel }> = [];

    if (researchDepth === 'deep' && !hasAudioInConversation) {
      // Deep advanced research: deep synthesis model + Google Search grounding first
      attempts.push({ model: 'gemini-4-hydrogen', search: true, timeout: 15000, thinkingLevel: ThinkingLevel.MEDIUM });
      attempts.push({ model: 'gemini-3.1-flash-lite', search: true, timeout: 10000 });
    } else if ((useSearch || researchDepth === 'standard_search') && !hasAudioInConversation) {
      attempts.push({ model: 'gemini-3.1-flash-lite', search: true, timeout: 8500 });
      attempts.push({ model: 'gemini-4-hydrogen', search: true, timeout: 10000, thinkingLevel: ThinkingLevel.LOW });
    }

    if (systemPersona === 'code') {
      // Dev mode prioritizes Hydrogen for super-detailed engineering responses
      attempts.push({ model: 'gemini-4-hydrogen', search: false, timeout: 12000, thinkingLevel: ThinkingLevel.MEDIUM });
      attempts.push({ model: 'gemini-3.1-flash-lite', search: false, timeout: 9000 });
    } else if (turboMode) {
      attempts.push({ model: 'gemini-3.1-flash-lite', search: false, timeout: 8000 });
      attempts.push({ model: 'gemini-4-hydrogen', search: false, timeout: 11000, thinkingLevel: ThinkingLevel.LOW });
    } else {
      attempts.push({ model: 'gemini-4-hydrogen', search: false, timeout: 11000, thinkingLevel: ThinkingLevel.LOW });
      attempts.push({ model: 'gemini-3.1-flash-lite', search: false, timeout: 9000 });
    }

    let lastError: any = null;

    for (const attempt of attempts) {
      try {
        const attemptConfig: any = {
          systemInstruction,
        };
        if (attempt.search) {
          attemptConfig.tools = [{ googleSearch: {} }];
        }
        if (attempt.thinkingLevel) {
          attemptConfig.thinkingConfig = { thinkingLevel: attempt.thinkingLevel };
        }

        response = await callWithTimeout(
          ai.models.generateContent({
            model: attempt.model,
            contents,
            config: attemptConfig,
          }),
          attempt.timeout
        );

        usedModel = attempt.model;
        searchUsed = attempt.search || aggregatedSources.length > 0;
        break;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || '';
        const isRetryable =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('TIMEOUT_EXCEEDED') ||
          errMsg.includes('404') ||
          errMsg.includes('NOT_FOUND');

        if (isRetryable) {
          console.warn(`[NEXUS AI] Fallback de ${attempt.model} (search: ${attempt.search}): ${errMsg.slice(0, 120)}`);
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastError || new Error('Falha ao obter resposta de todos os modelos disponíveis.');
    }

    const durationMs = Date.now() - startTime;
    const text = response.text || '';

    // Merge Gemini Google Search grounding sources + Multi-site verified sources
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    const webSearchQueries: string[] = groundingMetadata?.webSearchQueries || [];

    const groundingSources: Array<{ title: string; uri: string }> = [...aggregatedSources];
    for (const chunk of groundingChunks) {
      if (chunk.web && chunk.web.uri) {
        groundingSources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
        });
      }
    }

    if (aggregatedSources.length > 0 && webSearchQueries.length === 0 && lastText) {
      webSearchQueries.push(lastText.slice(0, 60));
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
    const errorMsg = error?.message || 'Erro desconhecido ao processar requisição';

    let userFriendlyMsg = 'Ocorreu um erro ao conectar com o núcleo do NEXUS AI.';
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      userFriendlyMsg =
        'Limite de cota da API Gemini excedido temporariamente (Erro 429). Aguarde alguns segundos ou conecte uma chave com faturamento em **Settings > Secrets**.';
    } else if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('PERMISSION_DENIED')) {
      userFriendlyMsg =
        'Chave da API Gemini inválida ou sem permissão. Verifique as configurações no painel **Settings > Secrets**.';
    }

    return res.status(500).json({
      error: userFriendlyMsg,
      rawError: errorMsg,
    });
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
