# GMGN Runner Discord Bot

Bot Discord untuk mengirim informasi token runner kategori Solana, Robinhood, dan BSC. Bot melakukan polling endpoint JSON, memfilter kandidat berdasarkan config, lalu mengirim alert ke channel Discord atau webhook. Bot ini tidak melakukan transaksi.

**Status integrasi:** scanner dan pengiriman Discord sudah diimplementasikan. Repository ini belum menyediakan endpoint GMGN live yang terverifikasi, API key, atau adapter autentikasi GMGN. Kamu harus menyediakan endpoint JSON yang kompatibel sebelum menerima alert dari data live. Mengisi URL halaman website GMGN saja tidak cukup.

Kategori `robinhood` adalah nama runner di kode. Kode tidak memverifikasi dukungan jaringan Robinhood di GMGN atau apakah token dapat diperdagangkan di Robinhood. Sumber data, mata uang fees, dan link GMGN kategori ini harus dipastikan oleh penyedia endpoint.

## Instalasi

Ikuti [tutorial instalasi dari awal sampai akhir](docs/installation.md). Tutorial mencakup pembuatan bot Discord, pengaturan endpoint, tes notifikasi lokal, dan menjalankan bot di VPS.

Ringkasan setelah aplikasi Discord dan endpoint siap:

```bash
git clone https://github.com/bltzkrgg/bot-runner-token.git
cd bot-runner-token
npm ci
cp .env.example .env
```

Isi `.env`, lalu jalankan:

```bash
npm test
npm run register
npm start
```

Semua runner **nonaktif secara default**. Aktifkan dari Discord setelah memeriksa config:

```text
/getconfig
/setconfig key:tokenAlerts.enabled value:true
/setconfig key:robinhoodAlerts.enabled value:true
/setconfig key:bscAlerts.enabled value:true
```

`key` dan `value` adalah dua opsi slash command yang dipilih di antarmuka Discord.

## Filter Runner

Semua syarat pada kategori terkait harus terpenuhi. Threshold minimum menggunakan `>=`, termasuk market cap; umur maksimum menggunakan `<=`.

| Kategori | Volume rolling 5m | Market cap | Total fees | Umur maksimum |
| --- | --- | --- | --- | --- |
| Solana | USD 100,000 | USD 100,000 | 10 SOL | 30 menit |
| Robinhood | USD 100,000 | Tidak difilter | 0.1 ETH | Tidak difilter |
| BSC | USD 100,000 | USD 100,000 | 1 BNB | 30 menit |

Config dapat diubah lewat `/setconfig` dan disimpan di `data/config.json`. Daftar lengkap nilai default dan contoh perintah ada di [tutorial](docs/installation.md#7-atur-config-di-discord). [Spesifikasi awal config](docs/runner-config-spec.md) juga tersedia; perilaku implementasi dijelaskan di README dan tutorial ini.

## Alur Notifikasi

```text
Endpoint JSON -> polling per kategori -> normalisasi data -> filter runner
              -> cache duplikat -> antrean bersama -> Discord
```

Alert berisi harga, market cap, volume dan swaps 5 menit, fees, liquidity, flow buy/sell, top 10 holders, persentase wallet, status Dex Paid, CA, dan link GMGN.

- Polling default 60 detik; dapat diatur 15-300 detik per kategori. Ini polling, bukan streaming instan.
- Maksimum kandidat lolos yang diperiksa per scan default 5. Kandidat mengikuti urutan endpoint; tidak otomatis diurutkan berdasarkan volume.
- Cache menahan alert berulang untuk kategori + CA yang sama selama 30 menit. Sesudahnya token dapat mendapat alert lagi jika masih lolos filter.
- Antrean bersama memberi jeda 1.5 detik setelah setiap pengiriman, menampung hingga 100 alert, dan melewatkan alert yang menunggu lebih dari 3 menit. Jika penuh, item tertua dibuang.
- Jalur webhook menunggu `retry_after` saat Discord membalas HTTP 429. Ini tidak menjamin bebas rate limit dari GMGN atau Discord.

## Batasan Saat Ini

- Endpoint dipanggil dengan GET dan header JSON; custom authorization header, pagination, dan WebSocket belum tersedia.
- Volume 5m, total fees, dan umur sejak DEX open/migration harus dihitung/disediakan sumber data. Bot tidak menghitungnya dari transaksi mentah.
- Data wajib untuk filter yang hilang membuat kandidat tidak lolos. Kolom informasi lain dapat tampil `N/A`; Dex Paid yang hilang saat ini ditampilkan sebagai `No`.
- Cache dicatat sebelum alert terkirim. Kegagalan kirim dapat menahan alert sampai cache kedaluwarsa, dan antrean belum mempunyai pemulihan umum jika sender gagal. Pantau log saat menjalankan bot.
- Tidak ada pemeriksaan role/admin di handler `/setconfig`. Batasi akses command melalui pengaturan integrasi Discord sebelum dipakai di server bersama.
- Pengujian otomatis mencakup validasi config dan filter runner. Integrasi GMGN live serta pengiriman ke Discord sungguhan membutuhkan kredensial dan pengujian tersendiri.

## Perintah Proyek

| Perintah | Fungsi |
| --- | --- |
| `npm ci` | Menginstal versi dependency dari lockfile |
| `npm test` | Menjalankan pengujian config dan filter |
| `npm run register` | Mendaftarkan `/setconfig` dan `/getconfig` ke satu server Discord |
| `npm start` | Menjalankan bot dan scanner |

`npm run register` mengganti daftar guild commands milik aplikasi ini dengan dua command tersebut. Gunakan aplikasi Discord khusus untuk bot ini.

## File Penting

| File | Isi |
| --- | --- |
| `.env.example` | Template environment variable |
| `src/gmgnClient.js` | Pengambilan JSON dan normalisasi token |
| `src/scanner.js` | Polling, filter, dan deduplikasi |
| `src/format.js` | Format pesan runner |
| `src/discord.js` | Slash commands dan pengiriman Discord |
| `data/config.json` | Config runtime, dibuat setelah config disimpan |
| `data/alert-cache.json` | Cache alert, dibuat setelah kandidat dicatat |

`.env` dan folder `data/` diabaikan Git. Simpan token Discord dan URL webhook sebagai rahasia.
