export function parseItalianDate(text) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  // Full date DD/MM/YYYY
  const fullMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (fullMatch) {
    return `${pad(fullMatch[1])}/${pad(fullMatch[2])}/${fullMatch[3]}`;
  }

  // Partial date DD/MM (assume current year)
  const partialMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (partialMatch) {
    return `${pad(partialMatch[1])}/${pad(partialMatch[2])}/${today.getFullYear()}`;
  }

  const lower = text.toLowerCase();

  if (lower.includes('ieri')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return fmt(d);
  }

  if (lower.includes('oggi') || lower.includes('stamani') || lower.includes('stamattina')) {
    return fmt(today);
  }

  if (lower.includes('ieri l\'altro') || lower.includes("ieri l'altro") || lower.includes('l\'altro ieri')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 2);
    return fmt(d);
  }

  const dayNames = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  const dayMap = { domenica: 0, 'lunedì': 1, 'martedì': 2, 'mercoledì': 3, 'giovedì': 4, 'venerdì': 5, sabato: 6 };

  for (const [name, num] of Object.entries(dayMap)) {
    if (lower.includes(name)) {
      const d = new Date(today);
      const diff = (d.getDay() - num + 7) % 7;
      d.setDate(d.getDate() - (diff === 0 ? 7 : diff));
      return fmt(d);
    }
  }

  return fmt(today);
}
