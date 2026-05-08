import { resolveMusicAgent } from "@/lib/agent/resolveMusic";
import type { AgentResolveRequest, AgentResolveStreamEvent } from "@/types/agent";

function encodeEvent(event: AgentResolveStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AgentResolveRequest;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentResolveStreamEvent) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      void resolveMusicAgent(body, (trace) => send({ type: "trace", trace }))
        .then((data) => {
          send({ type: "result", data });
          controller.close();
        })
        .catch((error: unknown) => {
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Agent 暂时没接住。",
          });
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
