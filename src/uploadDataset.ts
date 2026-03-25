import { LangfuseClient } from "@langfuse/client";
import type { PoEntry, PoMetadata } from "./parsePo.js";
import { resourceName } from "./language.js";

export async function uploadDataset(entries: PoEntry[], metadata: PoMetadata, limit?: number): Promise<void> {
  const langfuse = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  const datasetName = resourceName(metadata);
  const selected = limit ? entries.slice(0, limit) : entries;

  console.log('Starting upload of dataset...')

  await langfuse.api.datasets.create({
    name: datasetName,
    description:
      `${metadata.language} translation evaluation dataset for ${metadata.projectId} with human baselines`,
  });

  console.log(
    `Uploading ${selected.length} dataset items to "${datasetName}"...`
  );

  for (const entry of selected) {
    if (!entry.msgstr) {
      console.warn(
        `Skipping entry with empty baseline translation: "${entry.msgid}"`
      );
      continue;
    }

    await langfuse.api.datasetItems.create({
      datasetName: datasetName,
      input: {
        msgid: entry.msgid,
        msgctxt: entry.msgctxt,
        comments: entry.comments,
      },
      metadata: {
        language: metadata.language,
      },
      expectedOutput: entry.msgstr,
    });

    console.log(`  ✓ ${entry.msgid.slice(0, 60)}`);
  }

  await langfuse.shutdown();
}
