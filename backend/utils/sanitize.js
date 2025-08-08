export const sanitizeString = (s = '') => s.replace(/[\u0000-\u001F\u007F]/g, '').trim();
export const toInt = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);