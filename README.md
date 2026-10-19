# TaskMate — Pengingat Tugas Siswa

Aplikasi web (PWA) untuk mengelola tugas sekolah: buat tugas, atur tenggat & pengingat, kelompokkan per mata pelajaran, lihat jadwal di kalender, dan pantau progres di dasbor.

Dibangun **tanpa Node.js / build tools** — HTML, CSS, dan ES modules murni. Cocok untuk dijalankan langsung atau dipasang di HP sebagai aplikasi.

---

## Menjalankan aplikasi

### Cara 1 — Server bawaan (PowerShell)

Buka folder proyek di File Explorer, ketik `powershell` di panel alamat, lalu:

```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 5173
```

Kunjungi **http://localhost:5173** di peramban. Biarkan jendela PowerShell terbuka (menutupnya = server berhenti; `Ctrl+C` untuk berhenti).

Port dipakai? Ganti angkanya, misalnya `-Port 8080`, lalu buka `http://localhost:8080`.

### Cara 2 — Server statis lain

Aplikasi ini hanya butuh server file statis apa pun (Live Server VS Code, `npx serve`, Nginx, dll.) yang menyajikan folder ini sebagai root.

> **Penting:** jangan buka `index.html` dengan klik dua kali (`file://`) — peramban memblokir ES modules pada protokol itu.

---

## Memasang di HP (PWA)

Karena aplikasi ini Progressive Web App, Anda bisa memasangnya seperti aplikasi biasa — ada ikon di layar utama, dibuka layar penuh tanpa bilah browser, dan tetap bisa dibuka saat offline.

### Syarat penting

PWA **hanya bisa dipasang jika dibuka lewat `https://` atau `localhost`** — tidak bisa lewat alamat IP biasa (mis. `http://192.168.x.x`).

Pilihan termudah untuk pemakaian pribadi/satu perangkat:

1. **Deploy gratis** ke penyedia statis (GitHub Pages, Netlify, Vercel, Cloudflare Pages) — semuanya memberi HTTPS otomatis.
2. Atau, untuk uji coba di HP yang sama dengan komputer, jalankan server di komputer lalu akses lewat **HTTPS** (butuh sertifikat; paling praktis lewat deploy gratis).

### Android (Chrome)

1. Buka alamat aplikasi (https) di Chrome.
2. Ketuk tombol **⋮** (titik tiga) → **Tambahkan ke layar utama** / **Instal aplikasi**.
3. Konfirmasi. Ikon TaskMate muncul di layar utama/app drawer.

### iPhone / iPad (Safari)

1. Buka alamat aplikasi (https) di Safari.
2. Ketuk tombol **Bagikan** (kotak dengan panah) → **Tambahkan ke Layar Utama**.
3. Beri nama lalu ketuk **Tambahkan**.

### Offline

Setelah dibuka sekali, seluruh aplikasi (48 berkas: CSS, JS, ikon) tersimpan di cache. Bila sinyal hilang, aplikasi tetap terbuka dan data tugas tetap tersimpan di peramban (mode lokal).

---

## Mode penyimpanan

| | Mode Lokal (bawaan) | Mode Supabase |
|---|---|---|
| Penyimpanan | localStorage peramban | Cloud (PostgreSQL) |
| Autentikasi | Hash PBKDF2 di peramban | Supabase Auth (GoTrue) |
| Multi-perangkat | ❌ | ✅ |
| Pengingat | Saat aplikasi terbuka | Database + Edge Function |

**Mode lokal aktif secara otomatis** bila variabel environment Supabase tidak diisi.

### Mengaktifkan mode Supabase (opsional)

1. Buat proyek di [supabase.com](https://supabase.com), lalu salin `supabase/migrations/0001_init.sql` ke SQL Editor dan jalankan.
2. Salin `.env.example` menjadi `.env`, isi kredensial proyek Anda (URL & anon key), lalu umumkan di halaman sebelum `</head>` di `index.html`:

   ```html
   <script>
     window.__TASKMATE_ENV__ = {
       SUPABASE_URL: "https://PROYEK.supabase.co",
       SUPABASE_ANON_KEY: "ISI_ANON_KEY_ANDA"
     };
   </script>
   ```

3. (Opsional) Pasang Edge Function `supabase/functions/send-reminders/index.ts` + `pg_cron` dari migrasi agar pengingat terkirim dari server secara berkala.

---

## Struktur proyek

```
├── index.html              # Cangkang aplikasi (SPA)
├── manifest.webmanifest    # Manifest PWA (ikon, nama, standalone)
├── sw.js                   # Service worker (cache offline)
├── icons/                  # Ikon aplikasi (PNG 192/512/maskable/apple)
├── styles/                 # tokens, base, layout, components, pages
├── js/
│   ├── app.js              # Bootstrap: tema, sesi, routing, scheduler
│   ├── router.js           # Router hash
│   ├── app/theme.js        # Terang/gelap/system
│   ├── utils/              # dom (h()), date, validation, misc
│   ├── store/              # lapisan data (local & supabase adapter)
│   ├── features/           # logika domain tugas
│   ├── services/           # auth, tasks, subjects, reminders, settings
│   ├── ui/                 # komponen (TaskCard, TaskForm, CalendarView, …)
│   └── pages/              # halaman (dashboard, tugas, kalender, …)
├── supabase/
│   ├── migrations/0001_init.sql   # Skema DB + RLS + trigger
│   └── functions/send-reminders/  # Edge function pengingat
└── tools/
    ├── serve.ps1           # Server statis tanpa Node
    ├── make-icons.ps1      # Generator ikon (GDI+)
    └── check.html          # Pemeriksa sintaks modul
```

---

## Pengingat — batasan jujur

- **Mode lokal:** pengingat ditampilkan sebagai notifikasi dalam aplikasi (panel lonceng) saat aplikasi terbuka, dan scheduler memeriksa tiap 20 detik. **Web Push sungguhan butuh backend + HTTPS** — tersedia lewat mode Supabase + Edge Function `send-reminders`.
- **Tidak ada notifikasi push palsu:** aplikasi tidak pernah mengklaim pengingat terkirim ke sistem operasi bila backend belum terpasang.
- **Anti-duplikat:** satu baris pengingat belum-terkirim per tugas (diperbarui di tempat saat tenggat berubah); log notifikasi dide-duplikasi pada `(task_id, remind_at)`.

---

## Pengembangan

Tidak ada proses build. Cukup ubah berkas lalu muat ulang peramban.

Pemeriksaan cepat bahwa semua modul valid: buka `http://localhost:5173/tools/check.html`.
