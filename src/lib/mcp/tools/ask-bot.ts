import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { BOTS, type BotId } from "@/lib/termux-bots";
import { generateText } from "ai";

const botIds = Object.keys(BOTS) as [BotId, ...BotId[]];

export default defineTool({
  name: "ask_termux_bot",
  title: "Ask a Termux bot",
  description:
    "Ask a specialized Termux bot (allrounder, scripter, coder, automation, netzwerk, debugger) for real, copy-pasteable Termux commands or a full bash script. No placeholders, no examples — production-ready output.",
  inputSchema: {
    bot: z
      .enum(botIds)
      .default("allrounder")
      .describe("Which Termux bot to consult. Default: allrounder."),
    prompt: z.string().min(1).describe("The task or question, in German or English."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ bot, prompt }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return {
        content: [{ type: "text", text: "LOVABLE_API_KEY not configured on the server." }],
        isError: true,
      };
    }
    const selected = BOTS[bot];
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: selected.systemPrompt,
      prompt,
    });
    return {
      content: [{ type: "text", text }],
      structuredContent: { bot, response: text },
    };
  },
});
