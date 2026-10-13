# Arsitektur

Telegram/CLI -> validasi mint -> SourceCache -> GmgnAdapter -> Zod Snapshot -> Repository -> cohort/similarity -> analysis -> report Indonesia -> pengguna. Scan berhenti setelah report. Tidak ada scheduler token atau order execution.

Folder `intelligence/` mempunyai package/dependency sendiri. Npm lockfile dipakai mengikuti repo induk; tidak memigrasikan project Discord ke pnpm. Modular satu proses dipilih daripada monorepo dengan banyak packages yang belum diperlukan.

`src/gmgn.ts`: adapter dan cache. `src/types.ts`: kontrak data. `src/database/`: tabel Drizzle serta transaksi. `src/benchmark.ts`: cohort dan statistik. `src/service.ts`: orchestration dan structured logs. `src/report.ts`: seluruh formatter, developer summary. `src/telegram.ts`: input on-demand. `research/`: pipeline offline.

Cache memory dibatasi 1000 CA; concurrent scan CA yang sama menunggu request tunggal. TTL sumber 120 detik. Holder 180 detik dan developer 6 jam tersedia sebagai konfigurasi rencana, tetapi belum dipakai karena adapter mock mengembalikan satu snapshot gabungan. Jangan mengklaim separate cache sudah aktif. Repository PostgreSQL menyimpan token, snapshots, requests, results dalam transaksi; developer snapshot disimpan bila ada data. Scan dari cache menyimpan request baru tetapi tidak menggandakan snapshot sumber identik.

Schema mencakup developers, developer_tokens, smart_wallet_snapshots, token_outcomes. Tabel wallet dan relasi histori developer belum mempunyai collector. API HTTP, Redis, collector terus-menerus tidak diperlukan untuk fixture MVP ini.

Log: scan_id, mint_address, cache_hit, gmgn_requests, gmgn_latency_ms, analysis_latency_ms, cohort_size, similarity_sample_size, error_category. Error log tidak mencetak credential/payload/username. Database benchmark load saat ini membaca history yang cocok source dan waktu ke memory; perlu index/pagination dan batas query sebelum skala jutaan snapshot.
