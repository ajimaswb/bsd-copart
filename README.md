# Monitoring Copart BSD

Dashboard Business Support Department PT Total Quality Indonesia untuk memantau copart:
program, jadwal selesai, survei kepuasan, target dan nilai tercapai (Rp), serta dokumen QA,
appreciation letter, dan testimoni.

- Situs: https://bsd-copart.vercel.app (folder `web/`, statis tanpa build, project Vercel `bsd-copart`).
- Backend: Supabase project **tq-bsd** (`rmrowigqnrkyujcvoyzi`).
  - Login: Supabase Auth (email & password).
  - Data: tabel `copart` (kolom `data` jsonb) dan `members`.
  - Dokumen: Storage bucket privat `dokumen` (PDF, JPG, PNG, WEBP, MP4, WEBM; maks 20 MB).
  - Akun anggota: Edge Function `kelola-akun`.
- Skema & aturan akses: `supabase/schema.sql`. Kode Edge Function: `supabase/functions/kelola-akun/index.ts`.

## Peran

| Peran  | Lihat | Input & upload | Kelola akses |
|--------|:-----:|:--------------:|:------------:|
| viewer |  ya   |                |              |
| editor |  ya   |       ya       |              |
| admin  |  ya   |       ya       |      ya      |

Peran disimpan di tabel `members` (email huruf kecil). Row Level Security dan Storage policies
memakai fungsi `my_role()` sehingga aturan berlaku di server, bukan hanya di tampilan.

## Akun

- **Admin pertama**: buka https://bsd-copart.vercel.app/#setup-admin, isi email admin yang ada di
  tabel `members` dan password. Halaman ini hanya berfungsi selama belum ada satu pun akun login.
- **Anggota lain**: admin membuka menu akun > **Kelola akses**, mengisi nama, email, peran, dan
  password awal. Sampaikan password awal secara langsung; anggota bisa menggantinya lewat
  menu akun > **Ganti password**.
- **Lupa password**: admin mengatur ulang lewat **Kelola akses** > "Atur ulang password".
  Dashboard tidak mengirim email.

## Disarankan

Supabase Dashboard > Authentication > Sign In / Providers: matikan **Allow new users to sign up**
setelah admin pertama dibuat. Akun baru tetap bisa dibuat admin lewat Kelola akses.

## Deploy

Setelah mengubah file di `web/`, jalankan dari folder `web/`:

```bash
vercel deploy --prod
```

`artifact-version/` berisi versi awal dashboard (artifact claude.ai). `arsip-firebase/` berisi
konfigurasi Firebase lama yang tidak dipakai lagi.
