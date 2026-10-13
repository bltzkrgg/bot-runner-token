# Integrasi GMGN

Referensi resmi diperiksa pada 13 Oktober 2026:

- [GMGN Agent API](https://docs.gmgn.ai/index/gmgn-agent-api)
- [GMGNAI token reference](https://github.com/GMGNAI/gmgn-skills/blob/main/skills/gmgn-token/SKILL.md)

Dokumentasi menyebut API key untuk query dan dukungan IPv4. Modul ini tidak meminta private key. Kredensial nyata tidak tersedia untuk pengujian; tidak ada request data GMGN live atau scraping undocumented endpoint yang dilakukan.

| Route resmi yang didokumentasikan | Kebutuhan | Weight terdokumentasi |
| --- | --- | --- |
| `GET /v1/token/info` | token metadata, price, supply, holder count | 1 |
| `GET /v1/token/security` | concentration dan security exposure | 1 |
| `GET /v1/token/pool_info` | pool/liquidity | 1 |
| `GET /v1/market/token_top_holders` | daftar holders dan tags | 5 |
| `GET /v1/market/token_top_traders` | daftar traders | 5 |

Parameter query identitas chain Solana dan token address harus divalidasi terhadap OpenAPI/response asli sebelum implementasi; nama parameter CLI bukan otomatis nama query HTTP. Header auth, base URL, pagination, response wrapper, status code, dan schema masing-masing route belum diverifikasi. `GMGN_BASE_URL` dan `GMGN_API_KEY` hanya placeholder dan tidak digunakan adapter mock.

Reference menyebut leaky bucket Free 5/5, Plus 20/20, Pro 50/50 (rate/capacity), weighted route, reset header `X-RateLimit-Reset` serta kemungkinan body `reset_at`. Terapkan sesuai plan nyata saat live adapter dibuat, dengan timeout, bounded retries/backoff, shared request limiter, dan stop sampai reset pada ban. Jangan retry 429 tanpa memperhatikan reset.

Metadata price, liquidity, supply dan holders mempunyai satuan/schema berbeda; jangan langsung menyalin field. Reference token info menyebut harga nested dan market cap dihitung menggunakan circulating supply. Snapshot internal menggunakan USD, persentase 0-100, dan timestamp ISO UTC. Missing tetap null/undefined; bukan nol.

TODO live adapter: sampel respons resmi info/security/pool/holders/developer/smart money + exact unit/semantics; bukti kemampuan history developer dan outcome; pagination total coverage; auth headers dan rate-limit plan; respons token tidak ditemukan; aturan cache per endpoint. Tidak mengestimasi persentase keseluruhan dari subset top holders. Fitur yang tidak tersedia harus tetap `Data tidak tersedia`/`HISTORICAL_FIELD_UNAVAILABLE`.

Interface adapter sudah tersedia, fixture adalah **kontrak internal sintetis**, bukan contoh payload GMGN resmi. Mode `live` fail-fast sampai kontrak diverifikasi; konfigurasi token saja belum mengaktifkan live.

Adapter sekarang menerima `fetchToken(address, chain)` dengan chain `solana`, `bsc`, atau `robinhood`. CA EVM plain akan dicoba pada BSC dan Robinhood; adapter live wajib membedakan `TOKEN_NOT_FOUND` dari auth/rate-limit/network failure dan menyertakan chain respons yang benar. Field SOL net flow tidak dipakai untuk EVM. Live multi-chain tetap belum terhubung atau diuji; demo multi-chain bukan klaim coverage GMGN.
