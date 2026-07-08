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
        className={`max-w-[78%] px-5 py-3 text-[15px] leading-relaxed ${
          isAI
            ? "cyber-panel backdrop-blur-xl text-white/85"
            : "border border-fuchsia-400/30 bg-fuchsia-500/10 backdrop-blur-xl text-white/90 shadow-[0_0_16px_rgba(232,121,249,0.08)]"
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
