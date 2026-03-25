import { LangfuseClient } from "@langfuse/client";
import { startActiveObservation } from "@langfuse/tracing";
import type { PoMetadata } from "./parsePo.js";
import { resourceName } from "./language.js";
import { translate } from "./translate.js";
import { computeChrF } from "./score.js";
import { sdk } from "./instrumentation.js";

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
  const prompt = await langfuse.prompt.get(name);
  const dataset = await langfuse.dataset.get(name);

  if (options.limit != null) {
    dataset.items = dataset.items.slice(0, options.limit);
  }

  const runName = `${options.model}-${new Date().toISOString().slice(0, 16).replace("T", "-")}`;
  const { language } = options.metadata;

  console.log(
    `Starting experiment "${runName}" for ${language} ` +
      `(${dataset.items.length} items, concurrency: ${CONCURRENCY})...`
  );

  const scores: number[] = [];
  let completed = 0;

  for (let i = 0; i < dataset.items.length; i += CONCURRENCY) {
    const batch = dataset.items.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (item) => {
        const fields = item.input as Record<string, string>;
        const compiledPrompt = prompt.compile({
          msgid: fields.msgid,
          msgctxt: fields.msgctxt || "No context",
          comments: fields.comments || "No comments",
        });

        const { text, traceId, observationId } = await startActiveObservation(
          "translate",
          async (generation) => {
            generation.update({
              model: options.model,
              input: compiledPrompt,
            });

            const result = await translate(compiledPrompt, options.model, language);

            generation.update({
              output: result.text,
              ...(result.usage && { usageDetails: result.usage }),
            });

            return { text: result.text, traceId: generation.traceId, observationId: generation.id };
          },
          { asType: "generation" },
        );

        await langfuse.api.datasetRunItems.create({
          runName,
          runDescription: `${language} translation eval with ${options.model}`,
          metadata: { model: options.model },
          datasetItemId: item.id,
          traceId,
          observationId,
        });

        const score = computeChrF(text, item.expectedOutput as string);
        scores.push(score);

        langfuse.score.create({
          traceId,
          name: "chrf",
          value: score,
        });

        completed++;
        console.log(`  [${completed}/${dataset.items.length}] chrf=${score.toFixed(4)}`);
      })
    );
  }

  try {
    await sdk.shutdown();
  } catch {
    console.warn("Warning: OTel span flush timed out. Traces may appear in Langfuse with a short delay.");
  }

  await langfuse.score.flush();

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log(`\nExperiment "${runName}" complete.`);
  console.log(`  Items: ${scores.length}`);
  console.log(`  Avg chrF: ${avg.toFixed(4)}`);
}
