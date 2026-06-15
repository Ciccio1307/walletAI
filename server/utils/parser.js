import { parseItalianDate } from './dateParser.js';

const PATTERNS = [
  { keywords: ['sushi','pizza','burger','mcdonalds','kebab','piadina','gelateria',
      'pasticceria','panetteria','bar','caffè','caffe','colazione','pranzo','cena',
      'ristorante','trattoria','osteria','rosticceria','tavola calda','supermercato',
      'esselunga','conad','coop','lidl','eurospin','pam','spesa','alimentari'],
    category: 'cibo', type: 'out' },
  { keywords: ['benzina','gasolio','carburante','ip','eni','shell','q8','autostrada',
      'pedaggio','parcheggio','sosta','autobus','bus','metro','metropolitana','treno',
      'trenitalia','italo','taxi','uber','bolt','noleggio','bollo','assicurazione auto',
      'revisione'],
    category: 'trasporti', type: 'out' },
  { keywords: ['farmacia','medicinale','medicina','dottore','medico','visita','analisi',
      'ospedale','dentista','oculista','fisioterapia','palestra','gym','piscina','sport',
      'integratore','vitamina','ottico'],
    category: 'salute', type: 'out' },
  { keywords: ['netflix','spotify','amazon prime','disney','youtube','cinema','teatro',
      'concerto','discoteca','pub','aperitivo','videogioco','steam','playstation','xbox',
      'libro','fumetto','giornale','rivista','hobby','abbonamento streaming'],
    category: 'svago', type: 'out' },
  { keywords: ['affitto','mutuo','bolletta','luce','gas','acqua','enel','hera',
      'condominio','pulizie','ikea','bricolage','leroy','brico','arredamento',
      'elettrodomestico','internet','tim','vodafone','windtre','iliad'],
    category: 'casa', type: 'out' },
  { keywords: ['zara','h&m','primark','zalando','amazon','shein','scarpe','vestiti',
      'abbigliamento','accessori','borsa','gioielli','profumo','telefono','smartphone',
      'pc','computer','cuffie','apple','samsung'],
    category: 'shopping', type: 'out' },
  { keywords: ['corso','formazione','università','tasse universitarie','libri scolastici',
      'cancelleria','ufficio','stampante','software','licenza','abbonamento lavoro'],
    category: 'lavoro', type: 'out' },
  { keywords: ['regalo','compleanno','natale','festa','fiori','mazzo','anniversario',
      'matrimonio','battesimo'],
    category: 'regali', type: 'out' },
  { keywords: ['stipendio','salario','paga','bonifico','accredito','rimborso','cashback',
      'trovati','trovato','regalo ricevuto','dono','mamma','papà','papa','nonna','nonno',
      'genitore','freelance','fattura','cliente','vendita','conguaglio'],
    category: 'entrata', type: 'in' },
];

const STOPWORDS = new Set(['ho','speso','ricevuto','pagato','comprato','preso','fatto',
  'per','di','a','in','il','la','lo','le','gli','un','una','con','su','dal','della',
  'dello','dei','degli','alle','alla','al','nel','nella','nei','delle','da','che',
  'mi','mi','ti','ci','si','era','sono','ha','è','e','o','ma','se','anche','non',
  'euro','eur','€']);

function extractAmount(text) {
  const m = text.match(/(\d+[.,]\d+|\d+)\s*€|€\s*(\d+[.,]\d+|\d+)/);
  if (m) {
    const raw = (m[1] || m[2]).replace(',', '.');
    return parseFloat(raw);
  }
  const m2 = text.match(/\b(\d+[.,]\d+|\d+)\b/);
  if (m2) return parseFloat(m2[1].replace(',', '.'));
  return null;
}

function buildDescription(text) {
  const cleaned = text
    .replace(/(\d+[.,]?\d*)\s*€?/g, '')
    .replace(/€\s*(\d+[.,]?\d*)/g, '')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '')
    .replace(/\b(oggi|ieri|stamani|stamattina|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b/gi, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w.toLowerCase()))
    .join(' ')
    .trim();
  return cleaned.substring(0, 35) || 'Transazione';
}

async function tryOllama(text) {
  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const url     = baseUrl + '/v1/chat/completions';
  const model   = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  const apiKey  = process.env.OLLAMA_API_KEY; // opzionale — necessario per Groq/OpenRouter

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

  // Cloud API: timeout più lungo (8s); Ollama locale: 3s
  const timeoutMs = apiKey ? 8000 : 3000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

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

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.error) return null;
    if (!parsed.amount || !parsed.type) return null;

    return {
      amount: parseFloat(parsed.amount),
      type: parsed.type,
      description: (parsed.description || buildDescription(text)).substring(0, 35),
      category: parsed.category || 'altro',
      date: parsed.date || new Date().toLocaleDateString('it-IT'),
      source: 'ai',
      confidence: 'high',
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function tryDictionary(text, userKeywords = []) {
  const lower = text.toLowerCase();

  // Check user keywords first (higher priority)
  for (const kw of userKeywords) {
    if (lower.includes(kw.keyword.toLowerCase())) {
      const amount = extractAmount(text);
      if (!amount) continue;
      return {
        amount,
        type: kw.type,
        description: buildDescription(text),
        category: kw.category,
        date: parseItalianDate(text),
        source: 'dictionary',
        confidence: 'medium',
      };
    }
  }

  // Built-in patterns
  for (const pattern of PATTERNS) {
    for (const kw of pattern.keywords) {
      // Use word-boundary match for short keywords to avoid false substring hits
      const matched = kw.length <= 4
        ? new RegExp(`(^|\\s)${kw}(\\s|$)`).test(lower)
        : lower.includes(kw);
      if (matched) {
        const amount = extractAmount(text);
        if (!amount) continue;
        return {
          amount,
          type: pattern.type,
          description: buildDescription(text),
          category: pattern.category,
          date: parseItalianDate(text),
          source: 'dictionary',
          confidence: 'medium',
        };
      }
    }
  }

  return null;
}

export { extractAmount, buildDescription, tryDictionary };

export async function parseTransaction(text, userKeywords = []) {
  // Level 1: Ollama
  const aiResult = await tryOllama(text);
  if (aiResult) return aiResult;

  // Level 2: Dictionary
  const dictResult = tryDictionary(text, userKeywords);
  if (dictResult) return dictResult;

  // Level 3: Manual
  const partialAmount = extractAmount(text);
  return {
    amount: partialAmount || 0,
    type: 'out',
    description: buildDescription(text) || '',
    category: 'altro',
    date: parseItalianDate(text),
    source: 'manual',
    confidence: 'low',
    needsManualInput: true,
    partialAmount: partialAmount || null,
  };
}
