export function simpleId() { 
    return Date.now().toString(36) + Math.random().toString(36).slice(2,9); 
}

export function nowIso() { 
    return new Date().toISOString(); 
}

export function filenameTimeToIso(str) {
  // "2025-09-22T08-45-01-964Z" -> "2025-09-22T08:45:01.964Z"
  return str.replace(
    /^(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    (_, date, h, m, s, ms) => `${date}${h}:${m}:${s}.${ms}Z`
  );
}