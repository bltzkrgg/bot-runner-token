# Runner Config Spec

This document records the Discord-editable config fields for the GMGN runner alerts.

## Solana Runner

Discord label: `Solana Runner`

Config namespace:

```text
tokenAlerts
```

Editable fields:

| Discord command key | Internal config key | Description | Suggested range/default |
| --- | --- | --- | --- |
| `tokenAlerts.enabled` | `tokenAlertsEnabled` | Aktifkan alert token baru dari GMGN | `true` / `false` |
| `tokenAlerts.pollIntervalSec` | `tokenAlertsPollIntervalSec` | Interval polling GMGN dalam detik | `15`-`300` |
| `tokenAlerts.minVolume5mUsd` | `tokenAlertsMinVolume5mUsd` | Minimum volume rolling 5 menit dalam USD | e.g. `100000` |
| `tokenAlerts.minMarketCapUsd` | `tokenAlertsMinMarketCapUsd` | Market cap harus lebih besar dari nilai ini dalam USD | e.g. `100000` |
| `tokenAlerts.minTotalFeesSol` | `tokenAlertsMinTotalFeesSol` | Minimum total fees GMGN dalam SOL | e.g. `10` |
| `tokenAlerts.maxAgeMin` | `tokenAlertsMaxAgeMin` | Umur maksimum sejak DEX open/migration dalam menit | e.g. `30` |
| `tokenAlerts.maxPerScan` | `tokenAlertsMaxPerScan` | Maksimum alert yang diproses per scan | e.g. `5` |

Example commands:

```text
/setconfig tokenAlerts.enabled true
/setconfig tokenAlerts.pollIntervalSec 60
/setconfig tokenAlerts.minVolume5mUsd 100000
/setconfig tokenAlerts.minMarketCapUsd 100000
/setconfig tokenAlerts.minTotalFeesSol 10
/setconfig tokenAlerts.maxAgeMin 30
/setconfig tokenAlerts.maxPerScan 5
```

Qualification fields shown in alert:

```text
VOL • MC • FEES • AGE
```

## Robinhood Runner

Discord label: `Robinhood Runner`

Config namespace:

```text
robinhoodAlerts
```

Editable fields:

| Discord command key | Internal config key | Description | Suggested range/default |
| --- | --- | --- | --- |
| `robinhoodAlerts.enabled` | `robinhoodAlertsEnabled` | Aktifkan runner token GMGN Robinhood Chain | `true` / `false` |
| `robinhoodAlerts.pollIntervalSec` | `robinhoodAlertsPollIntervalSec` | Interval polling GMGN Robinhood dalam detik | `15`-`300` |
| `robinhoodAlerts.minVolume5mUsd` | `robinhoodAlertsMinVolume5mUsd` | Minimum volume rolling 5 menit dalam USD | e.g. `100000` |
| `robinhoodAlerts.minTotalFeesEth` | `robinhoodAlertsMinTotalFeesEth` | Minimum total fees GMGN dalam ETH | e.g. `0.1` |
| `robinhoodAlerts.maxPerScan` | `robinhoodAlertsMaxPerScan` | Maksimum alert Robinhood per scan | e.g. `5` |

Example commands:

```text
/setconfig robinhoodAlerts.enabled true
/setconfig robinhoodAlerts.pollIntervalSec 60
/setconfig robinhoodAlerts.minVolume5mUsd 100000
/setconfig robinhoodAlerts.minTotalFeesEth 0.1
/setconfig robinhoodAlerts.maxPerScan 5
```

Qualification fields shown in alert:

```text
VOL • FEES
```

## BSC Runner

Discord label: `BSC Runner`

Config namespace:

```text
bscAlerts
```

Editable fields:

| Discord command key | Internal config key | Description | Suggested range/default |
| --- | --- | --- | --- |
| `bscAlerts.enabled` | `bscAlertsEnabled` | Aktifkan runner token GMGN BSC Chain | `true` / `false` |
| `bscAlerts.pollIntervalSec` | `bscAlertsPollIntervalSec` | Interval polling GMGN BSC dalam detik | `15`-`300` |
| `bscAlerts.minVolume5mUsd` | `bscAlertsMinVolume5mUsd` | Minimum volume rolling 5 menit dalam USD | e.g. `100000` |
| `bscAlerts.minMarketCapUsd` | `bscAlertsMinMarketCapUsd` | Market cap harus lebih besar dari nilai ini dalam USD | e.g. `100000` |
| `bscAlerts.minTotalFeesBnb` | `bscAlertsMinTotalFeesBnb` | Minimum total fees GMGN dalam BNB | e.g. `1` |
| `bscAlerts.maxAgeMin` | `bscAlertsMaxAgeMin` | Umur maksimum sejak DEX open/migration dalam menit | e.g. `30` |
| `bscAlerts.maxPerScan` | `bscAlertsMaxPerScan` | Maksimum alert BSC per scan | e.g. `5` |

Example commands:

```text
/setconfig bscAlerts.enabled true
/setconfig bscAlerts.pollIntervalSec 60
/setconfig bscAlerts.minVolume5mUsd 100000
/setconfig bscAlerts.minMarketCapUsd 100000
/setconfig bscAlerts.minTotalFeesBnb 1
/setconfig bscAlerts.maxAgeMin 30
/setconfig bscAlerts.maxPerScan 5
```

Qualification fields shown in alert:

```text
VOL • MC • FEES • AGE
```

## Validation Rules

- Poll interval must be clamped or rejected outside `15`-`300` seconds.
- Numeric thresholds must be non-negative numbers.
- `maxPerScan` must be a positive integer.
- Boolean fields accept `true` or `false`.
- Invalid config keys should return a Discord error message with the supported keys.

## Implementation Notes

- `/setconfig <key> <value>` should update persistent config storage.
- After config update, reply with the changed key, previous value, and new value.
- Runtime scanner should read current config before each polling cycle or subscribe to config changes.
- Solana Runner, Robinhood Runner, and BSC Runner should have independent polling loops and independent cooldown/deduplication.
