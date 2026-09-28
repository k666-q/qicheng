"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  direction: "horizontal"; // col-resize
  storageKey?: string;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  side: "left" | "right";
  onResize: (size: number) => void;
};

export function ResizableDivider({ storageKey, defaultSize, minSize, maxSize, side, onResize }: Props) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startSize = useRef(defaultSize);
  const [currentSize, setCurrentSize] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = parseInt(saved);
        if (n >= minSize && n <= maxSize) return n;
      }
    }
    return defaultSize;
  });

  useEffect(() => {
    onResize(currentSize);
  }, [currentSize, onResize]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startSize.current = currentSize;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [currentSize]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newSize = side === "left"
        ? startSize.current + delta
        : startSize.current - delta;
      const clamped = Math.max(minSize, Math.min(maxSize, newSize));
      setCurrentSize(clamped);
    }

    function handleMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (storageKey) {
        localStorage.setItem(storageKey, String(currentSize));
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [minSize, maxSize, side, storageKey, currentSize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="relative z-20 w-[5px] shrink-0 cursor-col-resize group"
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-cyan-400/10 group-hover:bg-cyan-400/30 group-active:bg-cyan-400/50 transition-colors" />
    </div>
  );
}

export function useResizablePanel(storageKey: string, defaultSize: number, minSize: number, maxSize: number) {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return defaultSize;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const n = parseInt(saved);
      if (n >= minSize && n <= maxSize) return n;
    }
    return defaultSize;
  });

  const onResize = useCallback((newSize: number) => {
    setSize(newSize);
    localStorage.setItem(storageKey, String(newSize));
  }, [storageKey]);

  return { size, onResize };
}
