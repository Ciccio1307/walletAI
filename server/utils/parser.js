import { parseItalianDate } from './dateParser.js';
import { normalizeCategory, normalizeDate } from './validate.js';

const PATTERNS = [
  { keywords: ['sushi', 'pizza', 'burger', 'mcdonalds', 'kebab', 'piadina', 'gelateria',
      'pasticceria', 'panetteria', 'bar', 'caffè', 'caffe', 'colazione', 'pranzo', 'cena',
      'ristorante', 'trattoria', 'osteria', 'rosticceria', 'tavola calda', 'supermercato',
      'esselunga', 'conad', 'coop', 'lidl', 'eurospin', 'pam', 'spesa', 'alimentari'],
    category: 'cibo', type: 'out' },
  { keywords: ['benzina', 'gasolio', 'carburante', 'ip', 'eni', 'shell', 'q8', 'autostrada',
      'pedaggio', 'parcheggio', 'sosta', 'autobus', 'bus', 'metro', 'metropolitana', 'treno',
      'trenitalia', 'italo', 'taxi', 'uber', 'bolt', 'noleggio', 'bollo', 'assicurazione auto',
      'revisione'],
    category: 'trasporti', type: 'out' },
  { keywords: ['farmacia', 'medicinale', 'medicina', 'dottore', 'medico', 'visita', 'analisi',
      'ospedale', 'dentista', 'oculista', 'fisioterapia', 'palestra', 'gym', 'piscina', 'sport',
      'integratore', 'vitamina', 'ottico'],
    category: 'salute', type: 'out' },
  { keywords: ['netflix', 'spotify', 'amazon prime', 'disney', 'youtube', 'cinema', 'teatro',
      'concerto', 'discoteca', 'pub', 'aperitivo', 'videogioco', 'steam', 'playstation', 'xbox',
      'libro', 'fumetto', 'giornale', 'rivista', 'hobby', 'abbonamento streaming'],
    category: 'svago', type: 'out' },
  { keywords: ['affitto', 'mutuo', 'bolletta', 'luce', 'gas', 'acqua', 'enel', 'hera',
      'condominio', 'pulizie', 'ikea', 'bricolage', 'leroy', 'brico', 'arredamento',
      'elettrodomestico', 'internet', 'tim', 'vodafone', 'windtre', 'iliad'],
    category: 'casa', type: 'out' },
  { keywords: ['zara', 'h&m', 'primark', 'zalando', 'amazon', 'shein', 'scarpe', 'vestiti',
      'abbigliamento', 'accessori', 'borsa', 'gioielli', 'profumo', 'telefono', 'smartphone',
      'pc', 'computer', 'cuffie', 'apple', 'samsung'],
    category: 'shopping', type: 'out' },
  { keywords: ['corso', 'formazione', 'università', 'tasse universitarie', 'libri scolastici',
      'cancelleria', 'ufficio', 'stampante', 'software', 'licenza', 'abbonamento lavoro'],
    category: 'lavoro', type: 'out' },
  { keywords: ['regalo', 'compleanno', 'natale', 'festa', 'fiori', 'mazzo', 'anniversario',
      'matrimonio', 'battesimo'],
    category: 'regali', type: 'out' },
  { keywords: ['stipendio', 'salario', 'paga', 'bonifico', 'accredito', 'rimborso', 'cashback',
      'trovati', 'trovato', 'regalo ricevuto', 'dono', 'mamma', 'papà', 'papa', 'nonna', 'nonno',
      'genitore', 'freelance', 'fattura', 'cliente', 'vendita', 'conguaglio'],
    category: 'entrata', type: 'in' },
];

const STOPWORDS = new Set(['ho', 'speso', 'ricevuto', 'pagato', 'comprato', 'preso', 'fatto',
  'per', 'di', 'a', 'in', 'il', 'la', 'lo', 'le', 'gli', 'un', 'una', 'con', 'su', 'dal', 'della',
  'dello', 'dei', 'degli', 'alle', 'alla', 'al', 'nel', 'nella', 'nei', 'delle', 'da', 'che',
  'mi', 'ti', 'ci', 'si', 'era', 'sono', 'ha', 'è', 'e', 'o', 'ma', 'se', 'anche', 'non',
  'euro', 'eur', '€']);

const CURRENCY_WORDS = /\b(?:euro|eur)\b/gi;

// Matches dates before extracting amounts: "spesa 12/03" must not become €12.
// Dots are intentionally excluded because "45.00" is a price, not a date.
function stripDates(text) {
  return text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
    .replace(/\b(\d{1,2})[/-](\d{1,2})\b/g, (match, day, month) => {
      const d = Number(day);
      const m = Number(month);
      return d >= 1 && d <= 31 && m >= 1 && m <= 12 ? ' ' : match;
    });
}

/**
 * Converts Italian-formatted numbers:
 *   1.234,56 -> 1234.56
 *   1,234.56 -> 1234.56
 *   1.200    -> 1200
 *   1,50     -> 1.5
 */
function parseItalianNumber(raw) {
  let s = String(raw).trim().replace(/\s/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot && /^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    // Dots used as thousands separators.
    s = s.replace(/\./g, '');
  }

  const value = parseFloat(s);
  return Number.isFinite(value) ? value : null;
}

function extractAmount(text) {
  const cleaned = stripDates(text);

  // Prefer an explicit currency marker.
  const withSymbol = cleaned.match(/€\s*(\d[\d.,]*)|(\d[\d.,]*)\s*(?:€|eur(?:o|os)?)(?!\w)/i);
  if (withSymbol) {
    return parseItalianNumber(withSymbol[1] || withSymbol[2]);
  }

  // Fallback: first standalone number.
  const bare = cleaned.match(/(?<![\d.,])(\d[\d.,]*)(?![\d.,])/);
  if (bare) return parseItalianNumber(bare[1]);

  return null;
}

function buildDescription(text) {
  const cleaned = stripDates(text)
    .replace(/\b(?:ieri\s+l['’]altro|l['’]altro\s+ieri|altroieri|ieri|oggi|stamani|stamattina|lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica)\b/gi, ' ')
    .replace(/€\s*\d[\d.,]*/g, ' ')
    .replace(/\d[\d.,]*\s*(?:€|eur(?:o|os)?)(?!\w)/gi, ' ')
    .replace(CURRENCY_WORDS, ' ')
    .replace(/\d[\d.,]*/g, ' ')
    .replace(/[^\p{L}\p{N}\s'’]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w.toLowerCase()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.substring(0, 35).replace(/^[\s,;.-]+|[\s,;.-]+$/g, '') || 'Transazione';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Optional AI cache (per-process, small TTL) ───────────────────────────────
const AI_CACHE_TTL_MS = 10 * 60 * 1000;
const AI_CACHE_MAX = 200;
const aiCache = new Map();

function aiCacheGet(key) {
  const hit = aiCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > AI_CACHE_TTL_MS) {
    aiCache.delete(key);
    return null;
  }
  return hit.value;
}

function aiCacheSet(key, value) {
  if (aiCache.size >= AI_CACHE_MAX) {
    const oldest = aiCache.keys().next().value;
    if (oldest) aiCache.delete(oldest);
  }
  aiCache.set(key, { at: Date.now(), value });
}

async function tryOllama(text, today = new Date()) {
  if (process.env.AI_DISABLED === 'true') return null;

  const cacheKey = `${today.toDateString()}|${text.toLowerCase()}`;
  const cached = aiCacheGet(cacheKey);
  if (cached) return cached;

  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const url = baseUrl + '/v1/chat/completions';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  const apiKey = process.env.OLLAMA_API_KEY;

  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

  const configuredTimeout = Number(process.env.AI_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : (apiKey ? 8000 : 3000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `Sei un assistente per finanze personali. Oggi è ${todayStr}. Analizza la transazione e rispondi SOLO con JSON valido senza markdown: { "amount": number, "type": "in"|"out", "description": "string (max 35 chars)", "category": "uno di: cibo,trasporti,salute,svago,regali,casa,shopping,lavoro,entrata,altro", "date": "DD/MM/YYYY" }. Se non capisci, rispondi: { "error": "non capito" }`,
          },
          { role: 'user', content: text },
        ],
        stream: false,
        temperature: 0.1,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.error) return null;

    const amount = parseFloat(parsed.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const rawType = String(parsed.type || '').toLowerCase();
    const type = rawType === 'in' || rawType === 'income' || rawType === 'entrata'
      ? 'in'
      : 'out';

    const result = {
      amount,
      type,
      description: (parsed.description || buildDescription(text)).substring(0, 35),
      category: normalizeCategory(parsed.category),
      date: normalizeDate(parsed.date) || parseItalianDate(text, today),
      source: 'ai',
      confidence: 'high',
    };

    aiCacheSet(cacheKey, result);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function tryDictionary(text, userKeywords = [], today = new Date()) {
  const lower = text.toLowerCase();

  const build = (type, category) => {
    const amount = extractAmount(text);
    if (amount === null) return null;
    return {
      amount,
      type,
      description: buildDescription(text),
      category,
      date: parseItalianDate(text, today),
      source: 'dictionary',
      confidence: 'medium',
    };
  };

  // User keywords have higher priority.
  for (const kw of userKeywords) {
    const keyword = String(kw.keyword || '').toLowerCase();
    if (!keyword) continue;
    if (lower.includes(keyword)) {
      const result = build(kw.type, normalizeCategory(kw.category));
      if (result) return result;
    }
  }

  for (const pattern of PATTERNS) {
    for (const kw of pattern.keywords) {
      const matched = kw.length <= 4
        ? new RegExp(`(^|\\s)${escapeRegex(kw)}(\\s|$)`).test(lower)
        : lower.includes(kw);

      if (matched) {
        const result = build(pattern.type, pattern.category);
        if (result) return result;
      }
    }
  }

  return null;
}

export { extractAmount, buildDescription, tryDictionary };

export async function parseTransaction(text, userKeywords = [], today = new Date()) {
  const input = String(text || '').trim();
  const baseDate = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();

  // Level 1: AI (cached, optional).
  const aiResult = await tryOllama(input, baseDate);
  if (aiResult) return aiResult;

  // Level 2: dictionary.
  const dictResult = tryDictionary(input, userKeywords, baseDate);
  if (dictResult) return dictResult;

  // Level 3: manual form.
  const partialAmount = extractAmount(input);
  return {
    amount: partialAmount || 0,
    type: 'out',
    description: buildDescription(input) || '',
    category: 'altro',
    date: parseItalianDate(input, baseDate),
    source: 'manual',
    confidence: 'low',
    needsManualInput: true,
    partialAmount,
  };
}
