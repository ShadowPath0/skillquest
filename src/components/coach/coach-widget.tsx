"use client";

import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function CoachWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);

  async function send() {
    const userMessage = input.trim();
    if (!userMessage || streaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, conversationId }),
      });

      const newConversationId = res.headers.get("X-Conversation-Id");
      if (newConversationId) setConversationId(newConversationId);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: assistantContent };
            return next;
          });
        }
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="fixed right-6 bottom-6 z-50">
      {open ? (
        <div className="flex h-[480px] w-80 flex-col rounded-lg border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-medium">Coach IA</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pose-moi une question sur ton parcours, je suis là pour t&apos;aider.
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 border-t p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Écris ta question..."
              rows={2}
              className="min-h-0 resize-none"
            />
            <Button size="icon" onClick={send} disabled={streaming || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="icon-lg"
          className="rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="size-5" />
        </Button>
      )}
    </div>
  );
}
