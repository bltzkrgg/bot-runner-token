# Solana Token Intelligence

Engine intelligence **on-demand** kini dipakai bot terpadu Discord/Telegram di root. [Panduan startup terpadu](../docs/unified-bot.md). Folder ini berisi engine, database, riset, dan tooling offline; bukan bot production kedua. Analisis CA tetap hanya berjalan saat diminta; alert runner/spike otomatis dikelola runtime root.

## Status MVP

Sudah tersedia: TypeScript strict, Zod, validasi base58 32-byte, adapter GMGN, fixture offline, cache sumber dan request deduplication, CLI, command Telegram, laporan Indonesia, schema PostgreSQL/Drizzle, penyimpanan scan transaksional, import benchmark berlabel, cohort fallback, directional percentile, similarity standard-scaled, label outcome offline, dan baseline riset logistic regression.

**Default hanya mode mock.** Setiap laporan menandai data buatan dan tidak mengklaim bahwa angka demo menggambarkan CA yang dikirim. Skor dan frekuensi outcome tidak diterbitkan dari fixture. Tanpa dataset nyata yang cukup, laporan menampilkan `DATA BELUM CUKUP`.

Belum selesai: koneksi GMGN live terautentikasi, cache terpisah per endpoint holder/developer, collector GMGN dengan cursor/backoff, histori developer lengkap, scoring developer terkalibrasi, klasifikasi rug-like/dead berdasarkan liquidity dan volume, kalibrasi model, dan validasi operasional Telegram/PostgreSQL sungguhan. Tidak ada model yang dipasang sebagai predictor di bot. Modul API HTTP tidak ditambahkan karena command Telegram dan CLI sudah menjadi jalur MVP.

## Setup Offline

Dari root repository:

```bash
cd intelligence
npm ci
cp .env.example .env
npm run typecheck
npm test
npm run scan -- So11111111111111111111111111111111111111112
```

Node.js 20+ diperlukan. Tanpa `DATABASE_URL`, scanner memakai database memory yang hilang saat restart. CLI tidak membutuhkan token Telegram atau kredensial GMGN. Contoh mint di atas hanya input valid untuk tes; laporan selalu data token `DEMO`, bukan analisis wrapped SOL.

## Telegram

Buat bot lewat BotFather dan isi `TELEGRAM_BOT_TOKEN` dalam `intelligence/.env`. Buat random secret dengan `node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'`, lalu masukkan ke `USER_HASH_SECRET`. Secret dipakai untuk HMAC ID Telegram; username dan nama pengguna tidak disimpan.

```bash
npm start
```

Command: `/start`, `/help`, `/scan <CA>`, `/quick <CA>`, `/dev <CA>`, `/holders <CA>`, `/smart <CA>`, `/similar <CA>`. CA tanpa command juga diterima. Validasi sintaks tidak membuktikan address tersebut adalah mint token yang ada di chain; adapter live nantinya harus memverifikasi keberadaan token.

Perintah `npm start` di folder ini hanya entrypoint scanner standalone untuk development. Untuk penggunaan lengkap jalankan `npm start` dari root; jangan jalankan kedua proses bersamaan. Config runner/spike kini sama untuk Discord dan Telegram.

## PostgreSQL dan Benchmark

Isi `DATABASE_URL=postgresql://user:password@localhost:5432/sol_intel`, buat database kosong, lalu:

```bash
npm run db:push
```

Gunakan database khusus modul ini. Drizzle push menyelaraskan schema dan dapat meminta konfirmasi perubahan; review output sebelum menerapkannya pada database yang sudah berisi data. Table menggunakan prefix `intel_`. Raw source di MVP adalah snapshot ternormalisasi, bukan seluruh payload private GMGN.

Import JSONL dengan satu `{ "id": "...", "snapshot": {...}, "outcomes": {...} }` per baris:

```bash
npm run benchmark:import -- ./data/benchmark.jsonl
```

Schema internal ada di `src/types.ts`. Hanya source `gmgn`, mint valid, timestamp masa lalu, dan label matang minimal 24 jam yang diterima import. Asal data tetap harus diaudit di luar bot; label `source` bukan bukti keaslian. Import idempotent berdasarkan mint + snapshotAt + source. History tidak menggabungkan demo dan GMGN.

Saat ini mode live sengaja ditolak, sehingga dataset GMGN belum dapat digunakan untuk analisis token live sampai adapter dihubungkan. Engine benchmark dapat diuji melalui fixture unit tests.

## Riset

Python 3.11+:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r research/requirements.txt
python -m unittest discover -s research -p 'test_*.py'
python research/label_outcomes.py data/observations-with-prices.jsonl data/benchmark.jsonl
python research/build_dataset.py data/benchmark.jsonl data/features.csv
python research/train_model.py data/features.csv --cutoff 2026-09-01T00:00:00Z
```

Input labeler berisi `id`, `snapshot`, dan `priceSamples: [{time: unix_seconds, priceUsd: number}]`. Harga sampel harus mencakup setiap menit sejak snapshot hingga 24h. Horizon dengan gap tetap unknown. MFE/MAE dari sampel ini adalah aproksimasi excursion terhadap entry, bukan peak-to-trough drawdown atau intrabar OHLC ekstrem.

Training menolak <1000 token train atau <300 token test lengkap, memakai split waktu dan purge label train yang belum matang sebelum cutoff. Output ROC-AUC, PR-AUC, Brier; belum calibrated dan tidak digunakan bot. Jangan mengartikan sample rate sebagai probabilitas prediksi.

## Dokumentasi

- [Arsitektur](docs/architecture.md)
- [Integrasi GMGN](docs/gmgn-integration.md)
- [Benchmark](docs/benchmark-methodology.md)
- [Scoring](docs/scoring-methodology.md)
- [Batas data dan kelayakan](docs/data-limitations.md)
- [Deployment](docs/deployment.md)
