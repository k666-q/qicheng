<div align="center">

# Nexiova

**An AI-native learning operating system that turns human knowledge into a navigable universe — and models how you think as you travel it.**

*Nexus (connection) × Nova (a new star is born). Every time you connect two ideas, a new star lights up.*

[Live Demo](https://qicheng-phi.vercel.app) · [中文说明](#中文说明) · [Cognition Engine](#3-cognition-engine--the-part-nobody-else-has) · [Roadmap](#roadmap) · [Contributing](#contributing)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript) ![Three.js](https://img.shields.io/badge/Three.js-r170-000?logo=three.js) ![License: MIT](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Why this exists

Most "AI learning" products are a chat box with a syllabus stapled on. They optimize for *engagement*, not *mastery*. You finish feeling entertained and knowing nothing you could defend under questioning.

We believe the opposite is possible: an AI system that treats knowledge as **structured, interconnected, and verifiable**, teaches with the rigor of a great tutor, and adapts to what *you* are actually trying to build — whether that's passing an exam, shipping a product, or understanding how a CPU works line by line.

And one thing further, which no existing platform does: the system should learn **how you think** — not just what you've read — and let that model drive every plan, every card, every "go back and fix this first".

Nexiova is our attempt to build that system in the open.

## The idea in one picture

```
                    ┌─────────────────────────────────────┐
                    │        KNOWLEDGE UNIVERSE           │
                    │  36 disciplines · 423+ nodes         │
                    │  prerequisites · cross-links · depth │
                    │  cognition tags on every node        │
                    └──────────────┬──────────────────────┘
                                   │ every node carries cognitive weight
                                   ▼
                    ┌─────────────────────────────────────┐
                    │         COGNITION ENGINE            │
                    │  6-dim cognitive vector · debt ledger│
                    │  learner traits · gap diagnosis      │
                    └──────────────┬──────────────────────┘
                                   │ shapes plan, teaching, and proof
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │  PLAN UNIVERSE   │ │ LEARNING ENGINE  │ │  GROWTH LEDGER   │
   │ your goal → a    │ │ card-based, step │ │ streaks, badges, │
   │ personal constel-│ │ -by-step, 30+    │ │ ability vectors, │
   │ lation of tasks  │ │ stimulus types   │ │ honest metrics   │
   └──────────────────┘ └──────────────────┘ └──────────────────┘
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   ▼
                     ┌─────────────────────────┐
                     │   NOTES · Q&A · MANIM    │
                     │ message-style notes, AI  │
                     │ tutor, generated visuals │
                     └─────────────────────────┘
```

## What's built today

### 1. Knowledge Universe — the map
A hand-curated, AI-extended knowledge graph across **36 disciplines** (CS, mathematics, physics, economics, design, law, linguistics, film…) with **423+ nodes**, each carrying prerequisites, follow-ups, difficulty, **cognition tags**, and a *learning specification* (what "understanding this" actually means, layered from intuition → formalism → application, grounded in CS2023, Bloom's revised taxonomy, the 5E model and Polya's stages). Rendered as an interactive 3D starfield (Three.js) where learned nodes light up.

### 2. Plan Universe — your constellation
A conversational onboarding collects your goal, starting point, time budget, rhythm, and stages, then generates a **day-by-day plan** anchored to real nodes in the Knowledge Universe. Each plan becomes a *small universe* — a private constellation of stars that ignite as you complete tasks.

Tasks are typed:
- **`learn`** → "Star-core exploration": card-based, step-by-step mastery of a single node, with prerequisite chain shown up front.
- **`do`** → "Task workstation": a three-pane workspace (steps · guided cards · notes/AI Q&A) for building things with what you just learned.

The plan interleaves them deliberately: learn the concept, use it, then return to the main line of what you're actually trying to ship.

### 3. Cognition Engine — the part nobody else has

> **Status: foundation live, full system in active development.** This is the core of the project.

Every learning platform on Earth — Coursera, Khan, Duolingo, Notion-with-a-chatbot — tracks the same thing: **content consumed**. None of them know that you grasp recursion through analogy but freeze on formal induction; that your systems thinking is strong but modeling a messy problem into equations is the real bottleneck; that the "cognitive debt" you took on three weeks ago in linear algebra is why today's machine-learning lesson isn't landing.

Nexiova's premise: **knowledge is a graph, and cognition is a vector field over that graph.** Learn a node and you don't just tick a box — you change the shape of a live model of your mind.

**Live today**
- **Six-dimensional cognitive vector** — abstract thinking, logical reasoning, systems thinking, modeling, expression, aesthetic perception. A pure function over mastered nodes weighted by difficulty and cognition tags. No hand-wavy "XP"; the number is derivable from the graph.
- **Cognitive layers in every spec** — each node's learning spec is a gated ladder of Bloom levels; you don't reach L3 (apply) until L2 (explain) is verified.
- **Cognitive debt & seeds** — when the tutor detects a gap it can't fix in-flow, it issues a *debt* (an IOU on a prerequisite) or a *seed* (an idea to revisit in three days) instead of pretending you understood.
- **Learning-style traits** — analogy-first vs. step-first, sticking-point types, understanding style — captured from real interaction, not a questionnaire.

**Being built**
- **Gap diagnosis** — when a quiz fails, trace the failure back through the prerequisite graph to the *actual* missing node, not the one you happened to be on.
- **Transfer detection** — notice when you've mastered the same cognitive move in two disciplines (recursion in CS ↔ induction in math ↔ compound interest in finance) and surface the link explicitly.
- **Debt-aware planning** — the planner reads the debt ledger and schedules repayment before the lesson that depends on it.
- **Adaptive protocol** — card types chosen per learner: more `[[PREDICT]]` for someone who over-trusts intuition, more `[[DERIVE]]` for someone who skips formalism.
- **A portable cognitive twin** — an open, learner-owned representation of "how this person thinks", exportable and usable by any tool that speaks the spec.

Content platforms compete on *how much* they have. Nexiova competes on *how well it knows the learner*. That is a different axis, and it compounds: the more you learn, the sharper the model; the sharper the model, the better the next lesson; the better the lesson, the faster you learn.

### 4. Learning Engine — how it teaches
- **Stimulus protocol**: the AI emits structured segments (`[[HOOK]]`, `[[TEACH]]`, `[[PREDICT]]`, `[[QUIZ]]`, `[[CODE]]`, `[[DERIVE]]`, `[[DEBT]]`, `[[SEED]]`, `[[SUMMARY]]`, …). The client renders each as a card and *blocks* until you interact. No wall of text, no answers given before you try.
- **Deepening system**: for programming, core code is walked **line by line**; for mathematics, derivations are walked **step by step**. Wrong answers trigger targeted re-teaching, not a shrug and "next".
- **Discipline templates**: content specs built on Bloom's Taxonomy, the 5E instructional model, and Polya's problem-solving stages, so depth is systematic rather than incidental.
- **Adaptive closing**: you don't "earn" a mindset badge for showing up — the AI evaluates your summary honestly and loops back if it's shallow.

### 5. Growth Ledger — honest metrics
Single source of truth for task completion, unified streak logic, ability points on a decaying curve, milestones that fire from real events. No fabricated "you learned 47 things today". If a number can't be derived from evidence, it isn't shown.

### 6. Notes, Q&A, Visuals
Message-style notes (zero Markdown friction) attached to every node and task; an always-available AI tutor in a resizable side panel; and an optional **Manim** service that generates animated explanations on demand.

### 7. Platform
Next.js 16 App Router · React 19 · TypeScript · Tailwind · Three.js · Zod-validated API routes · OpenAI-compatible LLM backend (DeepSeek by default, swappable) · Supabase schema for cloud persistence · Dockerized Manim renderer · deployed on Vercel · ~22k lines.

## Roadmap

**Near term (months) — close the cognition loop**
- Gap diagnosis wired into every `[[QUIZ]]` failure
- Debt-aware planner (repay prerequisites before dependent lessons)
- Adaptive protocol: card-type selection driven by the cognitive vector
- Cloud persistence (Supabase auth + sync) so the cognitive model follows you across devices
- Content asset pipeline: automated factual verification + authoritative source anchoring per node; misconception database feeding `[[QUIZ]]` distractors

**Medium term — make it compound**
- Transfer detection across disciplines with explicit cross-links surfaced to the learner
- Spaced repetition driven by the same graph and the same vector (review the star before it dims — and review it *differently* depending on why it dimmed)
- Plan → portfolio: every `do` task produces a shareable artifact tied to the nodes it proves
- Multi-agent tutoring: teacher, reviewer, and Socratic agents orchestrated per cognitive profile
- Expand the graph past 1,000 nodes with community-reviewed discipline templates
- Publish the stimulus protocol and the cognitive-twin format as open specs

**Long term — the full ecosystem**
- **Open Knowledge Universe**: a public, versioned, contributor-maintained graph of human knowledge with learning specs and cognition tags — the "OpenStreetMap of what there is to learn"
- **Cognitive Twin standard**: a learner-owned, portable model of how a person thinks. You take it with you; any tutor, course or tool that speaks the spec adapts to you on day one
- **Learning OS**: plans, notes, progress, debts and credentials that belong to the learner and travel across tools
- **Curriculum-as-code**: institutions and communities publish plan templates that compile against the shared graph and adapt per cognitive twin
- **Verified mastery**: portable, evidence-backed proof of understanding (what you derived, what you built, what you explained, which cognitive dimensions it moved) instead of certificates of attendance

When the graph is open, the protocol is open, and the cognitive model belongs to the learner, "learning platform" stops being a walled garden and becomes infrastructure.

## Getting started

```bash
git clone https://github.com/k666-q/qicheng.git
cd qicheng
npm install
cp .env.example .env.local   # fill in AI_API_KEY (any OpenAI-compatible endpoint)
npm run dev
```

Open http://localhost:3000. The knowledge graph and all learning flows run without a database — state is local-first. Set `MANIM_SERVICE_URL` if you run the optional animation renderer.

## Project structure

```
src/
  app/                  Next.js routes
    universe/           3D knowledge universe + star-core exploration (learn)
    plan/               onboarding → plan detail → task workstation / plan learn
    api/                LLM-backed routes (onboarding, plan/generate, node-learn, node-spec, task-chat, manim-video, …)
  components/
    stimulus/           card renderers for the stimulus protocol
    learn/              line-by-line DeriveCard, code walkthroughs
    universe/           Three.js scene, CyberCore, CognitionPanel
    notes/              message-style note panel
  lib/
    universe/           graph store · cognition.ts (6-dim vector) · plan↔node linking · small universes
    plan/               plan types, completion authority, daily scheduler
    stimulus/           protocol parser, script composer, echo/debt/seed, rewards
    learn/              discipline templates & learning specs
    habit/ profile/     streaks, ability vectors, milestones, learner traits
  data/knowledge-graph/ 36 discipline JSON files (the universe itself)
docs/                   learning-spec system design (contributor template)
supabase/               SQL migrations for cloud persistence
prompts/                versioned prompt library
scripts/                graph generation & validation
```

## Contributing

The most valuable contributions right now:
1. **Knowledge nodes** — add or deepen a discipline in `src/data/knowledge-graph/`; include `cognition_tags`. Run `node scripts/validate-graph.js`.
2. **Learning specs** — write the layered "what mastery means" for existing nodes (see [`docs/学科深度学习内容规格系统.md`](./docs/学科深度学习内容规格系统.md) for the template).
3. **Cognition engine** — gap diagnosis, transfer detection, debt-aware planning. Open an issue first; this is the heart of the system.
4. **Stimulus cards** — new interaction types in `components/stimulus/`.
5. **Translations** — the engine is language-agnostic; the content is currently Chinese-first.

Open an issue before large changes. PRs must pass `npx tsc --noEmit`.

## License

MIT — see [LICENSE](./LICENSE).

---

<a id="中文说明"></a>

## 中文说明

### Nexiova 是什么

Nexiova = **Nexus（连接）× Nova（新星诞生）**。知识连接知识，思想连接思想，人与 AI 连接。每一次连接，都会点亮一颗新的星。

这是一个 **AI 原生的学习操作系统**。我们把人类知识做成一张可以在里面航行的"宇宙"，让 AI 像一位真正严谨的私教那样，按你的目标、起点和节奏，一步一步带你走到**真正掌握**，而不是"看过、觉得懂了"。并且——这是任何现有平台都没有的——系统会在这个过程中建模**你是如何思考的**，用这个模型驱动之后的每一份计划、每一张卡片。

### 我们在解决什么问题

市面上大多数"AI 学习"产品，本质是一个聊天框加一份大纲。它们优化的是"用户停留时长"，不是"用户真的学会了"。学完之后很热闹，追问两句就露底。

我们相信另一条路是可能的：知识必须是**结构化、有前置关系、可验证**的；教学必须**一步一卡、先猜再讲、答错回炉**；系统必须知道你**到底想干什么**——是考试、做产品，还是想把 CPU 的每一行原理搞明白。

### 我们构建的全生态

| 层 | 名称 | 现状 | 作用 |
|---|---|---|---|
| 地图 | **知识宇宙** | 已上线 | 36 个学科、423+ 节点，每个节点带前置/后继关系、**认知标签**和分层"学习规格"（直觉 → 形式化 → 应用）。3D 星图，学会的节点会亮起。 |
| 大脑 | **认知引擎** | 基础已上线，核心在建 | 见下节。 |
| 导航 | **计划宇宙** | 已上线 | 对话式引导采集目标/起点/时间/节奏/阶段，生成锚定在真实节点上的**按天计划**。每份计划是一个"小宇宙"，任务完成即点亮星。任务分 **学（learn）** 和 **做（do）** 两类，交替编排：学概念 → 用概念 → 回到主线。 |
| 引擎 | **学习引擎** | 已上线 | 刺激协议（`[[HOOK]]` `[[TEACH]]` `[[PREDICT]]` `[[QUIZ]]` `[[CODE]]` `[[DERIVE]]` `[[DEBT]]` `[[SEED]]` …）→ 卡片式逐步推进，答错触发针对性重讲。编程**逐行推代码**，数学**逐步推公式**。学科模板基于 Bloom 分类、5E 模型、Polya 解题四步。 |
| 账本 | **成长系统** | 已上线 | 唯一的任务完成权威源、统一 streak、递减曲线的能力点、由真实事件触发的里程碑。算不出来的数字就不显示。 |
| 工具 | **笔记 · 答疑 · 可视化** | 已上线 | 消息式笔记零门槛、随时可用的 AI 答疑侧栏、按需生成的 Manim 动画讲解。 |

### 认知引擎：为什么这是降维打击

地球上所有学习平台——Coursera、可汗、多邻国、任何"Notion + 聊天机器人"——记录的都是同一件事：**消费了多少内容**。没有一个知道你靠类比能懂递归、遇到形式化归纳就卡死；不知道你系统思维很强、但把一个乱糟糟的问题抽象成方程才是真正的瓶颈；不知道你三周前在线性代数欠下的"认知欠条"，正是今天机器学习这节课听不进去的原因。

Nexiova 的前提：**知识是一张图，认知是这张图上的一个向量场。** 你学会一个节点，不是打了个勾，而是改变了一个关于你大脑的实时模型的形状。

**已上线**
- **六维认知向量**：抽象思维、逻辑推理、系统思维、建模能力、表达沟通、审美感知。由已掌握节点按难度和认知标签加权计算的纯函数，不是拍脑袋的"经验值"，每个数都能从图上推出来。
- **认知层门控**：每个节点的学习规格是一条 Bloom 层级的梯子，L2（能解释）没验证通过，就到不了 L3（能应用）。
- **认知欠条与种子**：导师发现当下补不上的缺口时，开一张"欠条"（对某个前置知识的借据）或种一颗"种子"（三天后回访的想法），而不是假装你懂了。
- **学习风格画像**：类比优先还是步骤优先、卡点类型、理解方式——从真实交互中捕获，不靠问卷。

**在建**
- **缺口诊断**：答错时沿前置图谱回溯，找到*真正*缺失的节点，而不是你恰好停在的那个。
- **跨学科迁移识别**：发现你在两个学科掌握了同一个认知动作（CS 的递归 ↔ 数学的归纳 ↔ 金融的复利），并显式呈现这条连线。
- **欠条感知的规划**：规划器读取欠条账本，先排还债，再排依赖它的课。
- **自适应协议**：按人选卡——过度信直觉的人多给 `[[PREDICT]]`，跳过形式化的人多给 `[[DERIVE]]`。
- **可携带的认知孪生**：一份开放的、归学习者所有的"我如何思考"表示，可导出，任何遵循规范的工具都能用。

内容平台比的是**有多少**。Nexiova 比的是**多了解学习者**。这是完全不同的一条轴，而且它会复利：学得越多，模型越准；模型越准，下一次教得越对；教得越对，学得越快。以"内容库"为核心的平台无法在这条轴上竞争，因为它们的数据结构里根本没有"认知"这个东西。

### 未来目标

- **近期 — 闭合认知回路**：每次答错触发缺口诊断；欠条感知的规划器；由认知向量决定卡片类型；Supabase 云端同步让认知模型跨设备；内容资产化（自动事实核查 + 权威来源锚定）；误区数据库接入干扰项。
- **中期 — 让它复利**：跨学科迁移识别；基于同一张图和同一个向量的间隔重复（星星变暗前复习，且**因为什么变暗就用什么方式复习**）；每个"做"任务产出可分享作品；多智能体私教（讲授 / 审阅 / 苏格拉底追问，按认知画像编排）；图谱扩到 1000+ 节点；刺激协议与认知孪生格式发布为开放规范。
- **长期 — 完整生态**：
  - **开放知识宇宙**：公开、可版本化、社区维护的人类知识图谱，附学习规格与认知标签——"学习领域的 OpenStreetMap"。
  - **认知孪生标准**：归学习者所有、可携带的"我如何思考"模型。带着它走，任何遵循规范的导师、课程、工具第一天就能适配你。
  - **学习操作系统**：计划、笔记、进度、欠条、能力凭证归学习者所有，可跨工具迁移。
  - **课程即代码**：机构与社区发布计划模板，编译到共享图谱上，按认知孪生自适应。
  - **可验证的掌握**：以"你推导了什么、构建了什么、讲清了什么、推动了哪些认知维度"作为证据，替代"到课证明"。

图谱开放、协议开放、认知模型归学习者——"学习平台"就不再是围墙花园，而成为基础设施。

### 参与贡献

最需要的贡献：新增/深化学科节点（带 `cognition_tags`，`src/data/knowledge-graph/`）、为现有节点撰写分层学习规格（模板见 [`docs/学科深度学习内容规格系统.md`](./docs/学科深度学习内容规格系统.md)）、认知引擎（缺口诊断 / 迁移识别 / 欠条规划，请先开 issue）、新的刺激卡片类型、多语言内容。

大改动请先开 issue。PR 需通过 `npx tsc --noEmit`。
