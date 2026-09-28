<div align="center">

# Nexiova

**An AI-native learning operating system that turns human knowledge into a navigable universe.**

*Nexus (connection) × Nova (a new star is born). Every time you connect two ideas, a new star lights up.*

[Live Demo](https://qicheng-phi.vercel.app) · [中文说明](#中文说明) · [Roadmap](#roadmap) · [Contributing](#contributing)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript) ![Three.js](https://img.shields.io/badge/Three.js-r170-000?logo=three.js) ![License: MIT](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Why this exists

Most "AI learning" products are a chat box with a syllabus stapled on. They optimize for *engagement*, not *mastery*. You finish feeling entertained and knowing nothing you could defend under questioning.

We believe the opposite is possible: an AI system that treats knowledge as **structured, interconnected, and verifiable**, teaches with the rigor of a great tutor, and adapts to what *you* are actually trying to build — whether that's passing an exam, shipping a product, or understanding how a CPU works line by line.

Nexiova is our attempt to build that system in the open.

## The idea in one picture

```
                    ┌─────────────────────────────────────┐
                    │        KNOWLEDGE UNIVERSE           │
                    │  36 disciplines · 423+ nodes         │
                    │  prerequisites · cross-links · depth │
                    └──────────────┬──────────────────────┘
                                   │ anchors every plan to real nodes
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
A hand-curated, AI-extended knowledge graph across **36 disciplines** (CS, mathematics, physics, economics, design, law, linguistics, film…) with **423+ nodes**, each carrying prerequisites, follow-ups, and a *learning specification* (what "understanding this" actually means, layered from intuition → formalism → application). Rendered as an interactive 3D starfield (Three.js) where learned nodes light up.

### 2. Plan Universe — your constellation
A conversational onboarding collects your goal, starting point, time budget, rhythm, and constraints, then generates a **day-by-day plan** anchored to real nodes in the Knowledge Universe. Each plan becomes a *small universe* — a private constellation of stars that ignite as you complete tasks.

Tasks are typed:
- **`learn`** → "Star-core exploration": card-based, step-by-step mastery of a single node, with prerequisite chain shown up front.
- **`do`** → "Task workstation": a three-pane workspace (steps · guided cards · notes/AI Q&A) for building things with what you just learned.

### 3. Learning Engine — how it teaches
- **Stimulus protocol**: the AI emits structured segments (`[[HOOK]]`, `[[TEACH]]`, `[[PREDICT]]`, `[[QUIZ]]`, `[[CODE]]`, `[[DERIVE]]`, `[[SUMMARY]]`, …). The client renders each as a card and *blocks* until you interact. No wall of text, no answers given before you try.
- **Deepening system**: for programming, core code is walked **line by line**; for mathematics, derivations are walked **step by step**. Wrong answers trigger targeted re-teaching, not a shrug and "next".
- **Discipline templates**: content specs built on Bloom's Taxonomy, the 5E instructional model, and Polya's problem-solving stages, so depth is systematic rather than incidental.
- **Adaptive closing**: you don't "earn" a mindset badge for showing up — the AI evaluates your summary honestly and loops back if it's shallow.

### 4. Growth Ledger — honest metrics
Single source of truth for task completion, unified streak logic, ability points on a decaying curve, milestones that fire from real events. No fabricated "you learned 47 things today".

### 5. Notes, Q&A, Visuals
Message-style notes (zero Markdown friction) attached to every node and task; an always-available AI tutor in a resizable side panel; and an optional **Manim** service that generates animated explanations on demand.

### 6. Platform
Next.js 16 App Router · React 19 · TypeScript · Tailwind · Three.js · Zod-validated API routes · OpenAI-compatible LLM backend (DeepSeek by default, swappable) · Supabase schema for cloud persistence · Dockerized Manim renderer · deployed on Vercel.

## Roadmap

**Near term (months)**
- Cloud persistence (Supabase auth + sync) replacing the current local-first storage
- Content asset pipeline: automated factual verification + authoritative source anchoring per node
- Misconception database wired into `[[QUIZ]]` distractors
- Expand the graph past 1,000 nodes with community-reviewed discipline templates

**Medium term**
- Spaced repetition driven by the same node graph (review the star before it dims)
- Plan → portfolio: every `do` task produces a shareable artifact
- Multi-agent tutoring: a *teacher* agent, a *reviewer* agent, and a *Socratic* agent, orchestrated per learning style
- Open the stimulus protocol as a spec so any LLM/any client can implement it

**Long term — the full ecosystem**
- **Open Knowledge Universe**: a public, versioned, contributor-maintained graph of human knowledge with learning specs — the "OpenStreetMap of what there is to learn"
- **Learning OS**: plans, notes, progress and credentials that belong to the learner and travel across tools
- **Curriculum-as-code**: institutions and communities publish plan templates that compile against the shared graph
- **Verified mastery**: portable, evidence-backed proof of understanding (what you derived, what you built, what you explained) instead of certificates of attendance

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
    api/                LLM-backed routes (onboarding, plan/generate, node-learn, task-chat, manim-video, …)
  components/
    stimulus/           card renderers for the stimulus protocol
    learn/              line-by-line DeriveCard, code walkthroughs
    universe/           Three.js scene, CyberCore, overlays
    notes/              message-style note panel
  lib/
    universe/           graph store, plan↔node linking, small universes
    plan/               plan types, completion authority, daily scheduler
    stimulus/           protocol parser, script composer, rewards
    learn/              discipline templates & learning specs
    habit/ profile/     streaks, ability vectors, milestones
  data/knowledge-graph/ 36 discipline JSON files (the universe itself)
supabase/               SQL migrations for cloud persistence
prompts/                versioned prompt library
scripts/                graph generation & validation
```

## Contributing

The most valuable contributions right now:
1. **Knowledge nodes** — add or deepen a discipline in `src/data/knowledge-graph/`. Run `node scripts/validate-graph.js`.
2. **Learning specs** — write the layered "what mastery means" for existing nodes (see [`docs/学科深度学习内容规格系统.md`](./docs/学科深度学习内容规格系统.md) for the template).
3. **Stimulus cards** — new interaction types in `components/stimulus/`.
4. **Translations** — the engine is language-agnostic; the content is currently Chinese-first.

Open an issue before large changes. PRs must pass `npx tsc --noEmit`.

## License

MIT — see [LICENSE](./LICENSE).

---

<a id="中文说明"></a>

## 中文说明

### Nexiova 是什么

Nexiova = **Nexus（连接）× Nova（新星诞生）**。知识连接知识，思想连接思想，人与 AI 连接。每一次连接，都会点亮一颗新的星。

这是一个 **AI 原生的学习操作系统**。我们把人类知识做成一张可以在里面航行的"宇宙"，让 AI 像一位真正严谨的私教那样，按你的目标、起点和节奏，一步一步带你走到**真正掌握**，而不是"看过、觉得懂了"。

### 我们在解决什么问题

市面上大多数"AI 学习"产品，本质是一个聊天框加一份大纲。它们优化的是"用户停留时长"，不是"用户真的学会了"。学完之后很热闹，追问两句就露底。

我们相信另一条路是可能的：知识必须是**结构化、有前置关系、可验证**的；教学必须**一步一卡、先猜再讲、答错回炉**；系统必须知道你**到底想干什么**——是考试、做产品，还是想把 CPU 的每一行原理搞明白。

### 我们构建的全生态

| 层 | 名称 | 作用 |
|---|---|---|
| 地图 | **知识宇宙** | 36 个学科、423+ 节点，每个节点带前置/后继关系和分层"学习规格"（直觉 → 形式化 → 应用）。3D 星图，学会的节点会亮起。 |
| 导航 | **计划宇宙** | 对话式引导采集目标/起点/时间/节奏，生成锚定在真实节点上的**按天计划**。每份计划是一个"小宇宙"，任务完成即点亮星。任务分 **学（learn）** 和 **做（do）** 两类。 |
| 引擎 | **学习引擎** | 刺激协议（`[[HOOK]]` `[[TEACH]]` `[[QUIZ]]` `[[CODE]]` `[[DERIVE]]` …）→ 卡片式逐步推进，答错触发针对性重讲。编程**逐行推代码**，数学**逐步推公式**。学科模板基于 Bloom 分类、5E 模型、Polya 解题四步。 |
| 账本 | **成长系统** | 唯一的任务完成权威源、统一 streak、递减曲线的能力点、由真实事件触发的里程碑。不造假数据。 |
| 工具 | **笔记 · 答疑 · 可视化** | 消息式笔记零门槛、随时可用的 AI 答疑侧栏、按需生成的 Manim 动画讲解。 |

### 未来目标

- **近期**：Supabase 云端持久化；内容资产化（自动事实核查 + 权威来源锚定）；误区数据库接入选择题干扰项；知识图谱扩展到 1000+ 节点。
- **中期**：基于同一张图的间隔重复；每个"做"任务产出可分享作品；多智能体私教（讲授 / 审阅 / 苏格拉底式追问）；把刺激协议开放为规范，任何模型、任何客户端都能实现。
- **长期 — 完整生态**：
  - **开放知识宇宙**：一张公开、可版本化、社区维护的人类知识图谱，附带学习规格——"学习领域的 OpenStreetMap"。
  - **学习操作系统**：计划、笔记、进度、能力凭证归学习者所有，可跨工具迁移。
  - **课程即代码**：机构与社区发布计划模板，编译到共享图谱上。
  - **可验证的掌握**：用"你推导了什么、构建了什么、讲清了什么"作为证据，替代"到课证明"。

### 参与贡献

最需要的贡献：新增/深化学科节点（`src/data/knowledge-graph/`）、为现有节点撰写分层学习规格（模板见 [`docs/学科深度学习内容规格系统.md`](./docs/学科深度学习内容规格系统.md)）、新的刺激卡片类型、多语言内容。

大改动请先开 issue。PR 需通过 `npx tsc --noEmit`。
