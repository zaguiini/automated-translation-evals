import { Langfuse } from "langfuse";

export async function cleanup(): Promise<void> {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  const baseUrl = process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";
  const authHeader =
    "Basic " +
    Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString("base64");

  let page = 1;
  const limit = 100;
  let totalDeleted = 0;

  console.log("Fetching traces...");

  while (true) {
    const res = await langfuse.fetchTraces({ page, limit });
    const traceIds = res.data.map((t) => t.id);

    if (traceIds.length === 0) break;

    const deleteRes = await fetch(`${baseUrl}/api/public/traces`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ traceIds }),
    });

    if (!deleteRes.ok) {
      const body = await deleteRes.text();
      throw new Error(`Failed to delete traces (HTTP ${deleteRes.status}): ${body}`);
    }

    totalDeleted += traceIds.length;
    console.log(`  Deleted ${totalDeleted} traces (page ${page})...`);

    if (traceIds.length < limit) break;
    page++;
  }

  await langfuse.flushAsync();
  console.log(`Cleanup complete. Deleted ${totalDeleted} traces and their associated scores.`);
}
