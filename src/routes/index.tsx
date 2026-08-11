import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy, Download, Send, Trash2, TerminalSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BOTS, BOT_LIST, type BotId } from "@/lib/termux-bots";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Termux Copilot — KI für Termux-Befehle & Scripts" },
      {
        name: "description",
        content:
          "Sag der KI, was du auf Android in Termux machen willst — sie liefert dir die genauen Befehle und Scripts zum Kopieren und Ausführen.",
      },
      { property: "og:title", content: "Termux Copilot" },
      {
        property: "og:description",
        content: "KI-Assistent für Termux: Befehle & Scripts auf Anfrage.",
      },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "termux-copilot:messages:v1";
const BOT_KEY = "termux-copilot:bot:v1";

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function loadBot(): BotId {
  if (typeof window === "undefined") return "allrounder";
  const v = window.localStorage.getItem(BOT_KEY) as BotId | null;
  return v && BOTS[v] ? v : "allrounder";
}

function Index() {
  const [input, setInput] = useState("");
  const [botId, setBotId] = useState<BotId>("allrounder");
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { botId } }),
    [botId],
  );

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: "termux-copilot-single",
    transport,
    onError: (err) => toast.error(err.message ?? "Fehler bei der KI-Antwort"),
  });

  // Browser-only state is restored after mount to keep SSR markup stable.
  useEffect(() => {
    const stored = loadMessages();
    if (stored.length) setMessages(stored);
    setBotId(loadBot());
    setHydrated(true);
  }, [setMessages]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(BOT_KEY, botId);
  }, [botId, hydrated]);


  const activeBot = BOTS[botId];

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);


  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  useEffect(() => {
    if (status === "ready") inputRef.current?.focus();
  }, [status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const busy = status === "submitted" || status === "streaming";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  };

  const clearChat = () => {
    setMessages([]);
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
              <TerminalSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-mono text-sm sm:text-base font-semibold leading-tight">
                Termux Copilot
              </h1>
              <p
                suppressHydrationWarning
                className="text-[11px] text-muted-foreground leading-tight"
              >
                {activeBot.emoji} {activeBot.name} · {activeBot.tagline}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Chat leeren
            </button>
          )}
        </div>
        <div className="max-w-3xl mx-auto px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
          {BOT_LIST.map((b) => {
            const active = b.id === botId;
            return (
              <button
                key={b.id}
                onClick={() => setBotId(b.id)}
                className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition font-mono ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
                title={b.tagline}
              >
                {b.emoji} {b.name}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-40 sm:pb-44">
        {messages.length === 0 ? (
          <EmptyState onPick={(q) => setInput(q)} botId={botId} />
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
                <Loader2 className="w-4 h-4 animate-spin" /> denkt nach…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </main>


      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur"
      >
        <div className="max-w-3xl mx-auto p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/60 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as FormEvent);
                }
              }}
              rows={1}
              placeholder="z.B. 'Wie installiere ich Python und starte einen HTTP-Server?'"
              className="flex-1 resize-none bg-transparent outline-none px-2 py-2 text-sm max-h-40 placeholder:text-muted-foreground"
              style={{ minHeight: 40 }}
            />
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="shrink-0 h-10 px-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90"
              >
                Stopp
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="shrink-0 h-10 w-10 grid place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition"
                aria-label="Senden"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Verlauf wird lokal in deinem Browser gespeichert. Enter = senden, Shift+Enter = neue Zeile.
          </p>
        </div>
      </form>
    </div>
  );
}

const EXAMPLES_BY_BOT: Record<BotId, string[]> = {
  allrounder: [
    "Installiere Python 3 und pip in Termux",
    "Backup-Script für ~/storage/shared/DCIM auf externe SD",
    "Wie richte ich SSH-Server in Termux ein?",
    "Alle .jpg im Storage nach Aufnahmedatum in Ordner sortieren",
  ],
  scripter: [
    "Script: täglich um 3 Uhr Fotos auf USB-Stick sichern",
    "Script: alle leeren Ordner in ~/storage/shared löschen",
    "Script: Batterie-Log alle 5 Min in CSV schreiben",
    "Script: WhatsApp-Media nach Kontakt in Unterordner sortieren",
  ],
  coder: [
    "Python: Telegram-Bot der Battery-Status meldet",
    "Node.js: Express-API auf Port 3000 mit /ping Endpoint",
    "Python: Bildkomprimierer für einen ganzen Ordner",
    "Bash: rekursiver Dateihasher (sha256) mit Ausgabe als JSON",
  ],
  automation: [
    "Beim Termux-Start automatisch SSH-Server hochfahren",
    "Widget-Script das WLAN toggled",
    "Jede Stunde Foto von Frontkamera speichern (termux-api)",
    "Bei niedrigem Akku Notification + WLAN aus",
  ],
  netzwerk: [
    "SSH-Server auf Port 8022 mit key-only-Login",
    "HTTP-Server für ~/storage/shared im lokalen Netz",
    "Reverse-Tunnel via cloudflared zu localhost:8080",
    "nmap-Scan des lokalen Subnetzes",
  ],
  debugger: [
    "Fehler: 'pkg: command not found' – was tun?",
    "sshd startet nicht – wie debuggen?",
    "pip install cryptography schlägt fehl",
    "termux-setup-storage fragt nicht nach Berechtigung",
  ],
};

function EmptyState({ onPick, botId }: { onPick: (q: string) => void; botId: BotId }) {
  const bot = BOTS[botId];
  const examples = EXAMPLES_BY_BOT[botId];
  return (
    <div className="mt-8 sm:mt-16 text-center">
      <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/15 text-primary items-center justify-center mb-4 text-2xl">
        {bot.emoji}
      </div>
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
        {bot.name} bereit.
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        {bot.tagline}. Kein Blabla, direkt lauffähige Befehle & Scripts.
      </p>
      <div className="grid sm:grid-cols-2 gap-2 mt-6 max-w-2xl mx-auto">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => onPick(ex)}
            className="text-left text-sm p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent transition"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}


function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full rounded-2xl rounded-bl-md bg-card border border-border px-4 py-3 text-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
          <ReactMarkdown
            components={{
              code(props) {
                const { className, children, ...rest } = props as {
                  className?: string;
                  children?: React.ReactNode;
                };
                const isBlock = /language-/.test(className ?? "");
                if (!isBlock) {
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[12px]"
                      {...rest}
                    >
                      {children}
                    </code>
                  );
                }
                const code = String(children).replace(/\n$/, "");
                const lang = (className ?? "").replace("language-", "") || "bash";
                return <CodeBlock code={code} lang={lang} />;
              },
              pre({ children }) {
                return <>{children}</>;
              },
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const isScript =
    code.split("\n").length > 3 || code.startsWith("#!") || /\n/.test(code.trim());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("In Zwischenablage kopiert");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  const download = () => {
    const hasShebang = code.startsWith("#!");
    const content = hasShebang
      ? code
      : `#!/data/data/com.termux/files/usr/bin/bash\nset -e\n\n${code}\n`;
    const blob = new Blob([content], { type: "text/x-shellscript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termux-script-${Date.now()}.sh`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Script heruntergeladen — mit 'chmod +x' ausführbar machen");
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-border bg-[oklch(0.18_0.02_260)] not-prose">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-black/20">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
          {lang}
        </span>
        <div className="flex items-center gap-1">
          {isScript && (
            <button
              onClick={download}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-white/5 transition"
            >
              <Download className="w-3.5 h-3.5" /> .sh
            </button>
          )}
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-white/5 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> Kopiert
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Kopieren
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="p-3 overflow-x-auto text-[12.5px] leading-relaxed font-mono text-[oklch(0.95_0.02_150)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
