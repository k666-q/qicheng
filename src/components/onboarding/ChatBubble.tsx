"use client";

type ChatBubbleProps = {
  role: "ai" | "user";
  content: string;
};

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isAI = role === "ai";

  return (
    <div className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isAI
            ? "bg-stone-100 text-stone-800"
            : "bg-stone-800 text-white"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

const BUBBLE_SEPARATOR = "|||SPLIT|||";

export function ChatBubbleGroup({ role, content }: ChatBubbleProps) {
  if (role === "user") {
    return <ChatBubble role={role} content={content} />;
  }

  const parts = content.split(BUBBLE_SEPARATOR).map((s) => s.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return <ChatBubble role={role} content={content} />;
  }

  return (
    <div className="space-y-1.5">
      {parts.map((part, i) => (
        <ChatBubble key={i} role={role} content={part} />
      ))}
    </div>
  );
}
