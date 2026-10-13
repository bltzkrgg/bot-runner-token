export function looksLikeContractAddress(text) {
  return /^(?:[1-9A-HJ-NP-Za-km-z]{32,44}|0x[0-9a-fA-F]{40})$/.test(text);
}
