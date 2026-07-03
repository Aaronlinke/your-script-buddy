import { defineTool } from "@lovable.dev/mcp-js";
import { BOT_LIST } from "@/lib/termux-bots";

export default defineTool({
  name: "list_termux_bots",
  title: "List Termux bots",
  description:
    "List every specialized Termux bot available (id, name, focus). Call this first to pick the right bot for ask_termux_bot.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const bots = BOT_LIST.map((b) => ({
      id: b.id,
      name: b.name,
      emoji: b.emoji,
      tagline: b.tagline,
    }));
    const text = bots.map((b) => `- ${b.id} — ${b.emoji} ${b.name}: ${b.tagline}`).join("\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: { bots },
    };
  },
});
