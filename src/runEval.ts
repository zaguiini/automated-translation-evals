import { Langfuse } from "langfuse";
import type { PoEntry } from "./parsePo.js";
import { translate } from "./translate.js";
import { computeBleu, computeChrF, llmJudge } from "./score.js";

const DATASET_NAME = "translation-evals-pt-br";

export async function runEval(options: { model: string; limit: number }): Promise<void> {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  const runName = `${options.model}-${new Date().toISOString().slice(0, 10)}`;
  console.log(`Starting eval run "${runName}" (limit: ${options.limit} items)...`);

  const dataset = await langfuse.getDataset(DATASET_NAME);
  const items = dataset.items.slice(0, options.limit);

  for (const item of items) {
    // The dataset input shape was set by uploadDataset.ts:
    // { msgid, msgctxt, comments, prompt }
    // expectedOutput is the human baseline msgstr
    const entry = item.input as Pick<PoEntry, "msgid" | "msgctxt" | "comments"> & { prompt: string };
    const reference = item.expectedOutput as string;

    // Create a Langfuse trace for this item
    const trace = langfuse.trace({
      name: "translation-eval",
      input: entry,
      metadata: { model: options.model },
    });

    // Generate translation, logged as a generation span
    const generation = trace.generation({
      name: "translate",
      model: options.model,
      input: entry.prompt,
    });
    const translation = await translate(entry as unknown as PoEntry, options.model);
    generation.end({ output: translation });

    // Compute BLEU and chrF scores
    const bleu = computeBleu(translation, reference);
    const chrf = computeChrF(translation, reference);

    // LLM judge
    const judgeResult = await llmJudge(translation, reference, entry as unknown as PoEntry);

    // Link trace to the named dataset run
    await item.link(trace, runName);

    // Upload scores to the trace
    langfuse.score({ traceId: trace.id, name: "bleu", value: bleu });
    langfuse.score({ traceId: trace.id, name: "chrf", value: chrf });
    langfuse.score({
      traceId: trace.id,
      name: "accuracy",
      value: judgeResult.accuracy / 10,
      comment: judgeResult.comment,
    });
    langfuse.score({ traceId: trace.id, name: "fluency", value: judgeResult.fluency / 10 });

    console.log(
      `  ✓ [${options.model}] ${String(entry.msgid ?? "").slice(0, 50)} | ` +
        `BLEU=${bleu.toFixed(2)} chrF=${chrf.toFixed(2)} accuracy=${judgeResult.accuracy} fluency=${judgeResult.fluency}`
    );
  }

  await langfuse.flushAsync();
  console.log(`\nRun "${runName}" complete. ${items.length} items evaluated.`);
}
