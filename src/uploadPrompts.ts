import { Langfuse } from "langfuse";
import type { PoMetadata } from "./parsePo.js";
import { resourceName } from "./language.js";

function buildPromptTemplate(language: string): string {
  return `Given this context and comments, generate a ${language} translation for the English sentence.

## Context

{{msgctxt}}

## Comments

{{comments}}

## English

{{msgid}}

---

${language} translation:`;
}

export async function uploadPrompt(metadata: PoMetadata): Promise<void> {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  const promptName = resourceName(metadata);

  console.log(`Uploading prompt "${promptName}" for ${metadata.language}...`);

  await langfuse.createPrompt({
    name: promptName,
    prompt: buildPromptTemplate(metadata.language),
    type: "text",
    labels: ["production"],
  });

  await langfuse.flushAsync();
  console.log(`  ✓ prompt "${promptName}" uploaded.`);
}
