import "dotenv/config";
import "./proxy.js";
import "./instrumentation.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { parsePo } from "./parsePo.js";
import { uploadDataset } from "./uploadDataset.js";
import { uploadPrompt } from "./uploadPrompt.js";
import { runEval } from "./runEval.js";

const program = new Command();

program.name("translation-evals").description("AI translation evaluation tools");

function readAndParsePo(file: string) {
  const filePath = resolve(file);
  let buffer: Buffer;
  try {
    buffer = readFileSync(filePath);
  } catch (err) {
    console.error(`Error reading file: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  try {
    const result = parsePo(buffer);
    console.log(`Detected language: ${result.metadata.language}`);
    console.log(`Project: ${result.metadata.projectId}`);
    console.log(`Revision date: ${result.metadata.revisionDate}`);
    return result;
  } catch (err) {
    console.error(`Error parsing .PO file: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

const limitOption = (v: string) => {
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 1) {
    console.error("Error: --limit must be a positive integer.");
    process.exit(1);
  }
  return n;
};

program
  .command("upload-dataset")
  .description("Parse a .PO file and upload entries as Langfuse dataset")
  .argument("<file>", "Path to the .PO file")
  .option("--limit <n>", "Max number of entries to upload", limitOption)
  .action(async (file: string, options: { limit?: number }) => {
    const { metadata, entries } = readAndParsePo(file);

    if (entries.length === 0) {
      console.error("No entries found in the .PO file.");
      process.exit(1);
    }

    try {
      await uploadDataset(entries, metadata, options.limit);
      console.log("Done.");
    } catch (err) {
      console.error(`Error uploading dataset: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("upload-prompt")
  .description("Upload the translation prompt template to Langfuse")
  .action(async () => {
    try {
      await uploadPrompt();
      console.log("Done.");
    } catch (err) {
      console.error(`Error uploading prompt: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("eval")
  .description("Run AI translation eval against the Langfuse dataset")
  .argument("<file>", "Path to the .PO file (used to detect target language)")
  .requiredOption("--model <model>", "OpenAI model to use (e.g. gpt-4o, gpt-4o-mini)")
  .option("--limit <n>", "Max number of dataset items to evaluate", limitOption)
  .action(async (file: string, options: { model: string; limit?: number }) => {
    const { metadata } = readAndParsePo(file);

    try {
      await runEval({ model: options.model, limit: options.limit, metadata });
    } catch (err) {
      console.error(`Error running eval: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
