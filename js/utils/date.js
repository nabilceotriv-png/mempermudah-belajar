// Utilitas tanggal & waktu — konsisten dengan zona waktu pengguna.
// Penyimpanan: string ISO instan (UTC) "2026-10-18T07:30:00.000Z".
// Semua tampilan dikonversi ke waktu lokal pengguna TANPA pergeseran tanggal:
// bagian tanggal selalu diambil dari komponen lokal Date, bukan dari slice ISO.

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function newDate() { return new Date(); }

export function pad(n) { return String(n).padStart(2, '0'); }

/** "YYYY-MM-DD" dari Date berdasarkan waktu lokal (aman dari geser UTC). */
export function localDateKey(dateOrIso) {
  const d = toDate(dateOrIso);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "HH:MM" dari Date berdasarkan waktu lokal. */
export function localTimeKey(dateOrIso) {
  const d = toDate(dateOrIso);
  if (!d) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDate(input) {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** Gabung tanggal "YYYY-MM-DD" + waktu "HH:MM" menjadi objek Date lokal. */
export function fromLocalParts(dateStr, timeStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

/** "YYYY-MM-DD" + "HH:MM" -> ISO instan untuk penyimpanan. */
export function toIsoLocal(dateStr, timeStr) {
  const d = fromLocalParts(dateStr, timeStr);
  return d ? d.toISOString() : null;
}

export function isSameDay(a, b) { return localDateKey(a) === localDateKey(b); }

export function isToday(input) { return isSameDay(input, new Date()); }

export function isPast(input) {
  const d = toDate(input);
  return d ? d.getTime() < Date.now() : false;
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  return d;
}

export function formatTanggal(input, opts = { short: false }) {
  const d = toDate(input);
  if (!d) return '—';
  const hari = opts.short ? HARI_PENDEK[d.getDay()] : HARI[d.getDay()];
  const bulan = opts.short ? BULAN_PENDEK[d.getMonth()] : BULAN[d.getMonth()];
  return `${hari}, ${d.getDate()} ${bulan} ${d.getFullYear()}`;
}

export function formatWaktu(input) {
  const d = toDate(input);
  if (!d) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTanggalWaktu(input) {
  const d = toDate(input);
  if (!d) return '—';
  return `${formatTanggal(d, { short: true })} • ${formatWaktu(d)} WIB`.replace(' WIB', '');
}

export function formatBulanTahun(year, monthIndex) {
  return `${BULAN[monthIndex]} ${year}`;
}

/** Bahasa relatif: "3 jam lagi", "2 hari lagi", "telat 1 hari". */
export function sisaWaktu(input, reference = new Date()) {
  const d = toDate(input);
  if (!d) return '—';
  const diff = d.getTime() - reference.getTime();
  const menit = Math.round(Math.abs(diff) / 60000);
  const jam = Math.round(menit / 60);
  const hari = Math.round(jam / 24);
  const lewat = diff < 0;
  let teks;
  if (menit < 1) teks = 'kurang dari 1 menit';
  else if (menit < 60) teks = `${menit} menit`;
  else if (jam < 24) teks = `${jam} jam`;
  else teks = `${hari} hari`;
  return lewat ? `telat ${teks}` : `${teks} lagi`;
}

/** "18 Okt 2026, 23:59" — format ringkas tanpa nama hari. */
export function formatRingkas(input) {
  const d = toDate(input);
  if (!d) return '—';
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}, ${formatWaktu(d)}`;
}

export function hariIniPanjang() {
  const d = new Date();
  return formatTanggal(d);
}
