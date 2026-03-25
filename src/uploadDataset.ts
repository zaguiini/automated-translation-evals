import { Langfuse } from "langfuse";
import type { PoEntry } from "./parsePo.js";
import { buildPromptContent } from "./uploadPrompts.js";

const DATASET_NAME = "translation-evals-pt-br";

export async function uploadDataset(entries: PoEntry[]): Promise<void> {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  await langfuse.createDataset({
    name: DATASET_NAME,
    description:
      "Brazilian Portuguese translation evaluation dataset with human baselines",
  });

  console.log(
    `Uploading ${entries.length} dataset items to "${DATASET_NAME}"...`
  );

  for (const entry of entries) {
    if (!entry.msgstr) {
      console.warn(
        `Skipping entry with empty baseline translation: "${entry.msgid}"`
      );
      continue;
    }

    await langfuse.createDatasetItem({
      datasetName: DATASET_NAME,
      input: {
        msgid: entry.msgid,
        msgctxt: entry.msgctxt,
        comments: entry.comments,
        prompt: buildPromptContent(entry),
      },
      expectedOutput: entry.msgstr,
    });

    console.log(`  ✓ ${entry.msgid.slice(0, 60)}`);
  }

  await langfuse.flushAsync();
}
