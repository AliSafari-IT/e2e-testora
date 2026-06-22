import { getRun } from "@/test-engine/executors/runLog";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = getRun(runId);
  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      for (const line of run.lines) send("log", line);

      if (run.done) {
        send(run.error ? "error" : "done", run.error ?? run.result);
        controller.close();
        return;
      }

      const onLog = (line: string) => send("log", line);
      const onDone = (result: unknown) => {
        send("done", result);
        cleanup();
        controller.close();
      };
      const onError = (error: string) => {
        send("error", error);
        cleanup();
        controller.close();
      };
      function cleanup() {
        run!.emitter.off("log", onLog);
        run!.emitter.off("done", onDone);
        run!.emitter.off("error", onError);
      }

      run.emitter.on("log", onLog);
      run.emitter.on("done", onDone);
      run.emitter.on("error", onError);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
