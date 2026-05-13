"use client";

import { useState } from "react";

type DraftCardProps = {
  title: string;
  content: string;
  editable?: boolean;
  onEdit?: (newContent: string) => void;
  icon: string;
  visible: boolean;
};

export function DraftCard({ title, content, editable, onEdit, icon, visible }: DraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);

  if (!visible) return null;

  function handleSave() {
    onEdit?.(editValue);
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
        <span>{icon}</span>
        <span>{title}</span>
        {editable && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="ml-auto text-xs text-stone-400 hover:text-stone-600"
          >
            修改
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-800 focus:border-stone-400 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={handleSave}
              className="text-xs text-stone-700 hover:text-stone-900"
            >
              确认
            </button>
            <button
              onClick={() => { setEditing(false); setEditValue(content); }}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-stone-800">{content}</p>
      )}
    </div>
  );
}
