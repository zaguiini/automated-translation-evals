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

  const missingVars = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"].filter(
    (v) => !process.env[v]
  );
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
  }

  const runName = `${options.model}-${new Date().toISOString().slice(0, 16).replace("T", "-")}`;
  console.log(`Starting eval run "${runName}" (limit: ${options.limit} items)...`);

  const dataset = await langfuse.getDataset(DATASET_NAME);
  const items = dataset.items.slice(0, options.limit);

  let evaluated = 0;
  try {
    for (const item of items) {
      try {
        // The dataset input shape was set by uploadDataset.ts:
        // { msgid, msgctxt, comments, prompt }
        // expectedOutput is the human baseline msgstr
        const input = item.input as Record<string, unknown>;
        const reference = item.expectedOutput;
        if (typeof reference !== "string" || !reference) {
          throw new Error(`Item missing expectedOutput string (got ${JSON.stringify(reference)})`);
        }
        if (
          typeof input?.msgid !== "string" ||
          typeof input?.msgctxt !== "string" ||
          typeof input?.comments !== "string" ||
          typeof input?.prompt !== "string"
        ) {
          throw new Error(`Item input has unexpected shape: ${JSON.stringify(input)}`);
        }
        const entry: PoEntry = {
          msgid: input.msgid,
          msgctxt: input.msgctxt,
          comments: input.comments,
          msgstr: reference,
        };

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
          input: input.prompt,
        });
        const translation = await translate(entry, options.model);
        generation.end({ output: translation });

        // Compute BLEU and chrF scores
        const bleu = computeBleu(translation, reference);
        const chrf = computeChrF(translation, reference);

        // LLM judge
        const judgeResult = await llmJudge(translation, reference, entry);

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
            `BLEU=${bleu.toFixed(2)} chrF=${chrf.toFixed(2)} accuracy=${(judgeResult.accuracy / 10).toFixed(2)} fluency=${(judgeResult.fluency / 10).toFixed(2)}`
        );
        evaluated++;
      } catch (err) {
        console.error(`  ✗ Error processing item: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await langfuse.flushAsync();
    console.log(`\nRun "${runName}" complete. ${evaluated}/${items.length} items evaluated.`);
  }
}
