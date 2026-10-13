import { createRuntime } from "./runtime.js";
const runtime = createRuntime();
try {
  const mint = process.argv[2];
  if (!mint) throw new Error("Usage: npm run scan -- <Solana mint>");
  console.log(await runtime.service.scan(mint));
} finally { await runtime.repository.close(); }
