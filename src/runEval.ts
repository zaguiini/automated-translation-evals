import { LangfuseClient } from "@langfuse/client";
import type { PoMetadata } from "./parsePo.js";
import { resourceName } from "./language.js";
import { translate } from "./translate.js";
import { computeChrF } from "./score.js";
import { sdk } from "./instrumentation.js";
import { PROMPT_NAME } from "./uploadPrompt.js";

const CONCURRENCY = 5;

export async function runEval(options: { model: string; limit?: number; metadata: PoMetadata }): Promise<void> {
  const langfuse = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  const missingVars = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "OPENAI_API_KEY"].filter(
    (v) => !process.env[v]
  );
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
  }

  const name = resourceName(options.metadata);
  const prompt = await langfuse.prompt.get(PROMPT_NAME);
  const dataset = await langfuse.dataset.get(name);

  if (options.limit != null) {
    dataset.items = dataset.items.slice(0, options.limit);
  }

  const runName = `${options.model}-${new Date().toISOString().slice(0, 16).replace("T", "-")}`;

  console.log(
    `Starting experiment "${runName}" (${dataset.items.length} items, concurrency: ${CONCURRENCY})...`
  );

  const result = await dataset.runExperiment({
    name: runName,
    runName,
    metadata: { model: options.model },
    maxConcurrency: CONCURRENCY,

    task: async ({ input, metadata: itemMetadata }) => {
      const metadata = itemMetadata as { language: string };
      const fields = input as Record<string, string>;
      const compiledPrompt = prompt.compile({
        language: metadata.language,
        msgid: fields.msgid,
        msgctxt: fields.msgctxt || "No context",
        comments: fields.comments || "No comments",
      });

      return translate(compiledPrompt, options.model, metadata.language);
    },

    evaluators: [
      async ({ output, expectedOutput }) => ({
        name: "chrf",
        value: computeChrF(output as string, expectedOutput as string),
      }),
    ],
  });

  console.log(await result.format());

  try {
    await sdk.shutdown();
  } catch {
    console.warn("Warning: OTel span flush timed out. Traces may appear in Langfuse with a short delay.");
  }
}
