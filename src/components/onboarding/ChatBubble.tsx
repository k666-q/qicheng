"use client";

import ReactMarkdown from "react-markdown";

type ChatBubbleProps = {
  role: "ai" | "user";
  content: string;
};

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isAI = role === "ai";

  return (
    <div className={`flex ${isAI ? "justify-start" : "justify-end"} animate-slide-up`}>
      <div
        className={`max-w-[78%] rounded-2xl px-5 py-3 text-[15px] leading-relaxed ${
          isAI
            ? "bg-white border border-stone-100/80 text-stone-700 shadow-sm"
            : "bg-stone-900 text-white shadow-md shadow-stone-900/10"
        }`}
      >
        {isAI ? (
          <div className="prose-chat">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <span className="whitespace-pre-wrap">{content}</span>
        )}
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
    <div className="space-y-2">
      {parts.map((part, i) => (
        <ChatBubble key={i} role={role} content={part} />
      ))}
    </div>
  );
}
