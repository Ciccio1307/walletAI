export function sanitize(val, maxLen = 200) {
  if (typeof val !== 'string') return val;
  return val.replace(/[<>]/g, '').trim().slice(0, maxLen);
}
