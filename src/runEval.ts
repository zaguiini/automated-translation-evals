import { Langfuse } from "langfuse";
import type { PoEntry, PoMetadata } from "./parsePo.js";
import { resourceName } from "./language.js";
import { translate } from "./translate.js";
import { computeBleu, computeChrF, llmJudge } from "./score.js";

const CONCURRENCY = 5;

export async function runEval(options: { model: string; limit?: number; metadata: PoMetadata }): Promise<void> {
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

  const name = resourceName(options.metadata);

  const prompt = await langfuse.getPrompt(name);

  const sessionId = `${options.model}-${new Date().toISOString().slice(0, 16).replace("T", "-")}`;
  const dataset = await langfuse.getDataset(name);
  const items = options.limit != null ? dataset.items.slice(0, options.limit) : dataset.items;

  console.log(`[session: ${sessionId}] Starting eval run for ${options.metadata.language} (${options.limit != null ? `limit: ${options.limit}` : "all"} items, concurrency: ${CONCURRENCY})...`);

  let evaluated = 0;
  try {
    const processItem = async (item: (typeof items)[number]) => {
      const input = item.input as Record<string, unknown>;
      const reference = item.expectedOutput;
      if (typeof reference !== "string" || !reference) {
        throw new Error(`Item missing expectedOutput string (got ${JSON.stringify(reference)})`);
      }
      if (
        typeof input?.msgid !== "string" ||
        typeof input?.msgctxt !== "string" ||
        typeof input?.comments !== "string"
      ) {
        throw new Error(`Item input has unexpected shape: ${JSON.stringify(input)}`);
      }
      const entry: PoEntry = {
        msgid: input.msgid,
        msgctxt: input.msgctxt,
        comments: input.comments,
        msgstr: reference,
      };

      const compiledPrompt = prompt.compile({
        msgid: entry.msgid,
        msgctxt: entry.msgctxt || "No context",
        comments: entry.comments || "No comments",
      });

      const trace = langfuse.trace({
        name: "translation-eval",
        sessionId,
        input: entry,
        metadata: { model: options.model },
        tags: [options.model],
      });

      const generation = trace.generation({
        name: "translate",
        model: options.model,
        input: compiledPrompt,
      });
      const translation = await translate(compiledPrompt, options.model, options.metadata.language);
      generation.end({ output: translation });
      trace.update({ output: translation });

      const bleu = computeBleu(translation, reference);
      const chrf = computeChrF(translation, reference);
      const judgeResult = await llmJudge(translation, reference, entry, options.metadata.language);

      await item.link(trace, sessionId);

      langfuse.score({ traceId: trace.id, name: "bleu", value: bleu });
      langfuse.score({ traceId: trace.id, name: "chrf", value: chrf });
      langfuse.score({
        traceId: trace.id,
        name: "accuracy",
        value: judgeResult.accuracy / 10,
        comment: judgeResult.comment,
      });
      langfuse.score({ traceId: trace.id, name: "fluency", value: judgeResult.fluency / 10 });

      evaluated++;
      console.log(
        `  [session: ${sessionId}] ✓ (${evaluated}/${items.length}) [${options.model}] ${String(entry.msgid ?? "").slice(0, 50)} | ` +
          `BLEU=${bleu.toFixed(2)} chrF=${chrf.toFixed(2)} accuracy=${(judgeResult.accuracy / 10).toFixed(2)} fluency=${(judgeResult.fluency / 10).toFixed(2)}`
      );
    };

    const pending = new Set<Promise<void>>();
    for (const item of items) {
      const task = processItem(item).catch((err) => {
        console.error(`  [session: ${sessionId}] ✗ Error processing item: ${err instanceof Error ? err.message : String(err)}`);
      });
      pending.add(task);
      task.finally(() => pending.delete(task));

      if (pending.size >= CONCURRENCY) {
        await Promise.race(pending);
      }
    }
    await Promise.all(pending);
  } finally {
    await langfuse.flushAsync();
    console.log(`\n[session: ${sessionId}] Run complete. ${evaluated}/${items.length} items evaluated.`);
  }
}
