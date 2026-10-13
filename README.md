# GMGN Runner and Token Intelligence

Satu bot dengan fungsi yang sama di Discord dan Telegram: alert runner/spike, auto-analisis CA Solana/BSC/Robinhood, laporan intelligence, serta pengaturan bersama. Satu proses root menjalankan scanner sekali dan memakai satu service/cache intelligence untuk kedua platform. [Panduan bot terpadu](docs/unified-bot.md).

Kirim CA **tanpa command** untuk auto-analisis Solana, BSC, atau Robinhood. Discord membaca pesan di semua channel/DM yang dapat diakses (allowlist opsional); aktifkan Message Content intent. CA EVM diperiksa pada BSC dan Robinhood, dengan hasil per jaringan. Intelligence tetap berlabel demo sampai adapter live terverifikasi.

Bot mengirim informasi token runner kategori Solana, Robinhood, dan BSC ke tujuan Discord dan Telegram yang dikonfigurasi. Intelligence manual saat ini memakai data demo; endpoint GMGN live dan dataset historis nyata belum tersedia. Bot ini tidak melakukan transaksi.

**Status integrasi:** scanner dan pengiriman Discord sudah diimplementasikan. Repository ini belum menyediakan endpoint GMGN live yang terverifikasi, API key, atau adapter autentikasi GMGN. Kamu harus menyediakan endpoint JSON yang kompatibel sebelum menerima alert dari data live. Mengisi URL halaman website GMGN saja tidak cukup.

Kategori `robinhood` adalah nama runner di kode. Kode tidak memverifikasi dukungan jaringan Robinhood di GMGN atau apakah token dapat diperdagangkan di Robinhood. Sumber data, mata uang fees, dan link GMGN kategori ini harus dipastikan oleh penyedia endpoint.

## Instalasi

Ikuti [panduan instalasi bot terpadu](docs/unified-bot.md). [Tutorial Discord](docs/installation.md) tetap memuat detail pembuatan aplikasi, endpoint dan tes fixture; startup sekarang memakai proses root terpadu.

Ringkasan setelah aplikasi Discord dan endpoint siap:

```bash
git clone https://github.com/bltzkrgg/bot-runner-token.git
cd bot-runner-token
npm ci
npm run setup
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

### Migrated Volume Spike

Mode spike tersedia untuk Solana, Robinhood, dan BSC, terpisah dari filter runner baru. Token lama tetap boleh lolos. Default: volume rolling 5m >= USD 100K dan >= 3x baseline rata-rata enam periode 5m sebelumnya yang tidak overlap; cooldown 15 menit, polling 15 detik, maksimum 5 alert per scan. Semua mode spike awalnya nonaktif.

```text
/setconfig key:solanaSpikeAlerts.enabled value:true
/setconfig key:robinhoodSpikeAlerts.enabled value:true
/setconfig key:bscSpikeAlerts.enabled value:true
```

Endpoint harus menyediakan bukti migrated dan riwayat volume bertimestamp. Bot tidak menganggap token yang baru muncul di daftar sebagai spike. [Kontrak data, config, dan tes spike](docs/volume-spike.md).

```text
Endpoint JSON -> polling per kategori -> normalisasi data -> filter runner
              -> cache duplikat -> antrean bersama -> Discord
```

Alert berisi harga, market cap, volume dan swaps 5 menit, fees, liquidity, flow buy/sell, top 10 holders, persentase wallet, status Dex Paid, CA, dan link GMGN.

- Polling default 60 detik; dapat diatur 15-300 detik per kategori. Ini polling, bukan streaming instan.
- Maksimum alert baru per scan default 5 per mode/kategori. Kandidat yang masih dalam cache tidak menghabiskan kuota. Kandidat mengikuti urutan endpoint; tidak otomatis diurutkan berdasarkan volume.
- Cache menahan alert berulang untuk kategori + CA yang sama selama 30 menit. Sesudahnya token dapat mendapat alert lagi jika masih lolos filter.
- Antrean bersama memberi jeda 1.5 detik setelah setiap pengiriman, menampung hingga 100 alert, dan melewatkan alert yang menunggu lebih dari 3 menit. Jika penuh, item tertua dibuang.
- Jalur webhook menunggu `retry_after` saat Discord membalas HTTP 429. Ini tidak menjamin bebas rate limit dari GMGN atau Discord.

## Batasan Saat Ini

- Endpoint dipanggil dengan GET dan header JSON; custom authorization header, pagination, dan WebSocket belum tersedia.
- Volume 5m, total fees, dan umur sejak DEX open/migration harus dihitung/disediakan sumber data. Bot tidak menghitungnya dari transaksi mentah.
- Data wajib untuk filter yang hilang membuat kandidat tidak lolos. Kolom informasi lain dapat tampil `N/A`; Dex Paid yang hilang saat ini ditampilkan sebagai `No`.
- Cache runner biasa dicatat sebelum alert terkirim. Kegagalan kirim dapat menahan alert runner sampai cache kedaluwarsa. Cache spike dicatat setelah berhasil kirim, dengan reservasi sementara agar alert dalam antrean tidak diduplikasi. Error pengiriman dicatat dan antrean melanjutkan item berikutnya; spike yang gagal dapat dicoba pada scan berikutnya jika masih lolos.
- `/setconfig` membutuhkan Manage Server permission di Discord atau ID Telegram pada admin allowlist. Kedua platform mengubah config yang sama.
- Pengujian otomatis mencakup config, filter runner, baseline spike, cooldown, format pesan, dan pemulihan antrean. Integrasi GMGN live serta pengiriman ke Discord sungguhan membutuhkan kredensial dan pengujian tersendiri.

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
| `data/spike-cache.json` | Cooldown spike persisten, dibuat setelah alert spike terkirim |

`.env` dan folder `data/` diabaikan Git. Simpan token Discord dan URL webhook sebagai rahasia.
