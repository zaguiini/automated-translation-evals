import { Langfuse } from "langfuse";
import type { PoEntry } from "./parsePo.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

export function buildPromptContent(entry: PoEntry): string {
  return `Given this context and comments, generate a Brazilian Portuguese translation for the English sentence.

## Context

${entry.msgctxt || 'No context'}

## Comments

${entry.comments || 'No comments'}

## English

${entry.msgid}

---

Brazilian Portuguese translation:`;
}

export async function uploadPrompts(entries: PoEntry[]): Promise<void> {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  console.log(`Uploading ${entries.length} prompts...`);

  for (const entry of entries) {
    const name = slugify(entry.msgid);
    if (!name) {
      console.warn(`Skipping entry with un-slugifiable msgid: "${entry.msgid}"`);
      continue;
    }

    await langfuse.createPrompt({
      name,
      prompt: buildPromptContent(entry),
      type: "text",
      labels: ["production"],
    });

    console.log(`  ✓ ${name}`);
  }

  await langfuse.flushAsync();
}
