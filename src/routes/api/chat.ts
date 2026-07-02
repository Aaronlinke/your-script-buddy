import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `Du bist "Termux Copilot", ein Experten-Assistent für Termux (Terminal-Emulator für Android).

Deine Aufgabe:
- Der Nutzer beschreibt, was er auf seinem Android-Gerät in Termux erreichen will.
- Du antwortest auf Deutsch, kurz und praxisnah.
- Du gibst IMMER die konkreten Befehle als Code-Blöcke aus, die man direkt kopieren und ausführen kann.
- Nutze \`\`\`bash Code-Blöcke für einzelne Befehle und komplette Scripts.
- Erkläre kurz, was jeder Schritt macht (1-2 Sätze pro Block).
- Berücksichtige Termux-Besonderheiten: pkg statt apt, keine sudo, HOME=/data/data/com.termux/files/home, Storage nur nach 'termux-setup-storage', Paketmanager 'pkg', 'pip', 'npm'.
- Bei mehreren Schritten: nummeriere sie und gib pro Schritt einen eigenen Code-Block.
- Wenn ein komplettes Script sinnvoll ist, gib es als einen \`\`\`bash Block mit Shebang (#!/data/data/com.termux/files/usr/bin/bash) aus und erkläre, wie man es speichert (z.B. nano script.sh) und ausführbar macht (chmod +x).
- Warne bei destruktiven Befehlen (rm -rf, etc.).
- Wenn ein Paket installiert werden muss, sag es explizit (pkg install ...).

Frage kurz nach, wenn wirklich wichtige Infos fehlen. Ansonsten: liefere direkt.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
