# Deployment Ubuntu 24.04

Gunakan Node.js LTS yang didukung (minimal 20), Python 3.11+ untuk riset offline, PostgreSQL, akun Linux non-root. Contoh repo berada di `/home/runner/bot-runner-token`; sesuaikan path.

```bash
cd /home/runner/bot-runner-token/intelligence
npm ci
cp .env.example .env
```

Isi Telegram token, HMAC secret >=32 karakter, `DATABASE_URL`, dan `GMGN_MODE=mock`. Create database/role PostgreSQL dengan hak minimum untuk schema aplikasi, kemudian jalankan `npm run db:push`, `npm run typecheck`, `npm test`, dan smoke test CLI. Ini deployment demo, bukan production market data.

PM2 dapat diinstal menurut dokumentasi [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/). Jangan menjalankan `npm start` manual bersamaan dengan PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 logs sol-intel-telegram
pm2 save
pm2 startup
```

Ikuti command startup yang dicetak PM2 sesuai akun deployment. Tidak ada process API atau historical collector. Bot Telegram hanya menerima input dan memanggil adapter saat scan; bot Discord root, jika dipakai, mempunyai proses/config sendiri.

Setelah update: `npm ci`, `npm run typecheck`, `npm test`, review schema changes sebelum `npm run db:push`, lalu `pm2 restart sol-intel-telegram`. Cadangkan database dan simpan `.env` terpisah. Jangan menyimpan user metadata lain selain HMAC pseudonymous ID yang diperlukan audit. Definisikan retention scan_requests dan raw source sebelum membuka akses publik.
