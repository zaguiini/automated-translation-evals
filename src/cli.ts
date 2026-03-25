import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { parsePo } from "./parsePo.js";
import { uploadPrompts } from "./uploadPrompts.js";
import { uploadDataset } from "./uploadDataset.js";

const program = new Command();

program
  .name("translation-evals")
  .description("Parse a .PO file and upload entries as Langfuse prompts")
  .argument("<file>", "Path to the .PO file")
  .action(async (file: string) => {
    const filePath = resolve(file);

    let buffer: Buffer;
    try {
      buffer = readFileSync(filePath);
    } catch {
      console.error(`Error: Could not read file "${filePath}"`);
      process.exit(1);
    }

    let entries;
    try {
      entries = parsePo(buffer).slice(0, 5);
    } catch (err) {
      console.error("Error: Failed to parse PO file:", err);
      process.exit(1);
    }

    if (entries.length === 0) {
      console.log("No entries found in the PO file.");
      process.exit(0);
    }

    try {
      // await uploadPrompts(entries);
      await uploadDataset(entries);
      console.log("Done.");
    } catch (err) {
      console.error("Error: Failed to upload:", err);
      process.exit(1);
    }
  });

program.parse();
