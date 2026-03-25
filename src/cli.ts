import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { parsePo } from "./parsePo.js";
import { uploadDataset } from "./uploadDataset.js";
import { runEval } from "./runEval.js";

const program = new Command();

program.name("translation-evals").description("AI translation evaluation tools");

program
  .command("upload")
  .description("Parse a .PO file and upload entries as Langfuse dataset")
  .argument("<file>", "Path to the .PO file")
  .action(async (file: string) => {
    const filePath = resolve(file);
    let buffer: Buffer;
    try {
      buffer = readFileSync(filePath);
    } catch (err) {
      console.error(`Error reading file: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }

    let entries;
    try {
      entries = parsePo(buffer);
    } catch (err) {
      console.error(`Error parsing .PO file: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }

    if (entries.length === 0) {
      console.error("No entries found in the .PO file.");
      process.exit(1);
    }

    try {
      await uploadDataset(entries);
      console.log("Done.");
    } catch (err) {
      console.error(`Error uploading dataset: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("eval")
  .description("Run AI translation eval against the Langfuse dataset")
  .requiredOption("--model <model>", "OpenAI model to use (e.g. gpt-4o, gpt-4o-mini)")
  .option("--limit <n>", "Max number of dataset items to evaluate", (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1) {
      console.error("Error: --limit must be a positive integer.");
      process.exit(1);
    }
    return n;
  }, 5)
  .action(async (options: { model: string; limit: number }) => {
    try {
      await runEval({ model: options.model, limit: options.limit });
    } catch (err) {
      console.error(`Error running eval: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
