export const DEFAULT_CONFIG = Object.freeze({
  tokenAlerts: {
    enabled: false,
    pollIntervalSec: 60,
    minVolume5mUsd: 100000,
    minMarketCapUsd: 100000,
    minTotalFeesSol: 10,
    maxAgeMin: 30,
    maxPerScan: 5
  },
  robinhoodAlerts: {
    enabled: false,
    pollIntervalSec: 60,
    minVolume5mUsd: 100000,
    minTotalFeesEth: 0.1,
    maxPerScan: 5
  },
  bscAlerts: {
    enabled: false,
    pollIntervalSec: 60,
    minVolume5mUsd: 100000,
    minMarketCapUsd: 100000,
    minTotalFeesBnb: 1,
    maxAgeMin: 30,
    maxPerScan: 5
  }
});

const FIELD_TYPES = Object.freeze({
  "tokenAlerts.enabled": "boolean",
  "tokenAlerts.pollIntervalSec": "pollInterval",
  "tokenAlerts.minVolume5mUsd": "number",
  "tokenAlerts.minMarketCapUsd": "number",
  "tokenAlerts.minTotalFeesSol": "number",
  "tokenAlerts.maxAgeMin": "number",
  "tokenAlerts.maxPerScan": "positiveInteger",
  "robinhoodAlerts.enabled": "boolean",
  "robinhoodAlerts.pollIntervalSec": "pollInterval",
  "robinhoodAlerts.minVolume5mUsd": "number",
  "robinhoodAlerts.minTotalFeesEth": "number",
  "robinhoodAlerts.maxPerScan": "positiveInteger",
  "bscAlerts.enabled": "boolean",
  "bscAlerts.pollIntervalSec": "pollInterval",
  "bscAlerts.minVolume5mUsd": "number",
  "bscAlerts.minMarketCapUsd": "number",
  "bscAlerts.minTotalFeesBnb": "number",
  "bscAlerts.maxAgeMin": "number",
  "bscAlerts.maxPerScan": "positiveInteger"
});

export function supportedConfigKeys() {
  return Object.keys(FIELD_TYPES);
}

export function mergeConfig(saved = {}) {
  return {
    tokenAlerts: { ...DEFAULT_CONFIG.tokenAlerts, ...saved.tokenAlerts },
    robinhoodAlerts: { ...DEFAULT_CONFIG.robinhoodAlerts, ...saved.robinhoodAlerts },
    bscAlerts: { ...DEFAULT_CONFIG.bscAlerts, ...saved.bscAlerts }
  };
}

export function getConfigValue(config, dottedKey) {
  const [section, field] = dottedKey.split(".");
  return config?.[section]?.[field];
}

export function setConfigValue(config, dottedKey, rawValue) {
  if (!FIELD_TYPES[dottedKey]) {
    throw new Error(`Unsupported config key: ${dottedKey}`);
  }

  const [section, field] = dottedKey.split(".");
  const nextValue = parseValue(rawValue, FIELD_TYPES[dottedKey], dottedKey);
  const previousValue = config[section][field];

  return {
    config: {
      ...config,
      [section]: {
        ...config[section],
        [field]: nextValue
      }
    },
    previousValue,
    nextValue
  };
}

function parseValue(rawValue, type, dottedKey) {
  if (type === "boolean") {
    if (rawValue === "true") return true;
    if (rawValue === "false") return false;
    throw new Error(`${dottedKey} must be true or false`);
  }

  const numberValue = Number(rawValue);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${dottedKey} must be a number`);
  }

  if (type === "number") {
    if (numberValue < 0) throw new Error(`${dottedKey} must be non-negative`);
    return numberValue;
  }

  if (type === "positiveInteger") {
    if (!Number.isInteger(numberValue) || numberValue <= 0) {
      throw new Error(`${dottedKey} must be a positive integer`);
    }
    return numberValue;
  }

  if (type === "pollInterval") {
    if (!Number.isInteger(numberValue) || numberValue < 15 || numberValue > 300) {
      throw new Error(`${dottedKey} must be an integer between 15 and 300`);
    }
    return numberValue;
  }

  throw new Error(`Unknown config value type: ${type}`);
}
