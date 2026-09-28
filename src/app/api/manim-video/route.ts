import { NextRequest, NextResponse } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MANIM_SERVICE_URL =
  process.env.MANIM_SERVICE_URL || "http://localhost:8080";

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

const SYSTEM_PROMPT = `You generate Manim CE v0.18 animation code. Output ONLY pure Python, no explanation.

RULES YOU MUST NEVER BREAK:
1. Start with: from manim import *
2. Class: class ConceptScene(Scene):
3. All text in Text() must be ASCII English. NO unicode, NO Chinese.
4. Do NOT use MathTex. Use Text() for everything including formulas.
5. Do NOT use Arrow(). Use Line() with add_tip() or simple shapes instead.
6. MAX 20 self.play() calls total. Use self.wait(0.5) between sections for readability.
7. NO loops that call self.play().
8. Only use these SAFE methods: Text, Square, Circle, Rectangle, Line, VGroup, SurroundingRectangle, Brace, FadeIn, FadeOut, Write, Create, Transform, ReplacementTransform, self.play, self.wait, .animate, .set_fill, .set_stroke, .arrange, .next_to, .move_to, .to_edge, .shift, .scale, .set_color, Indicate

STYLE GUIDE (important for quality):
- Make it EDUCATIONAL: explain the "why", not just show boxes
- Use 5-6 steps for processes, not just 3
- Add concrete examples with real values (e.g. "arr[3] = 7" not just "element")
- Use color coding: GREEN=good/done, RED=bad/problem, YELLOW=current/highlight, BLUE=info
- Add brief wait(0.5) after key moments so viewer can read
- Show BEFORE and AFTER states when applicable
- End with a clear takeaway summarizing the key insight

LAYOUT RULES (CRITICAL - prevents text/shape overlapping or going off-screen):
- Scene is 14.2 x 8 units. Keep ALL elements inside x:[-6,6], y:[-3.5,3.5]. NOTHING may exceed these bounds.
- Divide screen into zones:
  * TOP zone (y > 2.5): title only
  * MIDDLE zone (-1.5 < y < 2.5): main visual (graph, array, diagram)
  * BOTTOM zone (y < -1.5): explanation text, conclusions
- Step text: font_size 14-15, place at BOTTOM area, max 40 chars per line
- NEVER show more than 3 annotation texts at the same time. Use FadeOut() on old annotations before adding new ones.
- Graph/tree nodes: radius 0.2-0.25, center-to-center spacing 1.0-1.2 units
- TREE/GRAPH STRUCTURES (VERY IMPORTANT):
  * Max 4 levels visible at once. If tree has more levels, show only a subset or animate level-by-level.
  * Vertical spacing between tree levels: 1.0-1.2 units (NOT more!)
  * Place tree ROOT at y=2.0, so 4 levels fit: y=2.0, y=0.8, y=-0.4, y=-1.6 (all within bounds)
  * Node radius: 0.2-0.25 for trees with 4+ levels
  * Use .scale(0.8) on the entire tree VGroup if it still overflows after positioning
  * BEFORE any self.play(): verify mentally that no node is below y=-3.0 or above y=3.0
- Array boxes: max 8 boxes, each 0.55 wide, place in MIDDLE zone
- Annotations near shapes: font_size 11-12, buff=0.15, keep SHORT (max 20 chars)
- When text overlaps: use .shift() to separate, or FadeOut older text first
- ALWAYS position groups with explicit .move_to() or .shift() - never let multiple groups pile up at center

TEMPLATE A - Data Structure / Algorithm visualization (detailed):
from manim import *

class ConceptScene(Scene):
    def construct(self):
        title = Text("TITLE HERE", font_size=32, color=BLUE)
        self.play(Write(title))
        self.play(title.animate.scale(0.5).to_edge(UP))
        self.wait(0.3)

        # Setup: show the data structure
        data = [4, 2, 7, 1, 5, 3]
        boxes = VGroup(*[Square(0.6).set_fill(BLUE_E, 0.3).set_stroke(WHITE, 1) for _ in data])
        boxes.arrange(RIGHT, buff=0.08).shift(UP * 0.8)
        nums = VGroup(*[Text(str(v), font_size=18).move_to(b) for v, b in zip(data, boxes)])
        idx_labels = VGroup(*[Text(str(i), font_size=12, color=GREY_B).next_to(b, DOWN, 0.15) for i, b in enumerate(boxes)])
        self.play(FadeIn(boxes), FadeIn(nums), FadeIn(idx_labels))
        self.wait(0.5)

        # Step 1: explain what we're doing (text in BOTTOM zone)
        step_area = DOWN * 2.5 + LEFT * 3
        step1 = Text("Step 1: target = 7, start scanning", font_size=15, color=YELLOW).move_to(step_area)
        self.play(Write(step1))
        target_box = SurroundingRectangle(boxes[2], color=YELLOW, buff=0.05)
        target_label = Text("target", font_size=11, color=YELLOW).next_to(target_box, UP, 0.1)
        self.play(Create(target_box), Write(target_label))
        self.wait(0.5)

        # Step 2: compare (remove step1 first to avoid overlap)
        step2 = Text("Step 2: Compare each element left to right", font_size=15, color=WHITE).move_to(step_area)
        self.play(ReplacementTransform(step1, step2))
        self.play(boxes[0].animate.set_fill(RED, 0.4))
        ann1 = Text("4!=7", font_size=11, color=RED).next_to(boxes[0], UP, 0.15)
        self.play(FadeIn(ann1))
        self.play(boxes[1].animate.set_fill(RED, 0.4))
        ann2 = Text("2!=7", font_size=11, color=RED).next_to(boxes[1], UP, 0.15)
        self.play(FadeIn(ann2))
        self.wait(0.3)

        # Step 3: found (remove old annotations)
        step3 = Text("Step 3: Found 7 at index 2!", font_size=15, color=GREEN).move_to(step_area)
        self.play(ReplacementTransform(step2, step3), FadeOut(ann1), FadeOut(ann2))
        self.play(boxes[2].animate.set_fill(GREEN, 0.7))
        self.wait(0.5)

        # Conclusion (clean scene, show summary)
        self.play(FadeOut(step3), FadeOut(target_box), FadeOut(target_label))
        conclusion = Text("Linear search: O(n) - checks each element one by one", font_size=15, color=GREEN).move_to(DOWN * 3)
        self.play(Write(conclusion))
        self.wait(1.5)

TEMPLATE B - Concept Comparison / Architecture (detailed):
from manim import *

class ConceptScene(Scene):
    def construct(self):
        title = Text("TITLE HERE", font_size=32, color=BLUE)
        self.play(Write(title))
        self.play(title.animate.scale(0.5).to_edge(UP))
        self.wait(0.3)

        # Introduction
        intro = Text("Core idea: brief explanation here", font_size=16, color=GREY_B).next_to(title, DOWN, 0.3)
        self.play(FadeIn(intro))
        self.wait(0.5)

        # Build the comparison/layers
        items = ["Level 1 - Description (fastest)", "Level 2 - Description (medium)", "Level 3 - Description (slower)", "Level 4 - Description (slowest)"]
        colors = [RED, YELLOW, GREEN, BLUE]
        rects = VGroup()
        labels = VGroup()
        for i, (txt, col) in enumerate(zip(items, colors)):
            r = Rectangle(width=3.5 + i * 0.5, height=0.55).set_fill(col, 0.25).set_stroke(col, 2)
            l = Text(txt, font_size=14).move_to(r)
            rects.add(r)
            labels.add(l)
        rects.arrange(DOWN, buff=0.2).shift(DOWN * 0.3)
        for l, r in zip(labels, rects):
            l.move_to(r)

        # Reveal one by one with annotations
        self.play(FadeIn(rects[0]), FadeIn(labels[0]))
        ann1 = Text("< 1ns access", font_size=11, color=RED).next_to(rects[0], RIGHT, 0.3)
        self.play(FadeIn(ann1))
        self.play(FadeIn(rects[1]), FadeIn(labels[1]))
        ann2 = Text("~ 10ns access", font_size=11, color=YELLOW).next_to(rects[1], RIGHT, 0.3)
        self.play(FadeIn(ann2))
        self.play(FadeIn(rects[2]), FadeIn(labels[2]))
        self.play(FadeIn(rects[3]), FadeIn(labels[3]))
        self.wait(0.5)

        # Add brace and summary
        brace = Brace(rects, LEFT, color=WHITE)
        brace_text = Text("Trade-off:\\nSpeed vs Size", font_size=13).next_to(brace, LEFT, 0.1)
        self.play(Create(brace), Write(brace_text))
        self.wait(0.5)

        # Highlight key insight
        self.play(FadeOut(intro))
        takeaway = Text("Takeaway: brief summary of the concept", font_size=16, color=YELLOW).to_edge(DOWN)
        self.play(Write(takeaway))
        self.wait(1.5)

TEMPLATE C - Process / Algorithm Steps (detailed):
from manim import *

class ConceptScene(Scene):
    def construct(self):
        title = Text("TITLE HERE", font_size=32, color=BLUE)
        self.play(Write(title))
        self.play(title.animate.scale(0.5).to_edge(UP))
        self.wait(0.3)

        # Overview
        overview = Text("Goal: what this process achieves", font_size=15, color=GREY_B).next_to(title, DOWN, 0.25)
        self.play(FadeIn(overview))
        self.wait(0.5)

        # Steps shown in groups (max 3 visible, fade old ones out)
        steps_data = [
            ("1. First action - specific detail", WHITE),
            ("2. Second action - explain why", WHITE),
            ("3. Third action - the critical step", YELLOW),
            ("4. Fourth action - what happens next", WHITE),
            ("5. Final action - result achieved", GREEN),
        ]
        step_area_y = -0.5
        visible_steps = []

        for i, (txt, col) in enumerate(steps_data):
            st = Text(txt, font_size=15, color=col).move_to(LEFT * 2 + DOWN * (step_area_y + i * 0.4))
            if len(visible_steps) >= 3:
                old = visible_steps.pop(0)
                self.play(FadeOut(old), Write(st))
            else:
                self.play(Write(st))
            visible_steps.append(st)
            if i == 2:
                box = SurroundingRectangle(st, color=YELLOW, buff=0.08)
                note = Text("(key!)", font_size=11, color=YELLOW).next_to(box, RIGHT, 0.1)
                self.play(Create(box), FadeIn(note))
            self.wait(0.3)

        self.wait(0.5)

        # Clean up and show summary
        to_remove = VGroup(*visible_steps, overview)
        self.play(FadeOut(to_remove))
        result = Text("Key takeaway: what to remember", font_size=16, color=GREEN).move_to(DOWN * 2.5)
        self.play(Write(result))
        self.wait(1.5)

INSTRUCTIONS:
- Pick the template (A, B, or C) that best fits the concept, or combine elements
- Replace ALL placeholder text with specific content about the given concept
- Use real values, real examples, real step descriptions - be educational
- You may use up to 20 self.play() calls for a detailed animation
- Add self.wait(0.3-0.5) between logical sections so viewers can read
- A working detailed animation is the goal. Keep code syntax simple and correct.`;

function cleanManimCode(raw: string): string {
  let code = raw;

  // 1) 去 markdown 围栏
  code = code.replace(/^```python\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  code = code.replace(/^```\s*\n?/, "").replace(/\n?```\s*$/, "");
  code = code.trim();

  // 2) 确保类名为 ConceptScene
  if (!code.includes("ConceptScene") && code.includes("(Scene)")) {
    code = code.replace(/class\s+\w+\(Scene\)/, "class ConceptScene(Scene)");
  }
  if (!code.includes("ConceptScene")) {
    if (code.includes("def construct(self)")) {
      code = `from manim import *\n\nclass ConceptScene(Scene):\n    ${code.split("\n").join("\n    ")}`;
    } else {
      return SAFE_FALLBACK_CODE;
    }
  }

  // 3) 确保有 from manim import *
  if (!code.includes("from manim import")) {
    code = "from manim import *\nimport numpy as np\n\n" + code;
  }

  // 4) 关键：所有字符串字面量中只保留 ASCII 可打印字符
  //    处理 Text("...")、Text('...')、Text(f"...")、f"..."等各种模式
  //    unicode 箭头(→)、中文、特殊符号全部替换为 ASCII 等价
  const sanitizeStr = (s: string) => {
    return s
      .replace(/\u2192/g, "->")
      .replace(/\u2190/g, "<-")
      .replace(/\u2194/g, "<->")
      .replace(/\u2264/g, "<=")
      .replace(/\u2265/g, ">=")
      .replace(/\u2260/g, "!=")
      .replace(/\u00d7/g, "x")
      .replace(/\u00f7/g, "/")
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  };

  // 4a) 处理 Text("...") 和 Text('...')
  code = code.replace(/Text\(["']([^"']*?)["']/g, (_match, content: string) => {
    const safe = sanitizeStr(content) || "Concept";
    return `Text("${safe}"`;
  });

  // 4b) 处理 Text(f"...") — f-string
  code = code.replace(/Text\(f["']([^"']*?)["']/g, (_match, content: string) => {
    const safe = sanitizeStr(content) || "Concept";
    return `Text(f"${safe}"`;
  });

  // 4c) 最后兜底：扫描所有 Python 字符串字面量，删除非 ASCII 字符
  //     匹配引号内含非 ASCII 的字符串
  code = code.replace(/(["'])([^"']*?[^\x00-\x7F][^"']*?)\1/g, (_match, quote: string, content: string) => {
    const safe = sanitizeStr(content) || "text";
    return `${quote}${safe}${quote}`;
  });

  // 5) 把 MathTex 全部替换为 Text（避免 LaTeX 编译失败，这是最常见崩溃源）
  code = code.replace(/MathTex\(r?["']([^"']*?)["']/g, (_match, content: string) => {
    // 把 LaTeX 内容简化为纯文本显示
    const simplified = content
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
      .replace(/\\log/g, "log")
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/[{}^_]/g, "")
      .replace(/[^\x20-\x7E]/g, "")
      .trim() || "formula";
    return `Text("${simplified}", font_size=24`;
  });

  // 5b) 把 Arrow() 替换为 Line().add_tip()（Arrow 在某些参数下会崩溃）
  code = code.replace(/Arrow\(([^)]+)\)/g, "Line($1).add_tip(tip_length=0.2)");

  // 6) 安全阀：超过 35 个 play 才截断（剧本驱动，一般不会触发）
  const playCount = (code.match(/self\.play\(/g) || []).length;
  if (playCount > 35) {
    const lines = code.split("\n");
    const constructIdx = lines.findIndex((l) => l.includes("def construct(self)"));
    if (constructIdx >= 0) {
      let playsSeen = 0;
      let cutIdx = lines.length;
      for (let i = constructIdx + 1; i < lines.length; i++) {
        if (lines[i].includes("self.play(")) {
          playsSeen++;
          if (playsSeen > 30) { cutIdx = i; break; }
        }
      }
      const indent = lines[constructIdx + 1]?.match(/^(\s*)/)?.[1] || "        ";
      code = lines.slice(0, cutIdx).join("\n") + `\n${indent}self.wait(1.5)`;
    }
  }

  // 7) 树/图结构防溢出：把 DOWN*N (N>3.0) 等比压缩到安全范围内
  const downMatches = code.match(/DOWN\s*\*\s*(\d+\.?\d*)/g) || [];
  const maxDown = downMatches.reduce((max, m) => {
    const val = parseFloat(m.replace(/DOWN\s*\*\s*/, ""));
    return val > max ? val : max;
  }, 0);
  if (maxDown > 3.0) {
    const ratio = 2.8 / maxDown;
    code = code.replace(/DOWN\s*\*\s*(\d+\.?\d*)/g, (_match, numStr) => {
      const compressed = (parseFloat(numStr) * ratio).toFixed(2);
      return `DOWN * ${compressed}`;
    });
    // 同样压缩 UP*N 以保持对称
    const upMatches = code.match(/UP\s*\*\s*(\d+\.?\d*)/g) || [];
    const maxUp = upMatches.reduce((max, m) => {
      const val = parseFloat(m.replace(/UP\s*\*\s*/, ""));
      return val > max ? val : max;
    }, 0);
    if (maxUp > 3.0) {
      const upRatio = 2.8 / maxUp;
      code = code.replace(/UP\s*\*\s*(\d+\.?\d*)/g, (_match, numStr) => {
        const compressed = (parseFloat(numStr) * upRatio).toFixed(2);
        return `UP * ${compressed}`;
      });
    }
  }

  return code;
}

// 保底安全代码：绝对能渲染成功的极简动画
const SAFE_FALLBACK_CODE = `from manim import *
import numpy as np

class ConceptScene(Scene):
    def construct(self):
        title = Text("Concept Animation", font_size=36, color=BLUE)
        self.play(Write(title))
        self.wait(2)
`;

// ======================== 两阶段生成架构 ========================
// Stage 1: 生成剧本（结构化 JSON）— 规划动画内容、步骤、时长
// Stage 2: 根据剧本生成 Manim 代码 — 严格按剧本实现

const STAGE1_SYSTEM = `You are an animation director. Given a concept, you create a detailed storyboard for a Manim educational animation.

Output a JSON object (no markdown, no explanation) with this exact structure:
{
  "title": "English title of the concept",
  "type": "algorithm|comparison|architecture|process|data_structure",
  "total_plays": <number 15-30, based on complexity>,
  "estimated_seconds": <number 20-50>,
  "sections": [
    {
      "name": "section name",
      "purpose": "what this section teaches the viewer",
      "subtitle": "SHORT explanation for this section (English, MAX 45 chars! Split long text with newline)",
      "visual": "what shapes/elements to CREATE in this section (be specific)",
      "enter": ["list of element names that APPEAR in this section"],
      "exit": ["list of element names to REMOVE before next section starts"],
      "plays": <number of self.play() calls for this section>
    }
  ],
  "layout": {
    "main_visual": "description of the central diagram (graph/array/tree/layers)",
    "main_position": "UP*0.5 or CENTER",
    "subtitle_position": "DOWN*3.2"
  },
  "key_values": ["specific data values, node labels, or step descriptions to use"],
  "conclusion": "the key takeaway sentence (English, max 60 chars)"
}

CRITICAL RULES:
- Each section has a "subtitle" field: a SHORT explanation sentence that acts as narration for that section
- Each section has "enter" (what appears) and "exit" (what disappears at the END of this section)
- The "exit" list is MANDATORY: every section must clean up its annotations/step-text before the next section
- Only persistent elements (like the main graph/array structure) can stay across sections
- If the concept compares 2+ things (A vs B), you MUST have separate sections for EACH, plus a comparison section
- total_plays = sum of all sections' plays
- Be SPECIFIC in "visual" - say "6 nodes labeled A-F with weighted edges" not just "a graph"
- All text content must be in English (translate Chinese concepts)
- Sections: 3-5 for simple concepts, 5-7 for comparisons`;

const STAGE2_SYSTEM = `You are a Manim CE v0.18 code generator. You receive a storyboard JSON and convert it into working Python code.

ABSOLUTE RULES (violating any = render failure):
1. First line: from manim import *
2. Class: class ConceptScene(Scene):
3. All Text() must be ASCII English only. NO unicode, NO Chinese characters.
4. Do NOT use MathTex. Use Text() for formulas.
5. Do NOT use Arrow(). Use Line().add_tip(tip_length=0.2) instead.
6. NO loops containing self.play(). Unroll all loops explicitly.
7. Only use SAFE APIs: Text, Square, Circle, Rectangle, Line, VGroup, SurroundingRectangle, Brace, Dot, FadeIn, FadeOut, Write, Create, Transform, ReplacementTransform, Indicate, self.play, self.wait, .animate, .set_fill, .set_stroke, .arrange, .next_to, .move_to, .to_edge, .shift, .scale, .set_color, .add_tip

=== SUBTITLE SYSTEM (CRITICAL) ===
Each section in the storyboard has a "subtitle" field. You MUST implement it like this:

    # --- Section: [name] ---
    subtitle_X = Text("[short subtitle, max 45 chars]", font_size=20, color=GREY_B).move_to(DOWN * 3.3)
    self.play(FadeIn(subtitle_X))
    # ... section animations here ...
    self.wait(1.0)  # let viewer read the subtitle
    self.play(FadeOut(subtitle_X))  # ALWAYS remove subtitle before next section

SUBTITLE RULES:
- font_size MUST be 20 (not smaller! small sizes cause letter-spacing bugs)
- Max 45 characters per subtitle. If longer, split into 2 lines using "\\n"
- Position: ALWAYS at DOWN * 3.3 (bottom of screen)
- Color: GREY_B for readability without distraction

Pattern for EVERY section:
1. FadeOut ALL elements from previous section first (subtitle + annotations + highlights)
2. FadeIn new subtitle
3. Do section animations
4. self.wait(1.0) for reading time
5. FadeOut subtitle + FadeOut all section-specific elements

=== CLEANUP RULES (PREVENTS OVERLAPPING - HIGHEST PRIORITY) ===
- BEFORE starting a new section: FadeOut EVERYTHING from the previous section (subtitle, annotations, highlights, temporary shapes)
- The ONLY elements that persist across sections: title bar, and the main structure (graph nodes/edges, array boxes)
- NEVER leave annotation text, step labels, or highlights visible when moving to next section
- Use VGroup to group ALL temporary elements per section:
    sec1_group = VGroup(subtitle_1, annotation_1, highlight_1)
    self.play(FadeOut(sec1_group))  # clean ALL at once before next section
- If a node color was changed for highlighting, reset it: node.animate.set_fill(original_color)
- EVERY section must start clean and end clean. Think of each section as a fresh slide.

=== LAYOUT RULES (HIGHEST PRIORITY - off-screen = broken animation) ===
- Scene bounds: x:[-6,6], y:[-3.5,3.5]. NOTHING may appear outside these bounds.
- Title: .scale(0.5).to_edge(UP) after Write
- Main visual (graph/array): place at storyboard "main_position", typically UP*0.3 or CENTER
- Subtitles: ALWAYS at DOWN*3.2, font_size=14, color=GREY_B
- Annotations near shapes: font_size 11-12, max 15 chars, buff=0.15
- TREE STRUCTURES:
  * Root at y=2.0, level spacing = 1.0-1.2 units vertically
  * Max 4 visible levels (y=2.0 -> y=0.8 -> y=-0.4 -> y=-1.6)
  * Node radius: 0.2-0.25, font_size inside nodes: 14-16
  * If tree is too large, use .scale(0.75) on the VGroup and re-center with .move_to(ORIGIN)
  * ALWAYS check: lowest node y must be > -3.0
- Graph nodes: radius 0.2-0.25, spacing >= 1.0 units
- Array boxes: 0.55 wide, max 8 visible

=== QUALITY ===
- Follow storyboard sections IN ORDER
- Match play count per section (within +/- 2)
- Use colors: GREEN=done, RED=problem, YELLOW=current, BLUE=info
- Each section should be visually CLEAN - no leftover elements from previous sections

Output ONLY the Python code. No explanation, no markdown fences.`;

async function generateManimCode(node: {
  name: string;
  description: string;
  keywords: string[];
  subjectName?: string;
}): Promise<string> {
  const client = getClient();
  const model = process.env.MANIM_AI_MODEL || "deepseek-chat";

  // ========== Stage 1: 生成剧本 ==========
  const stage1Prompt = `Concept (may be Chinese, output must be English):
- Name: ${node.name}
- Description: ${node.description}
- Keywords: ${node.keywords.join(", ")}
- Subject: ${node.subjectName || "Computer Science"}

Create a detailed storyboard JSON for this concept's educational animation.`;

  let storyboard: string;
  try {
    const s1 = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: STAGE1_SYSTEM },
        { role: "user", content: stage1Prompt },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    }, { timeout: 30000 });

    storyboard = s1.choices[0]?.message?.content || "";
    // 清理可能的 markdown 围栏
    storyboard = storyboard.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    // 验证是有效 JSON
    JSON.parse(storyboard);
    console.log("[manim-video] Stage 1 剧本生成完成, length=", storyboard.length);
  } catch (err) {
    console.warn("[manim-video] Stage 1 失败, 使用简化流程:", err instanceof Error ? err.message : "");
    // 降级：直接用单阶段生成
    storyboard = JSON.stringify({
      title: node.name,
      type: "process",
      total_plays: 16,
      sections: [{ name: "Overview", purpose: "explain the concept step by step", visual: "text steps", plays: 16, cleanup: false }],
      layout: { main_visual: "steps", main_position: "CENTER", text_position: "DOWN*2.5+LEFT*3" },
      key_values: node.keywords,
      conclusion: "Key concept explained"
    });
  }

  // ========== Stage 2: 根据剧本生成代码 ==========
  const stage2Prompt = `Here is the storyboard for the animation. Convert it to Manim Python code exactly following this plan:

${storyboard}

Generate the complete Python code now. Remember: ALL text in English, no MathTex, no Arrow(), no loops with self.play().`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const s2 = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: STAGE2_SYSTEM },
          { role: "user", content: stage2Prompt },
        ],
        temperature: attempt === 0 ? 0.2 : 0.4,
        max_tokens: 6000,
      }, { timeout: 60000 });

      const raw = s2.choices[0]?.message?.content || "";
      if (!raw.trim()) continue;

      const code = cleanManimCode(raw);
      if (code.includes("ConceptScene") && code.includes("def construct")) {
        return code;
      }
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }

  throw new Error("多次尝试后仍未能生成有效的 Manim 代码");
}

async function renderVideo(
  code: string,
  nodeId: string
): Promise<{ videoUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let res: Response;
  try {
    res = await fetch(`${MANIM_SERVICE_URL}/v1/video/rendering`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        file_class: "ConceptScene",
        file_name: `node_${nodeId}_${Date.now()}`,
        aspect_ratio: "16:9",
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Manim 渲染超时（90s），动画可能过于复杂");
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[manim-video] 渲染失败原始响应:", text.slice(0, 2000));

    // 尝试解析 JSON 错误
    let errorDetail = "";
    try {
      const errJson = JSON.parse(text);
      errorDetail = errJson.error || errJson.message || text;
    } catch {
      errorDetail = text;
    }

    // 过滤进度条、click 警告等无用输出，提取真正错误
    const lines = errorDetail.split(/\\n|\n/);
    const meaningful = lines.filter(
      (l: string) =>
        l.trim() &&
        !l.includes("is used more than once") &&
        !l.includes("self.make_parser") &&
        !l.includes("super().parse_args") &&
        !l.includes("Animation ") &&
        !/\d+%\|/.test(l) &&
        !/\u2588/.test(l) &&
        !/it\/s\]/.test(l)
    );

    // 找 Python traceback 相关行
    const traceLines = lines.filter(
      (l: string) => l.includes("Error") || l.includes("error") || l.includes("Traceback") || l.includes("File ")
    );

    const summary = (traceLines.length > 0 ? traceLines : meaningful).join("\n").trim();
    throw new Error(
      `动画渲染失败: ${summary.slice(0, 300) || "渲染服务内部错误，请重试"}`
    );
  }

  const data = await res.json();

  // The API may return the video URL in different fields depending on version
  const videoUrl =
    data.video_url || data.videoUrl || data.url || data.video || null;

  if (!videoUrl) {
    throw new Error(
      "渲染服务未返回视频 URL，响应: " + JSON.stringify(data).slice(0, 300)
    );
  }

  // If URL is relative, prepend the service base
  const fullUrl = videoUrl.startsWith("http")
    ? videoUrl
    : `${MANIM_SERVICE_URL}${videoUrl.startsWith("/") ? "" : "/"}${videoUrl}`;

  return { videoUrl: fullUrl };
}

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "manim-video", POLICIES.manim);
  if (limited) return limited;
  try {
    const body = await req.json();
    const { nodeId, name, description, keywords, subjectName } = body;

    if (!nodeId || !name) {
      return NextResponse.json(
        { error: "缺少必要参数 nodeId / name" },
        { status: 400 }
      );
    }

    // Step 1: Generate Manim code via AI
    const code = await generateManimCode({
      name,
      description: description || name,
      keywords: keywords || [],
      subjectName,
    });
    const preamble = `config.pixel_height = 720\nconfig.pixel_width = 1280\nconfig.frame_rate = 24\n\n`;
    const renderCode = preamble + code;
    console.log("[manim-video] 生成代码 for", nodeId, "plays=", (code.match(/self\.play\(/g) || []).length);

    // Step 2: Render video (with fallback retry on failure)
    let videoUrl: string;
    let isFallback = false;
    try {
      ({ videoUrl } = await renderVideo(renderCode, nodeId));
    } catch (renderErr) {
      console.warn("[manim-video] 首次渲染失败，使用保底动画:", renderErr instanceof Error ? renderErr.message.slice(0, 200) : "");
      ({ videoUrl } = await renderVideo(preamble + SAFE_FALLBACK_CODE, nodeId + "_fb"));
      isFallback = true;
    }

    return NextResponse.json({ videoUrl, code, isFallback, _v: "2026-06-28-v3" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    console.error("[manim-video] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
