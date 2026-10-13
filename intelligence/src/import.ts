import "dotenv/config";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { snapshotSchema, outcomesSchema } from "./types.js";
import { validateMint } from "./gmgn.js";
import { PostgresRepository } from "./database/repository.js";

const path = process.argv[2];
if (!path || !process.env.DATABASE_URL) throw new Error("Usage: DATABASE_URL=... npm run benchmark:import -- <dataset.jsonl>");
const rowSchema = z.object({ id: z.string(), snapshot: snapshotSchema, outcomes: outcomesSchema });
const rows = (await readFile(path, "utf8")).split("\n").filter((line) => line.trim()).map((line) => rowSchema.parse(JSON.parse(line)));
for (const row of rows) {
  if (!validateMint(row.snapshot.mintAddress) || row.snapshot.source !== "gmgn") throw new Error("Invalid mint or non-GMGN source");
  if (Date.parse(row.snapshot.snapshotAt) > Date.now() || Date.parse(row.outcomes.availableAt) > Date.now()) throw new Error("Future observation or outcome");
}
const repository = new PostgresRepository(process.env.DATABASE_URL);
try {
  for (const row of rows) await repository.importHistorical(row);
  console.log(JSON.stringify({ imported: rows.length }));
} finally { await repository.close(); }
