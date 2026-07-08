"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  readNote,
  writeNote,
  saveAudio,
  hasNotesDirectory,
  pickNotesDirectory,
  restoreNotesDirectory,
} from "@/lib/notes/fs-provider";

type Props = {
  subjectName: string;
  nodeName: string;
  nodeId: string;
  onClose: () => void;
};

export function NotePanel({ subjectName, nodeName, nodeId, onClose }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [hasDir, setHasDir] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [audioFiles, setAudioFiles] = useState<string[]>([]);

  useEffect(() => {
    restoreNotesDirectory().then((ok) => setHasDir(ok || hasNotesDirectory()));
  }, []);

  useEffect(() => {
    readNote(subjectName, nodeName).then(setContent);
    const savedAudios = JSON.parse(
      localStorage.getItem(`qc_audios_${nodeId}`) || "[]"
    ) as string[];
    setAudioFiles(savedAudios);
  }, [subjectName, nodeName, nodeId]);

  const autoSave = useCallback(
    (text: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        await writeNote(subjectName, nodeName, text);
        setSaving(false);
        setLastSaved(new Date().toLocaleTimeString());
      }, 1500);
    },
    [subjectName, nodeName]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    autoSave(val);
  };

  const handlePickDir = async () => {
    const ok = await pickNotesDirectory();
    setHasDir(ok);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const filename = await saveAudio(subjectName, nodeName, blob);
        if (filename) {
          const updated = [...audioFiles, filename];
          setAudioFiles(updated);
          localStorage.setItem(`qc_audios_${nodeId}`, JSON.stringify(updated));
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      /* microphone access denied */
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const handleAiFormat = async () => {
    if (!content.trim() || formatting) return;
    setFormatting(true);
    try {
      const res = await fetch("/api/format-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, nodeName }),
      });
      const data = await res.json();
      if (data.formatted) {
        setContent(data.formatted);
        autoSave(data.formatted);
      }
    } catch {
      /* ignore */
    }
    setFormatting(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const { saveImage } = await import("@/lib/notes/fs-provider");
        const filename = await saveImage(subjectName, nodeName, blob);
        if (filename) {
          setContent((prev) => prev + `\n![图片](${filename})\n`);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#12121a]/95 border-l border-white/10 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-sm font-medium text-white/80">笔记</span>
          {saving && <span className="text-[10px] text-white/30 animate-pulse">保存中...</span>}
          {!saving && lastSaved && <span className="text-[10px] text-white/30">{lastSaved} 已保存</span>}
        </div>
        <div className="flex items-center gap-1">
          {!hasDir && (
            <button
              onClick={handlePickDir}
              className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              选择存储目录
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <textarea
          value={content}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={`在这里记录关于「${nodeName}」的学习笔记...\n\n支持 Markdown 格式，可粘贴图片`}
          className="w-full h-full resize-none bg-transparent px-4 py-3 text-sm text-white/80 placeholder-white/20 focus:outline-none leading-relaxed font-mono"
        />
      </div>

      {/* Footer toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/10">
        {/* Audio recording */}
        <button
          onClick={recording ? handleStopRecording : handleStartRecording}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
            recording
              ? "bg-red-500/20 text-red-300 border border-red-500/30"
              : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
          }`}
        >
          {recording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              停止录音
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              语音记录
            </>
          )}
        </button>

        {audioFiles.length > 0 && (
          <span className="text-[10px] text-white/30">{audioFiles.length} 段录音</span>
        )}

        <button
          onClick={handleAiFormat}
          disabled={formatting || !content.trim()}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
            formatting
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "bg-white/5 text-white/50 border border-white/10 hover:bg-purple-500/10 hover:text-purple-300 hover:border-purple-400/20 disabled:opacity-30"
          }`}
        >
          {formatting ? (
            <>
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              整理中...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              AI 整理
            </>
          )}
        </button>

        <div className="flex-1" />
        <span className="text-[10px] text-white/30">{content.length} 字</span>
      </div>
    </div>
  );
}
