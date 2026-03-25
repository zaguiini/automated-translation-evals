import { Agent, setGlobalDispatcher } from "undici";
import { SocksClient } from "socks";
import tls from "node:tls";

const socksProxy = process.env.SOCKS_PROXY;

if (socksProxy) {
  const url = new URL(socksProxy);

  // Patch undici/fetch() — used by Langfuse SDK, OpenAI SDK
  const dispatcher = new Agent({
    connect: async (options, callback) => {
      try {
        const { socket } = await SocksClient.createConnection({
          proxy: {
            host: url.hostname,
            port: Number(url.port),
            type: 5,
          },
          command: "connect",
          destination: {
            host: options.hostname!,
            port: Number(options.port) || 443,
          },
        });

        const tlsSocket = tls.connect({
          socket,
          servername: options.hostname!,
        });

        callback(null, tlsSocket as any);
      } catch (err) {
        callback(err as Error, null);
      }
    },
  });
  setGlobalDispatcher(dispatcher);
}
