import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOpenAI } from "@/lib/ai/openai";
import {
  agentTools,
  executeTool,
  buildSystemPrompt,
  getOrCreateConversation,
  getConversationHistory,
  saveMessages,
  updateUserMemory,
} from "@/lib/ai/chat-agent";

const encoder = new TextEncoder();

function sseChunk(data: object | string): Uint8Array {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return encoder.encode(`data: ${payload}\n\n`);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { message, conversationId: clientConvId } = await req.json() as {
    message: string;
    conversationId?: string | null;
  };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "Empty message" }), { status: 400 });
  }

  const userId = session.user.id;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { client, model } = await getOpenAI();

        // Resolve or create conversation
        const conversationId = clientConvId ?? (await getOrCreateConversation(userId));
        controller.enqueue(sseChunk({ type: "init", conversationId }));

        // Build messages: system + history + new user message
        const [systemPrompt, history] = await Promise.all([
          buildSystemPrompt(userId),
          getConversationHistory(conversationId),
        ]);

        const messages: Parameters<typeof client.chat.completions.create>[0]["messages"] = [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: message },
        ];

        // Phase 1 — streaming call (may include tool calls)
        const firstStream = await client.chat.completions.create({
          model,
          messages,
          tools: agentTools,
          tool_choice: "auto",
          stream: true,
        });

        // Accumulate tool calls from the stream
        const pendingToolCalls: Record<number, { id: string; name: string; args: string }> = {};
        let firstContent = "";
        let finishReason = "";

        for await (const chunk of firstStream) {
          const delta = chunk.choices[0]?.delta;
          const finish = chunk.choices[0]?.finish_reason;

          if (delta?.content) {
            firstContent += delta.content;
            controller.enqueue(sseChunk({ type: "text", content: delta.content }));
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!pendingToolCalls[idx]) {
                pendingToolCalls[idx] = { id: tc.id ?? "", name: "", args: "" };
              }
              if (tc.id) pendingToolCalls[idx].id = tc.id;
              if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name;
              if (tc.function?.arguments) pendingToolCalls[idx].args += tc.function.arguments;
            }
          }

          if (finish) finishReason = finish;
        }

        let finalContent = firstContent;

        // Phase 2 — if tools were called, execute them and get final response
        if (finishReason === "tool_calls" && Object.keys(pendingToolCalls).length > 0) {
          const toolCallList = Object.values(pendingToolCalls);

          // Execute all tools in parallel
          const toolResults = await Promise.all(
            toolCallList.map(async (tc) => {
              const result = await executeTool(tc.name, tc.args);
              return {
                role: "tool" as const,
                tool_call_id: tc.id,
                content: result,
              };
            })
          );

          const followUpMessages = [
            ...messages,
            {
              role: "assistant" as const,
              content: firstContent || null,
              tool_calls: toolCallList.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.args },
              })),
            },
            ...toolResults,
          ];

          const secondStream = await client.chat.completions.create({
            model,
            messages: followUpMessages,
            stream: true,
          });

          finalContent = "";
          for await (const chunk of secondStream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              finalContent += content;
              controller.enqueue(sseChunk({ type: "text", content }));
            }
          }
        }

        controller.enqueue(sseChunk("[DONE]"));
        controller.close();

        // Persist conversation (non-blocking — after stream closes)
        if (finalContent) {
          saveMessages(conversationId, message, finalContent).catch(() => {});
          updateUserMemory(userId, message, finalContent).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur interne";
        controller.enqueue(sseChunk({ type: "error", message: msg }));
        controller.enqueue(sseChunk("[DONE]"));
        controller.close();
      }
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
