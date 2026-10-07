# Migrated Volume Spike

Mode ini mengirim alert untuk token yang sudah migrated dan mengalami lonjakan volume, termasuk token berumur beberapa hari. Mode terpisah tersedia untuk Solana, Robinhood, dan BSC. Market cap, fees, dan umur runner biasa tidak menjadi filter spike; kolom tersebut tetap ditampilkan bila tersedia.

## Aturan dan Config

Namespace Discord: `solanaSpikeAlerts`, `robinhoodSpikeAlerts`, `bscSpikeAlerts`. Setiap namespace mempunyai field yang sama:

| Field | Default | Validasi |
| --- | --- | --- |
| `enabled` | `false` | `true` / `false` |
| `pollIntervalSec` | `15` | Integer 15-300 |
| `minVolume5mUsd` | `100000` | Angka >= 0 |
| `minMultiplier` | `3` | Angka > 1 |
| `baselinePeriods` | `6` | Integer 1-24 |
| `cooldownMin` | `15` | Integer 1-1440 |
| `maxPerScan` | `5` | Integer > 0 |

```text
/setconfig key:solanaSpikeAlerts.minVolume5mUsd value:100000
/setconfig key:solanaSpikeAlerts.minMultiplier value:3
/setconfig key:solanaSpikeAlerts.baselinePeriods value:6
/setconfig key:solanaSpikeAlerts.cooldownMin value:15
/setconfig key:solanaSpikeAlerts.pollIntervalSec value:15
/setconfig key:solanaSpikeAlerts.maxPerScan value:5
/setconfig key:solanaSpikeAlerts.enabled value:true
```

Ganti prefix untuk BSC atau Robinhood. Semua key otomatis tersedia melalui autocomplete `/setconfig`; register command baru tidak diperlukan untuk perubahan ini. `/getconfig` menampilkan keenam bagian config. Config lama mendapat default spike saat dibaca.

Rumus: `multiplier = volume5mUsd / rata-rata baselinePeriods volumeUsd sebelumnya`. Semua periode baseline harus lengkap, berurutan, lima menit, dan tidak overlap dengan window sekarang. Baseline nol atau history yang kurang ditolak. Enam periode baseline ditambah window sekarang memerlukan setidaknya 35 menit riwayat sejak migration; token yang baru migrated belum akan lolos dengan default ini.

Cooldown spike disimpan pada `SPIKE_CACHE_PATH` (default `data/spike-cache.json`) setelah pengiriman sukses. Runner biasa memakai cache lain. Alert spike yang masih mengantre tidak diduplikasi. Item yang gagal, kedaluwarsa, atau dibuang saat antrean penuh melepas reservasi tanpa mencatat cooldown. Jika token masih spike setelah cooldown berakhir, alert dapat dikirim lagi.

## Kontrak Endpoint

Bot belum mempunyai koneksi langsung terautentikasi ke GMGN Agent API. Sediakan endpoint JSON kompatibel dari adapter/provider yang mempunyai akses data. Mode ini tidak mengambil candle tambahan sendiri atau membangun baseline dengan menganggap setiap sampel polling sebagai periode 5 menit.

Gunakan endpoint khusus `GMGN_SOLANA_SPIKE_URL`, `GMGN_ROBINHOOD_SPIKE_URL`, atau `GMGN_BSC_SPIKE_URL` untuk feed migrated/trending, termasuk token lama. Jika kosong, scanner memakai `GMGN_*_URL` kategori yang sama. URL fallback yang hanya berisi token baru tidak akan mencakup semua token lama. Scanner runner dan spike melakukan request sendiri; aktifkan hanya mode yang dibutuhkan dan sesuaikan interval dengan batas provider.

Tambahkan field berikut ke kontrak token pada [tutorial instalasi](installation.md#6-siapkan-endpoint-data):

| Field | Makna |
| --- | --- |
| `ca` | Alamat kontrak nonkosong; identitas alert |
| `migrated` | Boolean `true` jika migration sudah diverifikasi sumber; alternatif `migration_status: "completed"` |
| `migratedAtSec` | Unix seconds waktu migration/open market; alternatif `open_timestamp` |
| `volume5mUsd` | Volume USD pada interval `[T-300, T)` |
| `volumeWindowEndSec` | Integer Unix seconds `T`; maksimal 120 detik sebelum waktu scan dan tidak di masa depan |
| `volumeHistory5m` | Array periode lengkap dengan `startTimeSec`, `endTimeSec`, `volumeUsd` |

Untuk default enam periode, history harus mencakup `[T-600,T-300)`, `[T-900,T-600)`, sampai `[T-2100,T-1800)`. Urutan array bebas. Duplikasi timestamp, gap, durasi salah, volume negatif/hilang, atau periode sebelum migration membuat kandidat ditolak. Angka boleh berupa JSON number atau string numerik; timestamp harus detik, bukan milidetik. Current dan baseline harus memakai USD dan cakupan pool yang sama.

Jangan menjumlahkan rolling volume 5m yang disampling setiap 15 detik: window tersebut overlap. Adapter harus membentuk interval yang tepat dari candle atau transaksi; jika candle sejajar jam sedangkan window sekarang rolling, samakan batas waktunya sebelum mengirim kontrak ini. Periksa satuan field API asli secara nyata sebelum normalisasi.

Pada polling 15 detik, alert baru terdeteksi pada scan berikutnya, ditambah waktu request dan antrean Discord. Request endpoint timeout setelah 10 detik; error scanner dijadwalkan ulang setelah 60 detik. Ini bukan jaminan streaming instan atau cakupan seluruh jaringan.

## Tes Lokal

Gunakan channel percobaan; server di bawah mengirim **data buatan**, bukan informasi token sungguhan. Jalankan pada mesin yang sama dengan bot:

```bash
node --input-type=module -e '
import { createServer } from "node:http";
createServer((request, response) => {
  const now = Math.floor(Date.now() / 1000);
  const token = {
    ca: "SPIKE_TEST_ONLY_NOT_REAL",
    symbol: "TEST",
    name: "Local Spike Test",
    pool: "Fixture",
    migrated: true,
    migratedAtSec: now - 172800,
    volumeWindowEndSec: now,
    volume5mUsd: 120000,
    priceUsd: 0.000149513,
    marketCapUsd: 145000,
    liquidityUsd: 31500,
    feesAmount: 15.1,
    feesCurrency: "SOL",
    swaps5m: 1378,
    buyPercent: 60,
    sellPercent: 40,
    top10Percent: 24.9,
    wallets: [3.6, 3.2, 2.9, 2.7, 2.6],
    dexPaid: true,
    gmgnUrl: "https://gmgn.ai/",
    volumeHistory5m: Array.from({ length: 6 }, (_, index) => ({
      startTimeSec: now - (index + 2) * 300,
      endTimeSec: now - (index + 1) * 300,
      volumeUsd: 20000
    }))
  };
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ tokens: [token] }));
}).listen(8788, "127.0.0.1", () => console.log("Spike fixture: http://127.0.0.1:8788"));
'
```

1. Isi `GMGN_SOLANA_SPIKE_URL=http://127.0.0.1:8788` pada `.env`, lalu restart bot.
2. Aktifkan `solanaSpikeAlerts.enabled` dan gunakan default threshold/baseline.
3. Tunggu siklus polling. Alert berjudul `SOLANA VOLUME SPIKE` menampilkan `Migrated 2d ago`, baseline `$20K`, volume `$120K`, multiplier `6x` (simbol kali pada pesan), dan status `MIGRATED VOLUME SPIKE`.
4. Alert yang sama tidak dikirim ulang selama 15 menit. Mengubah CA fixture memungkinkan tes token lain tanpa menghapus cache.
5. Nonaktifkan mode, hentikan fixture dan bot, lalu ganti URL dengan feed live terverifikasi sebelum mengaktifkan lagi.

Informasi yang tidak tersedia tampil `N/A`; token yang tidak memiliki history cukup tidak dikirim sebagai spike. Fixture ini memverifikasi jalur deteksi dan pengiriman, bukan akurasi data GMGN live.
