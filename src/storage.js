import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mergeConfig } from "./config.js";

export async function loadJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function saveJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function loadConfig(filePath) {
  return mergeConfig(await loadJson(filePath, {}));
}

export async function saveConfig(filePath, config) {
  await saveJson(filePath, config);
}
