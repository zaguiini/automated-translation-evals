import { LangfuseClient } from "@langfuse/client";

export const PROMPT_NAME = "translation-prompt";

const PROMPT_TEMPLATE = `Given this context and comments, generate a {{language}} translation for the English sentence.

## Context

{{msgctxt}}

## Comments

{{comments}}

## English

{{msgid}}

---

{{language}} translation:`;

export async function uploadPrompt(): Promise<void> {
  const langfuse = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  console.log(
    `Uploading prompt "${PROMPT_NAME}"...`
  );

  await langfuse.api.prompts.create({
    name: PROMPT_NAME,
    prompt: PROMPT_TEMPLATE,
    type: "text",
    labels: ["production"],
  });

  await langfuse.shutdown();
  console.log(`  ✓ prompt "${PROMPT_NAME}" uploaded.`);
}
