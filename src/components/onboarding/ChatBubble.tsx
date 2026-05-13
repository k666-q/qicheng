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
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
