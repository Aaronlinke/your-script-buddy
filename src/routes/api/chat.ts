import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { BOTS, TEAM_MEMBERS, type BotId } from "@/lib/termux-bots";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  type UIMessage,
} from "ai";

const MODEL = "google/gemini-3-flash-preview";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, botId } = (await request.json()) as {
          messages?: UIMessage[];
          botId?: BotId;
        };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway(MODEL);
        const modelMessages = await convertToModelMessages(messages);
        const abortSignal = request.signal;

        if (botId !== "team") {
          const bot = (botId && BOTS[botId]) || BOTS.allrounder;
          const result = streamText({
            model,
            system: bot.systemPrompt,
            messages: modelMessages,
            abortSignal,
          });
          return result.toUIMessageStreamResponse({ originalMessages: messages });
        }

        // ---- Team-Modus: alle Bots arbeiten nacheinander an derselben Aufgabe ----
        const stream = createUIMessageStream({
          originalMessages: messages,
          execute: async ({ writer }) => {
            let blockId = 0;
            const writeText = (text: string) => {
              const id = `t${blockId++}`;
              writer.write({ type: "text-start", id });
              writer.write({ type: "text-delta", id, delta: text });
              writer.write({ type: "text-end", id });
            };

            // 1. Koordinator verteilt die Aufgaben
            const plan = await generateText({
              model,
              abortSignal,
              system:
                BOTS.team.systemPrompt +
                `\nDu verteilst die Aufgabe auf dein Team. Verfügbare Mitglieder (id: Rolle):\n` +
                TEAM_MEMBERS.map(
                  (id) => `${id}: ${BOTS[id].name} – ${BOTS[id].tagline}`,
                ).join("\n") +
                `\nAntworte AUSSCHLIESSLICH mit Zeilen im Format "id | konkreter Teilauftrag".\n` +
                `Nur Mitglieder, die für diese Aufgabe wirklich gebraucht werden. Max 4 Zeilen. Keine Erklärung, kein Markdown.`,
              messages: modelMessages,
            });

            const assignments = plan.text
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.includes("|"))
              .map((line) => {
                const [rawId, ...rest] = line.split("|");
                const id = rawId.replace(/[^a-z]/gi, "").toLowerCase() as BotId;
                return { id, task: rest.join("|").trim() };
              })
              .filter((a) => TEAM_MEMBERS.includes(a.id) && a.task.length > 0)
              .slice(0, 4);

            const crew = assignments.length
              ? assignments
              : [{ id: "allrounder" as BotId, task: "Löse die Aufgabe vollständig." }];

            writeText(
              `## 👥 Teamplan\n` +
                crew
                  .map((a) => `- ${BOTS[a.id].emoji} **${BOTS[a.id].name}** → ${a.task}`)
                  .join("\n") +
                `\n\n---\n`,
            );

            // 2. Jedes Mitglied arbeitet an seinem Teil – mit dem Ergebnis der Vorgänger
            const done: { id: BotId; task: string; output: string }[] = [];

            for (const a of crew) {
              if (abortSignal.aborted) return;
              const bot = BOTS[a.id];
              writeText(`\n### ${bot.emoji} ${bot.name}\n_${a.task}_\n\n`);

              const context = done.length
                ? `\nERGEBNISSE DEINER KOLLEGEN (bau darauf auf, wiederhole nichts doppelt):\n` +
                  done
                    .map((d) => `--- ${BOTS[d.id].name} (${d.task}) ---\n${d.output}`)
                    .join("\n\n")
                : "";

              const memberResult = streamText({
                model,
                abortSignal,
                system:
                  bot.systemPrompt +
                  `\nDU ARBEITEST IM TEAM. Dein Teilauftrag: ${a.task}\n` +
                  `Bearbeite NUR deinen Teil, kurz und ohne Vorrede.` +
                  context,
                messages: modelMessages,
              });

              writer.merge(memberResult.toUIMessageStream({ sendStart: false, sendFinish: false }));
              done.push({ id: a.id, task: a.task, output: await memberResult.text });
            }

            if (abortSignal.aborted || done.length < 2) return;

            // 3. Koordinator baut das Endergebnis zusammen
            writeText(`\n---\n\n### ✅ Endergebnis (Team-Koordinator)\n\n`);
            const finalResult = streamText({
              model,
              abortSignal,
              system:
                BOTS.team.systemPrompt +
                `\nFüge die Teamergebnisse zu EINER ausführbaren Lösung zusammen: nummerierte Schritte, fertige Copy&Paste-Blöcke, keine Wiederholung von Erklärungen.` +
                `\n\nTEAMERGEBNISSE:\n` +
                done
                  .map((d) => `--- ${BOTS[d.id].name} ---\n${d.output}`)
                  .join("\n\n"),
              messages: modelMessages,
            });
            writer.merge(finalResult.toUIMessageStream({ sendStart: false, sendFinish: false }));
          },
        });

        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
