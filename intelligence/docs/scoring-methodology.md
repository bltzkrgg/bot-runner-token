# Metodologi Scoring

Konfigurasi bobot/threshold ada di `src/config.ts`, bukan tersebar di formatter. Group distribution, smartMoney, liquidity, momentum berbobot sama 1; rata-rata percentile tersedia dalam group, lalu rata-rata weighted antar group. Minimal tiga group dibutuhkan. Bobot awal **heuristik, belum tervalidasi backtest**. Missing group tidak dianggap nilai nol.

Threshold setup: >=85 SANGAT MENARIK; >=70 CUKUP MENARIK; >=55 NETRAL; >=40 KURANG MENARIK; lainnya RISIKO TINGGI. Classification terakhir adalah istilah setup dari spesifikasi, bukan hasil risk assessment terpisah.

Profil risiko saat ini terbatas pada distribusi: complement rata-rata quality percentile minimal tiga metric distribution. >=85 SANGAT TINGGI; >=70 TINGGI; >=40 MENENGAH; lainnya RENDAH. Laporan secara eksplisit menyebut “Profil risiko distribusi”. Belum mencakup rug-neighbors/developer/liquidity sebagai composite risk. Smart wallet label/count tidak menjamin keuntungan.

Developer report memakai counts observed; rug-like rate baru ditampilkan jika minimal 10 labelled launches dan jumlah label <= total launches. Tidak menyebut developer scammer dan tidak membuat reputation score tanpa benchmark developer.

`setupScore` bukan `setupPercentile`. Kolom probability DB disediakan untuk tahap model, tetapi tidak diisi model estimate. Rates neighbors disimpan dalam analysis_json sebagai descriptive frequencies. Python logistic regression hanya baseline offline dengan time split/purge, minimum 1000/300 unique tokens dan kedua classes. Belum calibration/feature importance penuh; output model tidak dikirim ke Telegram.
