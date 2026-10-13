# Kelayakan dan Batas Data

**Memungkinkan sebagai scanner informasi on-demand.** Kendala terbesar adalah akses source resmi serta benchmark historis point-in-time, bukan command Telegram. MVP fixture sudah dapat menerima address dan memproduksi laporan, tetapi belum siap untuk analisis token sungguhan.

1. Integrasi GMGN live memerlukan API key query dan schema resmi terverifikasi. Tidak ada private key atau transaksi.
2. Persentil membutuhkan ratusan comparator dengan field sebanding. Probabilitas terkalibrasi memerlukan lebih banyak data, distribusi kelas cukup, time split, calibration, evaluasi regime.
3. Bundler/insider/sniper/dev holding historis mungkin tidak bisa direkonstruksi. Tandai `HISTORICAL_FIELD_UNAVAILABLE`; mulai prospective snapshot setelah adapter dan collector siap.
4. Jangan membuat benchmark hanya dari token yang masih ramai. Record failed/dead dan missing data; label completeness dan coverage harus diaudit.
5. Rug-like bukan tuduhan scam. MVP tidak membuat label rug-like dari penurunan harga saja. Liquiditas collapse, volume, dev disposal, window, dan threshold perlu definisi tervalidasi.
6. Data demo secara sengaja sama untuk semua CA dengan watermark jelas; bukan intelligence mint yang diberikan. Live fail-fast sampai terhubung.
7. Cache memory tidak lintas proses dan hilang saat restart. Deploy satu process. Separate endpoint TTL baru aktif setelah split adapter; config holder/dev saat ini reserved.
8. Table schema dan transaction path typechecked; PostgreSQL sungguhan dan Telegram API belum diuji tanpa database/token di environment ini. Research labeling diuji; model tidak dilatih karena tidak ada dataset nyata cukup.

Tahap lanjutan: akses resmi + fixtures payload -> integration tests PostgreSQL/Telegram -> live query -> controlled collector rate-limited/resumable -> data maturity/coverage -> benchmark audit -> calibration. Collector runtime dan scheduler tidak ditambahkan supaya tidak memanggil GMGN otomatis tanpa data contract/rate limits terverifikasi.
