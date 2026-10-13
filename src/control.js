import { setConfigValue } from "./config.js";

export function createConfigController(initial, persist) {
  let current = initial;
  let writes = Promise.resolve();
  return {
    get: () => current,
    update(key, value) {
      const operation = writes.then(async () => {
        const result = setConfigValue(current, key, value);
        await persist(result.config);
        current = result.config;
        return result;
      });
      writes = operation.catch(() => {});
      return operation;
    }
  };
}
