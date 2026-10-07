# Tutorial Instalasi

Panduan ini membawa kamu dari komputer kosong sampai tes alert masuk Discord, lalu menyiapkan penggunaan endpoint live dan layanan VPS. Semua perintah terminal dijalankan di folder repository kecuali disebutkan lain.

**Prasyarat data live:** repository belum berisi endpoint GMGN live yang terverifikasi. Bot bisa diuji dengan fixture lokal pada langkah 8, tetapi untuk memantau runner sungguhan kamu tetap perlu sumber JSON kompatibel yang menyediakan data GMGN.

## 1. Siapkan Perangkat

Instal Git dari [git-scm.com](https://git-scm.com/downloads) dan Node.js versi LTS yang masih didukung dari [nodejs.org](https://nodejs.org/en/download). Dependency yang terkunci saat ini menyatakan minimum Node.js 18; gunakan LTS yang didukung untuk instalasi baru.

Pastikan perintah berikut tersedia:

```bash
git --version
node --version
npm --version
```

Siapkan server Discord yang kamu kelola, channel teks untuk alert, dan akses internet dari mesin bot ke Discord serta endpoint data. Komputer harus tetap menyala agar bot terus memantau.

## 2. Buat Aplikasi Discord

1. Buka [Discord Developer Portal](https://discord.com/developers/applications), login, lalu pilih **New Application**.
2. Beri nama, misalnya `GMGN Runner`.
3. Di **General Information**, catat **Application ID** untuk `DISCORD_CLIENT_ID`.
4. Di halaman **Bot**, buat atau reset token bila diperlukan. Masukkan token ke `DISCORD_TOKEN`; token berbeda dari Application ID dan Public Key.
5. Gunakan instalasi ke server (**Guild Install**) dengan scopes `bot` dan `applications.commands`.
6. Berikan izin **View Channels** dan **Send Messages**. Alert dikirim sebagai teks biasa; Administrator tidak diperlukan.
7. Buka install link dan tambahkan bot ke server tujuan.

Pengaturan instalasi juga bisa menggunakan **OAuth2 > URL Generator** dengan scopes yang sama. Rujukan: [panduan resmi Discord](https://github.com/discord/discord-api-docs/blob/main/developers/quick-start/getting-started.mdx) dan [application commands](https://docs.discord.com/developers/docs/interactions/slash-commands).

Kode hanya menggunakan intent `Guilds`. Message Content, Server Members, dan Presence privileged intents tidak dibutuhkan. Tidak perlu mengisi Interactions Endpoint URL: bot menerima interaksi melalui Gateway.

Di Discord, buka **Server Settings > Integrations**, pilih aplikasi bot, lalu batasi akses `/setconfig` untuk admin atau role pengelola. Handler bot saat ini tidak memeriksa role pemanggil; pembatasan ini dilakukan di Discord.

## 3. Ambil ID Server dan Channel

Aktifkan **Developer Mode** di pengaturan Discord (**User Settings > Advanced**).

1. Klik kanan server tujuan dan pilih **Copy Server ID**. Nilainya untuk `DISCORD_GUILD_ID`.
2. Klik kanan channel alert dan pilih **Copy Channel ID**. Nilainya untuk `DISCORD_ALERT_CHANNEL_ID`.
3. Periksa permission channel: bot harus dapat melihat channel dan mengirim pesan. Untuk panduan ini gunakan channel teks biasa.

Gunakan ID numerik, bukan nama server atau channel.

## 4. Unduh Repository dan Dependency

```bash
git clone https://github.com/bltzkrgg/bot-runner-token.git
cd bot-runner-token
npm ci
```

Di macOS/Linux, buat file environment:

```bash
cp .env.example .env
```

Di Windows PowerShell, gunakan:

```powershell
Copy-Item .env.example .env
```

Buka `.env` dengan editor. Jangan commit token atau webhook ke GitHub.

## 5. Isi Environment

Contoh berikut berisi placeholder; ganti dengan nilaimu sendiri:

```dotenv
DISCORD_TOKEN=TOKEN_BOT_DISCORD
DISCORD_CLIENT_ID=APPLICATION_ID
DISCORD_GUILD_ID=SERVER_ID
DISCORD_ALERT_CHANNEL_ID=CHANNEL_ID
DISCORD_ALERT_WEBHOOK_URL=

GMGN_SOLANA_URL=
GMGN_ROBINHOOD_URL=
GMGN_BSC_URL=

CONFIG_PATH=data/config.json
ALERT_CACHE_PATH=data/alert-cache.json
```

| Variable | Kebutuhan |
| --- | --- |
| `DISCORD_TOKEN` | Wajib untuk login bot dan register commands |
| `DISCORD_CLIENT_ID` | Wajib untuk register commands; isi Application ID |
| `DISCORD_GUILD_ID` | Wajib untuk register commands ke server tujuan |
| `DISCORD_ALERT_CHANNEL_ID` | Tujuan alert jika tidak memakai webhook |
| `DISCORD_ALERT_WEBHOOK_URL` | Opsional; jika terisi, alert menggunakan webhook dan mengabaikan Channel ID |
| `GMGN_SOLANA_URL` | Endpoint JSON kandidat Solana; kosong berarti tidak ada kandidat Solana |
| `GMGN_ROBINHOOD_URL` | Endpoint JSON kategori Robinhood; kosong berarti tidak ada kandidat kategori ini |
| `GMGN_BSC_URL` | Endpoint JSON kandidat BSC; kosong berarti tidak ada kandidat BSC |
| `CONFIG_PATH` | Lokasi penyimpanan config; folder dibuat otomatis saat menyimpan |
| `ALERT_CACHE_PATH` | Lokasi penyimpanan cache alert |

Jika ingin webhook, buka pengaturan channel **Integrations > Webhooks**, buat webhook, lalu masukkan URL-nya. Token bot tetap diperlukan untuk slash commands. Untuk setup pertama, cukup gunakan Channel ID dan kosongkan webhook.

Setelah `.env` berubah, restart proses bot. Config slash commands dibaca pada siklus polling berikutnya tanpa restart; perubahan interval tidak langsung mengganti timer yang sudah terjadwal.

## 6. Siapkan Endpoint Data

Setiap URL harus mengembalikan JSON saat dipanggil dengan GET. Bot menerima array langsung, atau array pada `tokens`, `items`, `list`, `data`, `data.tokens`, `data.items`, atau `data.list`.

Untuk mode **Migrated Volume Spike**, endpoint harus menambahkan status migrated, waktu migration, dan riwayat volume. Lihat [panduan volume spike](volume-spike.md). URL opsional `GMGN_SOLANA_SPIKE_URL`, `GMGN_ROBINHOOD_SPIKE_URL`, dan `GMGN_BSC_SPIKE_URL` dapat memisahkan feed token lama/trending dari feed runner baru; jika kosong, masing-masing memakai URL kategori biasa. `SPIKE_CACHE_PATH` default `data/spike-cache.json` menyimpan cooldown spike.

Kontrak data yang disarankan untuk satu kandidat Solana:

```json
{
  "tokens": [
    {
      "ca": "CONTRACT_ADDRESS_ASLI",
      "chain": "sol",
      "symbol": "MASHUP",
      "name": "Mashup Games",
      "pool": "PumpSwap",
      "ageMinutes": 6,
      "priceUsd": 0.000149513,
      "marketCapUsd": 145000,
      "volume5mUsd": 104700,
      "swaps5m": 1378,
      "feesAmount": 15.1,
      "feesCurrency": "SOL",
      "liquidityUsd": 31500,
      "buyPercent": 60,
      "sellPercent": 40,
      "top10Percent": 24.9,
      "wallets": [3.6, 3.2, 2.9, 2.7, 2.6],
      "dexPaid": true,
      "gmgnUrl": "https://gmgn.ai/sol/token/CONTRACT_ADDRESS_ASLI"
    }
  ]
}
```

- `volume5mUsd` harus merupakan volume rolling lima menit dalam USD.
- `feesAmount` harus total fees, dalam SOL untuk Solana, ETH untuk kategori Robinhood, atau BNB untuk BSC. Bot membandingkan angka tanpa konversi mata uang.
- `ageMinutes` harus umur sejak DEX open/migration dalam menit. Bot tidak menghitung umur dari timestamp.
- Field persentase menggunakan skala 0-100; `60` berarti 60%, bukan `0.6`.
- `dexPaid` sebaiknya boolean JSON `true`/`false`, bukan string. String `"false"` akan dianggap truthy oleh normalisasi saat ini.
- Gunakan CA asli dan `gmgnUrl` asli. URL fallback kategori Robinhood belum diverifikasi.
- Solana dan BSC membutuhkan volume, fees, market cap, dan age untuk filter. Robinhood membutuhkan volume dan fees. CA harus disediakan agar identitas dan deduplikasi benar.

Adapter menerima sejumlah alias field, tetapi kontrak di atas menghindari ambiguitas satuan. Jangan memakai fees 5m sebagai pengganti total fees walaupun alias `fees_5m` dikenali kode. Jika sumber memerlukan header API key, pagination, atau konversi timestamp, sediakan adapter/proxy yang mengembalikan kontrak ini; client sekarang belum menangani kebutuhan tersebut.

Isi hanya URL kategori yang ingin digunakan. Pastikan response bukan HTML/login page. Jangan aktifkan kategori yang belum memiliki sumber data valid.

## 7. Atur Config di Discord

Jalankan pemeriksaan dan register slash commands:

```bash
npm test
npm run register
npm start
```

Output yang diharapkan:

```text
Registered Discord slash commands.
Discord bot logged in as <nama-bot>
```

Register dilakukan pada aplikasi/server yang tercantum di `.env`. Perintah ini mengganti seluruh daftar guild commands aplikasi tersebut dengan `/setconfig` dan `/getconfig`. Ulangi register jika daftar command atau server tujuan berubah; tidak perlu setiap restart.

Buka Discord lalu jalankan `/getconfig`. Respons config hanya terlihat oleh pemanggil. Semua kategori awalnya `enabled: false`.

| Key | Default | Nilai valid |
| --- | --- | --- |
| `tokenAlerts.enabled` | `false` | `true` / `false` |
| `tokenAlerts.pollIntervalSec` | `60` | Integer 15-300 detik |
| `tokenAlerts.minVolume5mUsd` | `100000` | Angka >= 0, USD |
| `tokenAlerts.minMarketCapUsd` | `100000` | Angka >= 0, USD |
| `tokenAlerts.minTotalFeesSol` | `10` | Angka >= 0, SOL |
| `tokenAlerts.maxAgeMin` | `30` | Angka >= 0, menit |
| `tokenAlerts.maxPerScan` | `5` | Integer > 0 |
| `robinhoodAlerts.enabled` | `false` | `true` / `false` |
| `robinhoodAlerts.pollIntervalSec` | `60` | Integer 15-300 detik |
| `robinhoodAlerts.minVolume5mUsd` | `100000` | Angka >= 0, USD |
| `robinhoodAlerts.minTotalFeesEth` | `0.1` | Angka >= 0, ETH |
| `robinhoodAlerts.maxPerScan` | `5` | Integer > 0 |
| `bscAlerts.enabled` | `false` | `true` / `false` |
| `bscAlerts.pollIntervalSec` | `60` | Integer 15-300 detik |
| `bscAlerts.minVolume5mUsd` | `100000` | Angka >= 0, USD |
| `bscAlerts.minMarketCapUsd` | `100000` | Angka >= 0, USD |
| `bscAlerts.minTotalFeesBnb` | `1` | Angka >= 0, BNB |
| `bscAlerts.maxAgeMin` | `30` | Angka >= 0, menit |
| `bscAlerts.maxPerScan` | `5` | Integer > 0 |

Contoh pengaturan Solana, pilih opsi `key` dan `value` di slash command:

```text
/setconfig key:tokenAlerts.pollIntervalSec value:60
/setconfig key:tokenAlerts.minVolume5mUsd value:100000
/setconfig key:tokenAlerts.minMarketCapUsd value:100000
/setconfig key:tokenAlerts.minTotalFeesSol value:10
/setconfig key:tokenAlerts.maxAgeMin value:30
/setconfig key:tokenAlerts.maxPerScan value:5
/setconfig key:tokenAlerts.enabled value:true
```

Contoh Robinhood:

```text
/setconfig key:robinhoodAlerts.pollIntervalSec value:60
/setconfig key:robinhoodAlerts.minVolume5mUsd value:100000
/setconfig key:robinhoodAlerts.minTotalFeesEth value:0.1
/setconfig key:robinhoodAlerts.maxPerScan value:5
/setconfig key:robinhoodAlerts.enabled value:true
```

Contoh BSC:

```text
/setconfig key:bscAlerts.pollIntervalSec value:60
/setconfig key:bscAlerts.minVolume5mUsd value:100000
/setconfig key:bscAlerts.minMarketCapUsd value:100000
/setconfig key:bscAlerts.minTotalFeesBnb value:1
/setconfig key:bscAlerts.maxAgeMin value:30
/setconfig key:bscAlerts.maxPerScan value:5
/setconfig key:bscAlerts.enabled value:true
```

Gunakan angka polos seperti `100000` atau `0.1`, bukan `$100K` atau angka dengan pemisah ribuan. Nonaktifkan kategori dengan key `enabled` bernilai `false`.

## 8. Tes Sampai Alert Masuk

Tes ini menggunakan **data buatan**, bukan token live. Lakukan di channel percobaan. Jalankan server fixture berikut di terminal kedua; command yang sama dapat digunakan di PowerShell:

```bash
node --input-type=module -e '
import { createServer } from "node:http";
const token = {
  ca: "TEST_ONLY_NOT_A_REAL_TOKEN",
  symbol: "TEST",
  name: "Local Notification Test",
  pool: "Fixture",
  ageMinutes: 6,
  priceUsd: 0.000149513,
  marketCapUsd: 145000,
  volume5mUsd: 104700,
  swaps5m: 1378,
  feesAmount: 15.1,
  feesCurrency: "SOL",
  liquidityUsd: 31500,
  buyPercent: 60,
  sellPercent: 40,
  top10Percent: 24.9,
  wallets: [3.6, 3.2, 2.9, 2.7, 2.6],
  dexPaid: true,
  gmgnUrl: "https://gmgn.ai/"
};
createServer((request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ tokens: [token] }));
}).listen(8787, "127.0.0.1", () => console.log("Fixture: http://127.0.0.1:8787"));
'
```

1. Hentikan bot dengan `Ctrl+C` jika sedang berjalan, lalu isi `GMGN_SOLANA_URL=http://127.0.0.1:8787` di `.env`.
2. Jalankan `npm start` kembali, gunakan threshold default Solana, dan aktifkan `tokenAlerts.enabled` dari Discord.
3. Tunggu satu siklus polling (default 60 detik). Alert `SOLANA TOKEN RUNNER` untuk simbol `TEST` seharusnya masuk channel tujuan.
4. Periksa harga, volume, fees, CA buatan, dan label qualified. Ini menguji parsing JSON, filter, format, serta pengiriman Discord bersama-sama.
5. Token percobaan yang sama tidak akan mengirim ulang selama 30 menit. Untuk tes ulang tanpa menghapus cache, ubah CA fixture menjadi ID percobaan lain lalu restart fixture.
6. Nonaktifkan `tokenAlerts.enabled`, hentikan bot dan fixture, lalu ganti URL lokal dengan endpoint live yang benar. Restart bot dan aktifkan kembali kategori yang sudah siap.

Fixture harus berjalan di mesin yang sama dengan bot karena menggunakan `127.0.0.1`. Jika port 8787 terpakai, pilih port lain pada command dan `.env`.

## 9. Gunakan Data Live

Setelah endpoint live tersedia, pastikan sampel respons memenuhi kontrak langkah 6 dan berasal dari jaringan/kategori yang dimaksud. Bandingkan volume rolling 5m, mata uang total fees, umur migration, CA, dan link dengan data sumber sebelum mengaktifkan alert.

Bot online tidak membuktikan koneksi GMGN valid. URL kosong menghasilkan daftar kandidat kosong, dan format response yang tidak dikenali juga bisa menghasilkan nol kandidat tanpa error.

Polling runner berjalan terpisah untuk tiga kategori. Pada interval 60 detik, tiap kategori melakukan kira-kira satu request per menit ditambah waktu request; semua runner aktif berarti sekitar tiga request per menit. Scanner spike mempunyai loop terpisah: default 15 detik, sekitar empat request per menit per kategori. Semua enam mode aktif dengan default berarti sekitar 15 request per menit. Jumlah kandidat bersamaan tidak menambah request detail karena kode memproses respons daftar yang sama. Batas provider tetap harus diperiksa.

Jika endpoint membalas error, scanner mencatat `[kategori] scan failed` dan menjadwalkan percobaan berikutnya 60 detik kemudian. Antrean Discord hanya mengatur pengiriman alert, bukan rate limit endpoint. Tidak ada streaming, pagination, atau jaminan semua kandidat akan terambil dari sumber.

## 10. Jalankan Terus di VPS Linux

Gunakan VPS dengan Node.js LTS, Git, dan systemd. Contoh memakai akun Linux non-root `runner` yang sudah dibuat dan repository di `/home/runner/bot-runner-token`. Jika akun/lokasi berbeda, sesuaikan semua path.

Login sebagai akun tersebut, clone repo, jalankan `npm ci`, isi `.env`, lalu lakukan register dan tes langkah sebelumnya. Jalankan:

```bash
command -v node
```

Catat path absolut Node.js. Buat unit melalui editor:

```bash
sudo nano /etc/systemd/system/gmgn-runner.service
```

Isi contoh berikut; ganti `/usr/bin/node` dengan hasil `command -v node` bila berbeda:

```ini
[Unit]
Description=GMGN Runner Discord Bot
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=runner
WorkingDirectory=/home/runner/bot-runner-token
ExecStart=/usr/bin/node /home/runner/bot-runner-token/src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

`dotenv` membaca `.env` dari WorkingDirectory. Akun `runner` harus bisa membaca `.env` dan menulis folder `data/`. Jika Node berasal dari version manager, pastikan ExecStart menunjuk binary absolut yang dapat digunakan akun tersebut.

Hentikan proses `npm start` manual agar hanya ada satu instance, kemudian:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gmgn-runner
sudo systemctl status gmgn-runner
sudo journalctl -u gmgn-runner -f
```

`Ctrl+C` pada journalctl hanya menghentikan tampilan log. Bot tetap berjalan. Untuk menghentikan layanan:

```bash
sudo systemctl stop gmgn-runner
```

Antrean hanya ada di memori dan tidak bertahan saat restart. Config dan cache ada di folder `data/`; cadangkan folder tersebut untuk mempertahankan pengaturan dan deduplikasi. Jalankan satu instance per folder data untuk menghindari alert ganda dan penulisan file bersamaan.

## 11. Update Bot

Untuk instalasi VPS systemd, dari folder repo:

```bash
sudo systemctl stop gmgn-runner
git pull --ff-only origin main
npm ci
npm test
sudo systemctl start gmgn-runner
sudo systemctl status gmgn-runner
```

Jika pull, instalasi, atau tes gagal, periksa error sebelum menjalankan layanan lagi. Jalankan `npm run register` bila definisi command berubah. `.env` dan `data/` tidak dilacak Git, sehingga tetap tersimpan saat update biasa. Untuk penggunaan lokal, hentikan bot, lakukan pull/install/test yang sama, lalu `npm start`.

## Troubleshooting

| Gejala | Yang perlu diperiksa |
| --- | --- |
| `node` atau `npm` tidak ditemukan | Instal Node.js dan buka terminal baru |
| `Missing DISCORD_TOKEN` | File `.env` berada di folder repo dan token sudah diisi |
| Login gagal / invalid token | Gunakan Bot Token, bukan Public Key atau Application ID; reset token jika perlu |
| Register gagal 401/403 | Token, Application ID, Server ID, dan bot sudah terpasang di server yang benar |
| `/setconfig` tidak muncul | Register ulang, periksa scopes dan akses Integrations, lalu buka ulang Discord |
| `Config error` | Key harus sesuai tabel; boolean lowercase; interval integer 15-300 |
| Bot online tetapi tidak ada alert | Runner enabled, endpoint terisi, JSON sesuai kontrak, kandidat lolos seluruh filter, dan tidak tertahan cache |
| `GMGN ... request failed: 403` | Sumber menolak request; periksa akses resmi endpoint dan kebutuhan adapter autentikasi |
| `GMGN ... request failed: 429` | Kurangi frekuensi polling sesuai batas sumber; scanner saat ini mencoba ulang setelah 60 detik |
| JSON parse error | URL kemungkinan mengembalikan HTML, login page, atau JSON rusak |
| Alert menampilkan `N/A` | Field informasi tidak tersedia atau satuan/schema belum dinormalisasi |
| Alert tidak masuk / send error | Permission channel, Channel ID atau webhook, dan log proses; cache bisa sudah terisi sebelum kirim gagal |
| `Discord alert failed` | Periksa akses channel/webhook dan koneksi; antrean melanjutkan item berikutnya. Spike gagal bisa dicoba ulang saat scan berikutnya, runner biasa masih dapat tertahan cache |
| Alert duplikat | Lebih dari satu instance, cache tidak persisten, atau TTL 30 menit sudah berakhir |
| Config gagal disimpan | Akun proses mempunyai izin menulis folder `data/` dan disk tidak penuh |

Instalasi selesai jika `/getconfig` merespons dan alert fixture masuk channel. Pemantauan live siap setelah endpoint nyata diverifikasi dan kategori yang sesuai diaktifkan.
