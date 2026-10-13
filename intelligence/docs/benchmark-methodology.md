# Metodologi Benchmark

Input historis harus snapshot point-in-time. Data holder/developer sekarang tidak boleh digunakan untuk melengkapi snapshot masa lalu. Failed/dead/rug-like tokens juga harus masuk pengumpulan; dataset dari trending saja bias survivorship. Importer tidak dapat membuktikan provenance atau completeness; koleksi dan audit historis masih diperlukan.

Cohort exact: launchpad, status migrated, bucket umur, market cap, liquidity. Age boundaries menit: 5,15,30,60,180,360,1440; MC: 50K,100K,300K,1M,3M; liquidity: 10K,30K,100K,300K USD. Bucket missing hanya cocok missing. Jika <300 token, relax age, kemudian MC, kemudian liquidity; launchpad/migration tetap. Relaxations ditampilkan dalam laporan.

Hanya snapshot sebelum waktu target, source sama, CA berbeda. Satu snapshot terakhir per mint dipilih sehingga scan berulang tidak menambah bobot token. Snapshot dipilih sebelum cohort sehingga sebagian historical setups mungkin tidak tercakup; ini batas MVP, perlu evaluasi sampling strategi saat dataset ada.

Percentile = `(count worse + 0.5*count equal)/n * 100`, memperhatikan arah metric. Lower-better untuk konsentrasi/bundler/insider/sniper/dev holding; higher-better untuk holder, liquidity/MC, volume5m/MC, smart money. Volume/MC dan holder count hanya proxy aktivitas, bukan bukti growth atau acceleration. Sample per metric harus >=MIN_COHORT_SIZE (default 300). Missing tidak diisi nol.

Similarity memakai Euclidean distance standard-scaled (varian historical cohort, tidak target/outcome). Pilih fitur yang tersedia target dan >=80% cohort; hanya historical vectors lengkap dipakai. Minimal empat fitur beragam diperlukan. Limit default 100, maksimum 1000. Tidak ada similarity probability model atau deep learning.

Outcome rate dihitung dari neighbors berlabel boolean tersedia, denominator berbeda per outcome. Default minimum 100 observed labels. `availableAt` harus sudah lewat pada waktu target dan minimal 24h sesudah snapshot. Labels belum matang/future ditolak agar tidak ada look-ahead. Default requirement konservatif 24h juga diterapkan pada rate 6h.

Pipeline label harga sampled 1 menit mencatat first-hit ordering jika coverage lengkap. Jika data incomplete, hasil null. Definisi 2x-before-minus50 dan minus50-before-plus50 memakai horizon 6h. MFE/MAE relatif entry. Intrabar ordering tidak ditebak. Tidak ada rug/dead classification dari harga saja: liquidity collapse, volume death, dan atribusi dev tidak tersedia sehingga label tetap null. Harga sampled dapat melewatkan pergerakan di antara sampel.

Scoring atau frekuensi fixture tidak diterbitkan. Persentil composite setup terhadap distribusi composite historis belum diimplementasikan; laporan menyebut skor komposit, tidak mengklaim “11% teratas”.
