// AI 标记协议解析器。
// AI 流式输出以 [[TYPE 参数]] 行分隔的段落，前端增量解析为交互卡片。
// 解析是幂等的：每次对累计文本整体重解析，最后一段视为"未完成"（仍在流式生成）。

import type { ChoiceOption, Segment, SegmentType } from "./types";

const MARKER_RE = /^\[\[([A-Z_]+)(?:\s+([^\]]*))?\]\]\s*$/;

const MARKER_TO_TYPE: Record<string, SegmentType> = {
  HOOK: "hook",
  TEACH: "teach",
  PREDICT: "predict",
  FLASH: "flash",
  BLANK: "blank",
  QUIZ: "quiz",
  HUNT: "hunt",
  RECALL: "recall",
  ASK_SUMMARY: "ask_summary",
  FEEDBACK: "feedback",
  GAIN: "gain",
  GIANT: "giant",
  SEED: "seed",
  DEBT: "debt",
  CREATE: "create",
  CODE: "code",
  DERIVE: "derive",
  LAYER_DONE: "layer_done",
  STICK: "stick",
  GAP: "gap",
};

type RawBlock = { type: SegmentType; param?: string; lines: string[] };

function parseChoiceBlock(seg: Segment, lines: string[]) {
  const options: ChoiceOption[] = [];
  const contentLines: string[] = [];
  let whyLines: string[] | null = null;

  for (const line of lines) {
    const t = line.trim();
    const optMatch = t.match(/^([A-E])[).、]\s*(.+)$/);
    const fieldMatch = t.match(/^(Q|ANSWER|WHY|TAUNT|HINT)\s*[:：]\s*(.*)$/i);

    if (optMatch) {
      whyLines = null;
      options.push({ label: optMatch[1], text: optMatch[2] });
    } else if (fieldMatch) {
      whyLines = null;
      const key = fieldMatch[1].toUpperCase();
      const value = fieldMatch[2];
      if (key === "Q") seg.question = value;
      else if (key === "ANSWER") seg.answer = value.trim().charAt(0).toUpperCase();
      else if (key === "TAUNT") seg.taunt = value;
      else if (key === "HINT") seg.hint = value;
      else if (key === "WHY") {
        seg.why = value;
        whyLines = [value];
      }
    } else if (whyLines && t) {
      // WHY 可以多行
      whyLines.push(t);
      seg.why = whyLines.join("\n");
    } else if (t) {
      contentLines.push(line);
    }
  }

  seg.options = options;
  seg.content = contentLines.join("\n").trim();
}

function parseBlankBlock(seg: Segment, lines: string[]) {
  const stemLines: string[] = [];
  const hiddenLines: string[] = [];
  let mode: "stem" | "hidden" | "none" = "none";

  for (const line of lines) {
    const t = line.trim();
    const stemMatch = t.match(/^STEM\s*[:：]\s*(.*)$/i);
    const hiddenMatch = t.match(/^HIDDEN\s*[:：]\s*(.*)$/i);
    if (stemMatch) {
      mode = "stem";
      if (stemMatch[1]) stemLines.push(stemMatch[1]);
    } else if (hiddenMatch) {
      mode = "hidden";
      if (hiddenMatch[1]) hiddenLines.push(hiddenMatch[1]);
    } else if (mode === "stem") {
      stemLines.push(line);
    } else if (mode === "hidden") {
      hiddenLines.push(line);
    } else if (t) {
      stemLines.push(line);
    }
  }

  seg.stem = stemLines.join("\n").trim();
  seg.hidden = hiddenLines.join("\n").trim();
  seg.content = "";
}

function parseCodeBlock(seg: Segment, lines: string[], lang?: string) {
  seg.codeLang = lang || "text";
  seg.codeLines = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split("|");
    if (parts.length >= 3) {
      const lineNum = parseInt(parts[0].trim(), 10) || seg.codeLines.length + 1;
      const code = parts[1] || "";
      const comment = parts.slice(2).join("|");
      seg.codeLines.push({ line: lineNum, code, comment });
    } else if (parts.length === 2) {
      seg.codeLines.push({ line: seg.codeLines.length + 1, code: parts[0], comment: parts[1] });
    } else {
      seg.codeLines.push({ line: seg.codeLines.length + 1, code: t, comment: "" });
    }
  }
  seg.content = lines.join("\n").trim();
}

function parseDeriveBlock(seg: Segment, lines: string[]) {
  seg.deriveSteps = [];
  let current: { step: string; formula: string; why: string } | null = null;
  for (const line of lines) {
    const t = line.trim();
    const stepMatch = t.match(/^STEP\s*[:：]\s*(.*)$/i);
    const formulaMatch = t.match(/^FORMULA\s*[:：]\s*(.*)$/i);
    const whyMatch = t.match(/^WHY\s*[:：]\s*(.*)$/i);
    if (stepMatch) {
      if (current) seg.deriveSteps.push(current);
      current = { step: stepMatch[1], formula: "", why: "" };
    } else if (formulaMatch && current) {
      current.formula = formulaMatch[1];
    } else if (whyMatch && current) {
      current.why = whyMatch[1];
    }
  }
  if (current) seg.deriveSteps.push(current);
  seg.content = lines.join("\n").trim();
}

function finalizeBlock(block: RawBlock): Segment {
  const seg: Segment = { type: block.type, content: "" };

  if (block.type === "flash") {
    const secs = parseInt(block.param || "20", 10);
    seg.flashSeconds = Number.isFinite(secs) && secs > 0 ? secs : 20;
  } else if (block.type === "hunt") {
    seg.huntIndex = (block.param || "").trim() || undefined;
  } else if (block.type === "gain") {
    seg.gainName = (block.param || "").trim() || undefined;
  }

  if (block.type === "predict" || block.type === "quiz") {
    parseChoiceBlock(seg, block.lines);
  } else if (block.type === "blank") {
    parseBlankBlock(seg, block.lines);
  } else if (block.type === "code") {
    parseCodeBlock(seg, block.lines, block.param);
  } else if (block.type === "derive") {
    parseDeriveBlock(seg, block.lines);
  } else {
    seg.content = block.lines.join("\n").trim();
  }

  return seg;
}

export type ParseResult = {
  segments: Segment[];
  /** 流式生成中，最后一段尚未确定结束 */
  lastOpen: boolean;
};

/** 对累计文本整体重解析（幂等，适合流式调用） */
export function parseSegments(text: string): ParseResult {
  const lines = text.split("\n");
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  for (const line of lines) {
    const m = line.trim().match(MARKER_RE);
    const type = m ? MARKER_TO_TYPE[m[1]] : undefined;
    if (m && type) {
      if (current) blocks.push(current);
      current = { type, param: m[2], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
    // 第一个标记之前的内容丢弃（通常是 AI 的客套话）
  }
  if (current) blocks.push(current);

  return {
    segments: blocks.map(finalizeBlock),
    lastOpen: blocks.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────
// 输出校验：协议不能靠祈祷。探索流结束后检查结构，不合格则重试一次。
// ─────────────────────────────────────────────────────────────

export type ScriptExpectation = {
  cycle: number;
  /** 至少几道 quiz/predict */
  minQuestions: number;
  /** 是否必须以 ASK_SUMMARY 收束（第 4 周目不需要） */
  requireSummary: boolean;
  /** 第 2 周目 CS/数学：必须有 CODE 或 DERIVE */
  requireDeepDive: boolean;
  /** 第 3 周目：必须有 CREATE */
  requireCreate: boolean;
};

export type ValidationIssue = { code: string; message: string };

export function validateScript(segments: Segment[], expect: ScriptExpectation): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const has = (t: SegmentType) => segments.some((s) => s.type === t);
  const count = (t: SegmentType) => segments.filter((s) => s.type === t).length;

  if (segments.length === 0) {
    issues.push({ code: "empty", message: "没有解析到任何 [[标记]] 段落" });
    return issues;
  }
  if (!has("hook") && expect.cycle <= 3) {
    issues.push({ code: "no_hook", message: "缺少 [[HOOK]] 开场" });
  }
  const questions = count("quiz") + count("predict");
  if (questions < expect.minQuestions) {
    issues.push({ code: "few_questions", message: `题目数不足：需要 ≥${expect.minQuestions}，实际 ${questions}` });
  }
  // 每道题必须有 ANSWER 且选项 ≥ 2
  for (const s of segments) {
    if ((s.type === "quiz" || s.type === "predict") && (!s.answer || !s.options || s.options.length < 2)) {
      issues.push({ code: "bad_question", message: "存在题目缺少 ANSWER 或选项不足 2 个" });
      break;
    }
  }
  if (expect.requireSummary && !has("ask_summary")) {
    issues.push({ code: "no_summary", message: "缺少 [[ASK_SUMMARY]] 收束" });
  }
  if (expect.requireDeepDive && !has("code") && !has("derive")) {
    issues.push({ code: "no_deep_dive", message: "第 2 周目必须包含 [[CODE]] 或 [[DERIVE]] 逐行/逐步段" });
  }
  if (expect.requireCreate && !has("create")) {
    issues.push({ code: "no_create", message: "第 3 周目必须包含 [[CREATE]] 造物主任务" });
  }
  return issues;
}

/** 供重试时追加到 system prompt 的纠错说明 */
export function issuesToInstruction(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "";
  return `\n\n## 上一次输出违反了协议，必须修正\n${issues.map((i) => `- ${i.message}`).join("\n")}\n严格按标记协议重新输出全部内容。`;
}
