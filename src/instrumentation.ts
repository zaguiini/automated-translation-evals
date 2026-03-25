import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SocksProxyAgent } from "socks-proxy-agent";

const publicKey = process.env.LANGFUSE_PUBLIC_KEY!;
const secretKey = process.env.LANGFUSE_SECRET_KEY!;
const baseUrl = process.env.LANGFUSE_HOST!;
const socksProxy = process.env.SOCKS_PROXY;

const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;

const exporter = new OTLPTraceExporter({
  url: `${baseUrl}/api/public/otel/v1/traces`,
  headers: {
    Authorization: authHeader,
    "x-langfuse-sdk-name": "javascript",
    "x-langfuse-public-key": publicKey,
  },
  timeoutMillis: 30_000,
  ...(socksProxy && {
    httpAgentOptions: (() => new SocksProxyAgent(socksProxy)) as any,
  }),
});

const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      baseUrl,
      exporter,
    }),
  ],
});

sdk.start();

export { sdk };
