export function formatMs(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function todayMapId(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return `${day}-track`;
}

export function uuid() {
  return crypto.randomUUID();
}
