# Bot Terpadu Discord dan Telegram

Satu aplikasi, dua antarmuka. Runner, volume spike, scan CA, dan config tersedia pada kedua platform. Scanner otomatis hanya berjalan sekali per kategori/mode; laporan manual memakai satu service dan source cache bersama. Intelligence saat ini tetap **demo**, bukan data CA nyata. Penggabungan ini tidak menyelesaikan integrasi GMGN live.

```text
                 GMGN-compatible runner feeds
                            |
                runner / migrated spike scanner
                            |
                   satu antrean broadcast
                   /                  \
              Discord               Telegram
                   \                  /
                    /scan /quick /dev ...
                            |
                  shared intelligence service
                            |
                shared cache + PostgreSQL/memory
```

## Instalasi

Dari root repository, Node.js 20+:

```bash
npm ci
npm run setup
cp .env.example .env
```

`npm run setup` memasang dependencies engine intelligence; jangan melewatkannya. Satu `.env` root dipakai startup. Jangan menjalankan `npm start` dari `intelligence/` atau process Telegram lama bersamaan: command itu kini hanya tooling standalone/legacy dan tidak menjalankan runner bersama.

Isi `.env`:

| Variable | Fungsi |
| --- | --- |
| `DISCORD_TOKEN` | Token bot Discord; kosong jika platform itu tidak digunakan |
| `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` | Register slash commands pada server |
| `DISCORD_ALERT_CHANNEL_ID` atau `DISCORD_ALERT_WEBHOOK_URL` | Tujuan alert Discord |
| `DISCORD_SCAN_CHANNEL_IDS` | Channel IDs dipisah koma untuk scan CA sebagai pesan biasa |
| `TELEGRAM_BOT_TOKEN` | Token BotFather; kosong jika platform itu tidak digunakan |
| `TELEGRAM_ALERT_CHAT_ID` | ID chat/group/channel penerima alert otomatis |
| `TELEGRAM_ADMIN_USER_IDS` | Numeric user IDs yang boleh `/setconfig`, dipisah koma |
| `USER_HASH_SECRET` | Secret acak >=32 karakter untuk HMAC audit Telegram |
| `GMGN_MODE` | `mock`; live intelligence belum terverifikasi |
| `DATABASE_URL` | Opsional PostgreSQL untuk hasil intelligence; kosong memakai memory |
| `GMGN_*_URL`, `GMGN_*_SPIKE_URL` | Feed runner dan spike, tidak diganti oleh mode mock intelligence |

Isi dua token dan dua tujuan jika ingin kedua platform aktif. Minimal satu token platform dan satu tujuan alert dibutuhkan startup. Untuk chat Telegram pribadi, pengguna harus memulai chat dengan bot lebih dulu; untuk channel/group, berikan bot hak mengirim pesan. `TELEGRAM_ALERT_CHAT_ID` harus diketahui sebelum startup; bot tidak menebak tujuan atau melakukan broadcast ke semua pengguna scanner.

Untuk Discord plain-CA scan, isi allowlist channel dan aktifkan Message Content intent di Developer Portal. Jika tidak diisi, scan Discord menggunakan slash commands tanpa privileged intent. Pesan bot sendiri diabaikan sehingga alert CA tidak memicu scan ulang.

```bash
npm run register
npm start
```

Register Discord ulang wajib setelah update ini karena daftar slash commands bertambah. Untuk Telegram-only, lewati register. Jalankan satu proses saja. Semua scanner runner/spike tetap default nonaktif; aktifkan sesuai kebutuhan melalui command config.

## Fungsi di Kedua Platform

| Fungsi | Discord | Telegram |
| --- | --- | --- |
| Runner/spike otomatis | Channel/webhook yang ditentukan | Chat/group/channel yang ditentukan |
| Scan lengkap | `/scan ca:<CA>` | `/scan <CA>` |
| Ringkasan | `/quick ca:<CA>` | `/quick <CA>` |
| Developer / holders / smart / similar | Slash command dengan opsi `ca` | Command dengan CA setelah spasi |
| CA sebagai pesan biasa | Channel yang di-allowlist | Pesan ke bot |
| Lihat config | `/getconfig` | `/getconfig` |
| Ubah config | `/setconfig key:<key> value:<value>` | `/setconfig <key> <value>` |

Discord config writes membutuhkan Manage Server permission; Telegram hanya IDs pada admin allowlist. Mengubah config dari salah satu platform mengubah scanner yang sama. Penulisan diserialisasi dan config baru baru dipublikasi setelah file berhasil disimpan. Interval baru diterapkan saat scanner menjadwalkan siklus berikutnya.

Contoh Telegram:

```text
/setconfig tokenAlerts.enabled true
/setconfig solanaSpikeAlerts.enabled true
/quick So11111111111111111111111111111111111111112
```

Contoh Discord:

```text
/setconfig key:tokenAlerts.enabled value:true
/setconfig key:solanaSpikeAlerts.enabled value:true
/quick ca:So11111111111111111111111111111111111111112
```

Alert runner memakai data endpoint, sedangkan intelligence contoh di atas adalah fixture berlabel DEMO. Laporan dikirim ke tempat perintah diterima; tidak otomatis disebarkan ke platform lain. Alert otomatis dikirim ke semua tujuan yang diisi. Keduanya mempunyai fungsi yang sama tanpa harus pindah platform.

## Pengiriman dan Batasan

Broadcast mencoba setiap tujuan secara independen, dengan maksimal tiga percobaan dan backoff 1/2 detik. Tujuan yang berhasil tidak diulang dalam item yang sama. Kegagalan satu platform tidak menghalangi percobaan platform lain. Jika semua retry habis, error dicatat; tidak ada durable delivery queue.

Jika sebagian platform berhasil dan sebagian gagal permanen, spike yang lolos lagi pada scan berikutnya mungkin dikirim ulang ke platform yang sebelumnya berhasil. Dedupe belum per-destination dan tidak menjamin exactly-once. Runner biasa tetap mencatat cache sebelum kirim. Cooldown spike dicatat setelah semua tujuan terkirim. Antrean memory dan limit/TTL yang sudah ada tetap berlaku.

Telegram mengirim teks biasa (penanda bold Discord dibuang), Discord memakai formatting yang ada. Intelligence Discord dipecah menjadi pesan <=1900 karakter dan balasan slash command hanya terlihat pemanggil. Tidak ada automatic analysis untuk setiap runner; gunakan CA pada antarmuka yang dipilih.

## Verifikasi dan Deployment

```bash
npm test
npm run typecheck --prefix intelligence
npm test --prefix intelligence
```

Tes meliputi shared config, access control kedua platform, fanout dengan retry tanpa duplicate pada tujuan sukses, serta report chunking Discord. Tes memakai transport mock; akses Discord/Telegram sungguhan masih membutuhkan credentials.

Untuk VPS systemd dari tutorial lama, ubah ExecStart menjadi path Node absolut dengan `--import tsx`:

```ini
WorkingDirectory=/home/runner/bot-runner-token
ExecStart=/usr/bin/node --import tsx /home/runner/bot-runner-token/src/index.js
```

Atau PM2: dari root `pm2 start ecosystem.config.cjs`. Hentikan process Telegram legacy lebih dulu. Database push/import/research masih bisa dijalankan dari folder `intelligence/`; untuk perintah database gunakan env di folder tersebut atau export DATABASE_URL secara aman. Runtime root tidak membaca `intelligence/.env`.
