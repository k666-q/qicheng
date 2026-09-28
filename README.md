<div align="center">

# Nexiova

**The first learning system that models how you think, not just what you've read.**

*Nexus (connection) × Nova (a new star is born). Every time you connect two ideas, a new star lights up — and the system learns something about your mind.*

[Live Demo](https://qicheng-phi.vercel.app) · [中文说明](#中文说明) · [The Cognition Engine](#3-cognition-engine--the-part-nobody-else-has) · [Roadmap](#roadmap) · [Contributing](#contributing)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript) ![Three.js](https://img.shields.io/badge/Three.js-r170-000?logo=three.js) ![License: MIT](https://img.shields.io/badge/License-MIT-green)

</div>

---

## The thesis

Every learning platform on Earth — Coursera, Khan, Duolingo, Notion-with-a-chatbot — tracks the same thing: **content consumed**. Videos watched, lessons completed, streaks kept. They are, at best, very good bookkeeping for a syllabus.

None of them know *how you think*. None of them know that you grasp recursion through analogy but freeze on formal induction; that your systems-thinking is strong but your ability to model a messy problem into equations is the actual bottleneck; that the "cognitive debt" you took on three weeks ago in linear algebra is why today's machine-learning lesson isn't landing.

Nexiova is built on a different premise: **knowledge is a graph, and cognition is a vector field over that graph.** Learn a node and you don't just tick a box — you change the shape of a live model of your mind. Every plan, every teaching card, every quiz distractor, every "go back and fix this first" is then computed from that model.

That is what we mean by an **AI-native learning operating system**. Not an AI bolted onto a course. A system where the knowledge structure, the teaching protocol, and the cognitive model of the learner are one connected machine — and we are building it in the open.

## The architecture in one picture

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │                        KNOWLEDGE UNIVERSE                            │
 │   36 disciplines · 423+ nodes · prerequisites · cross-discipline     │
 │   links · layered mastery specs (Bloom L1→L6) · cognition tags       │
 └───────────────────────────────┬──────────────────────────────────────┘
                                 │  every node carries cognitive weight
                                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │                        COGNITION ENGINE                              │
 │   6-dim cognitive vector · cognitive debt ledger · learning-style    │
 │   profile · transfer detection · gap diagnosis · adaptive difficulty │
 └──────┬────────────────────────┬──────────────────────────┬───────────┘
        │ shapes the plan        │ shapes the teaching      │ shapes the proof
        ▼                        ▼                          ▼
 ┌──────────────┐     ┌──────────────────────┐     ┌──────────────────┐
 │ PLAN UNIVERSE│     │   LEARNING ENGINE    │     │  GROWTH LEDGER   │
 │ goal → daily │     │ stimulus protocol ·  │     │ honest metrics · │
 │ constellation│     │ blocking cards ·     │     │ evidence-backed  │
 │ learn/do     │     │ line-by-line depth   │     │ mastery          │
 └──────────────┘     └──────────────────────┘     └──────────────────┘
        └────────────────────────┼──────────────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │  NOTES · AI TUTOR · MANIM     │
                  │  message notes · side-panel   │
                  │  Q&A · generated animations   │
                  └───────────────────────────────┘
```

## What's built today

### 1. Knowledge Universe — the map
A curated, AI-extended knowledge graph across **36 disciplines** (CS, mathematics, physics, economics, design, law, linguistics, film, …) with **423+ nodes**. Each node carries prerequisites, follow-ups, difficulty, **cognition tags**, and a *learning specification* — a layered definition of what "understanding this" means, from intuition through formalism to application, grounded in CS2023, Bloom's revised taxonomy, the 5E model and Polya's problem-solving stages. Rendered as an interactive 3D starfield where mastered nodes ignite.

### 2. Plan Universe — your constellation
A conversational onboarding extracts five things every real plan needs (goal, starting point, time budget, rhythm, stages), then generates a **day-by-day plan anchored to real graph nodes**. Each plan becomes a *small universe* — a private constellation that lights up as you go.

Tasks are typed:
- **`learn`** → *Star-core exploration*: card-by-card mastery of one node, prerequisite chain shown first.
- **`do`** → *Task workstation*: a three-pane workspace (steps · guided cards · notes/AI Q&A) for building something with what you just learned.

The plan interleaves them deliberately: learn the concept, then use it, then come back to the main line of what you're actually trying to ship.

### 3. Cognition Engine — the part nobody else has

> **Status: foundation live, full system in active development.** This is the core of the project and the reason it exists.

**Live today**
- **Six-dimensional cognitive vector** — abstract thinking, logical reasoning, systems thinking, modeling, expression, aesthetic perception. Computed as a pure function over the set of mastered nodes weighted by difficulty and cognition tags. No hand-wavy "XP"; the number is derivable from the graph.
- **Cognitive layers in every spec** — each node's learning spec is a gated ladder of Bloom levels; you don't reach L3 (apply) until L2 (explain) is actually verified.
- **Cognitive debt & seeds** — when the tutor detects a gap it can't fix in-flow, it issues a *debt* (an IOU on a prerequisite) or a *seed* (an idea to revisit in three days) rather than pretending you understood.
- **Learning-style traits in the profile** — analogy-first vs. step-first, sticking-point types, understanding style — captured from real interaction, not a questionnaire.

**Being built** (see [Roadmap](#roadmap))
- **Cognitive gap diagnosis** — when a quiz fails, trace the failure back through the prerequisite graph to the *actual* missing node, not the one you happened to be on.
- **Transfer detection** — notice when you've mastered the same cognitive move in two disciplines (recursion in CS ↔ induction in math ↔ compound interest in finance) and surface the cross-discipline link explicitly.
- **Debt-aware planning** — the planner reads the debt ledger and schedules repayment before it schedules the lesson that depends on it.
- **Adaptive protocol** — the stimulus protocol chooses card types per learner: more `[[PREDICT]]` for someone who over-trusts intuition, more `[[DERIVE]]` for someone who skips formalism.
- **A portable cognitive twin** — an open, learner-owned representation of "how this person thinks", exportable and usable by any tool that speaks the spec.

Content platforms compete on *how much* they have. Nexiova competes on *how well it knows the learner*. That is an entirely different axis, and it compounds.

### 4. Learning Engine — how it teaches
- **Stimulus protocol**: the LLM emits structured segments (`[[HOOK]]`, `[[TEACH]]`, `[[PREDICT]]`, `[[QUIZ]]`, `[[CODE]]`, `[[DERIVE]]`, `[[DEBT]]`, `[[SEED]]`, `[[SUMMARY]]` …). The client renders each as a card and **blocks until you interact**. No wall of text. No answers before you commit to one.
- **Depth is non-negotiable**: for programming, core code is walked **line by line**; for mathematics, derivations are walked **step by step**. Wrong answers trigger targeted re-teaching, not "next".
- **Honest closing**: you don't earn a mindset badge for reaching the end. The tutor evaluates your summary and loops back if it's shallow.
- **30+ stimulus types** organised as a method library the composer draws from per node, per discipline, per learner.

### 5. Growth Ledger — honest metrics
Single authoritative source for task completion, unified streak logic, ability points on a decaying curve, milestones fired by real events. No fabricated "you learned 47 things today". If the number can't be derived from evidence, it isn't shown.

### 6. Notes, AI tutor, visuals
Message-style notes (zero Markdown friction) attached to every node and task; a resizable always-on AI tutor panel; an optional **Manim** service that renders animated explanations on demand.

### 7. Platform
Next.js 16 App Router · React 19 · TypeScript · Tailwind · Three.js · Zod-validated API routes · OpenAI-compatible LLM backend (swappable) · Supabase schema for cloud persistence · Dockerized Manim renderer · deployed on Vercel · ~22k lines.

## Roadmap

**Now → 3 months: close the cognition loop**
- Cognitive gap diagnosis wired into every `[[QUIZ]]` failure
- Debt-aware planner (repay prerequisites before dependent lessons)
- Adaptive protocol: card-type selection driven by the cognitive vector
- Supabase auth + sync so the cognitive model persists across devices
- Content asset pipeline: automated fact-checking + authoritative source anchoring per node; misconception database feeding quiz distractors

**3 → 12 months: make it compound**
- Transfer detection across disciplines with explicit cross-links surfaced to the learner
- Spaced repetition driven by the same graph and the same vector (review the star before it dims — and review it *differently* depending on why it dimmed)
- Plan → portfolio: every `do` task produces a shareable artifact tied to the nodes it proves
- Multi-agent tutoring: teacher, reviewer, and Socratic agents orchestrated per cognitive profile
- Knowledge graph past 1,000 nodes with community-reviewed discipline templates
- The stimulus protocol and the cognitive-twin format published as open specs

**The long game: an ecosystem, not an app**
- **Open Knowledge Universe** — a public, versioned, contributor-maintained graph of human knowledge with mastery specs and cognition tags. The OpenStreetMap of what there is to learn.
- **Cognitive Twin standard** — a learner-owned, portable model of how a person thinks. You take it with you. Any tutor, course or tool that speaks the spec adapts to you on day one.
- **Learning OS** — plans, notes, progress, debts and credentials belong to the learner and travel across tools.
- **Curriculum-as-code** — institutions and communities publish plan templates that compile against the shared graph and adapt per cognitive twin.
- **Verified mastery** — evidence-backed proof of understanding (what you derived, built, and explained; which cognitive dimensions it moved) replacing certificates of attendance.

When the graph is open, the protocol is open, and the cognitive model belongs to the learner, "learning platform" stops being a walled garden and becomes infrastructure. That's the goal.

## Getting started

```bash
git clone https://github.com/k666-q/qicheng.git
cd qicheng
npm install
cp .env.example .env.local   # set AI_API_KEY (any OpenAI-compatible endpoint)
npm run dev
```

Open http://localhost:3000. The graph, plans and all learning flows run without a database — state is local-first. Set `MANIM_SERVICE_URL` if you run the optional animation renderer.

## Project structure

```
src/
  app/
    universe/           3D knowledge universe · star-core exploration (learn)
    plan/               onboarding → plan detail → task workstation / plan learn
    api/                LLM routes: onboarding, plan/generate, node-learn, node-spec, task-chat, manim-video …
  components/
    stimulus/           card renderers for the stimulus protocol
    learn/              line-by-line DeriveCard, code walkthroughs
    universe/           Three.js scene, CyberCore, CognitionPanel
    notes/              message-style note panel
  lib/
    universe/           graph store · cognition.ts (6-dim vector) · plan↔node linking · small universes
    stimulus/           protocol parser · script composer · echo/debt/seed · rewards
    learn/              discipline templates & layered learning specs
    plan/               types · completion authority · daily scheduler
    habit/ profile/     streaks · ability curves · milestones · learner traits
  data/knowledge-graph/ 36 discipline JSON files — the universe itself
docs/                   learning-spec system design (the template for contributors)
supabase/               SQL migrations for cloud persistence
prompts/                versioned prompt library
scripts/                graph generation & validation
```

## Contributing

The most valuable contributions right now:
1. **Knowledge nodes** — add or deepen a discipline in `src/data/knowledge-graph/`; include `cognition_tags`. Run `node scripts/validate-graph.js`.
2. **Learning specs** — write the layered "what mastery means" for existing nodes using [`docs/学科深度学习内容规格系统.md`](./docs/学科深度学习内容规格系统.md).
3. **Cognition engine** — gap diagnosis, transfer detection, debt-aware planning. Open an issue first; this is the heart of the system.
4. **Stimulus cards** — new interaction types in `components/stimulus/`.
5. **Translations** — the engine is language-agnostic; content is currently Chinese-first.

Open an issue before large changes. PRs must pass `npx tsc --noEmit`.

## License

MIT — see [LICENSE](./LICENSE).

---

<a id="中文说明"></a>

## 中文说明

### 一句话

**Nexiova 是第一个建模"你如何思考"、而不只是记录"你看过什么"的学习系统。**

Nexus（连接）× Nova（新星诞生）。知识连接知识，思想连接思想，人与 AI 连接。每一次连接点亮一颗新的星——同时，系统对你的大脑多了一分了解。

### 我们的判断

地球上所有学习平台——Coursera、可汗、多邻国、任何"Notion + 聊天机器人"——记录的都是同一件事：**消费了多少内容**。看了几个视频、完成了几节课、连续打卡多少天。它们本质是给大纲做的精美账本。

没有一个平台知道**你是怎么思考的**。不知道你靠类比能懂递归、遇到形式化归纳就卡死；不知道你系统思维很强、但把一个乱糟糟的问题抽象成方程才是真正的瓶颈；不知道你三周前在线性代数欠下的"认知欠条"，正是今天机器学习这节课听不进去的原因。

Nexiova 的前提完全不同：**知识是一张图，认知是这张图上的一个向量场。** 你学会一个节点，不是打了个勾，而是改变了一个关于你大脑的实时模型的形状。之后每一份计划、每一张教学卡、每一道选择题的干扰项、每一次"先回去补这个"，都是从这个模型里算出来的。

这就是我们说的 **AI 原生学习操作系统**：不是在课程上绑一个 AI，而是知识结构、教学协议、学习者认知模型三者是同一台连通的机器。我们在公开地构建它。

### 全生态

| 层 | 名称 | 现状 | 作用 |
|---|---|---|---|
| 地图 | **知识宇宙** | 已上线 | 36 学科、423+ 节点，前置/后继/跨学科关系，分层掌握规格（Bloom L1→L6），**认知标签**。3D 星图，学会的节点亮起。 |
| 大脑 | **认知引擎** | 基础已上线，核心在建 | 六维认知向量（抽象·逻辑·系统·建模·表达·审美）、认知层逐级门控、认知欠条与种子、学习风格画像；在建：缺口诊断、跨学科迁移识别、欠条感知的规划、自适应教学协议、可携带的"认知孪生"。 |
| 导航 | **计划宇宙** | 已上线 | 对话采集目标/起点/时间/节奏/阶段 → 锚定真实节点的按天计划 → 小宇宙点星。任务分"学"和"做"，交替编排：学概念 → 用概念 → 回到主线。 |
| 引擎 | **学习引擎** | 已上线 | 刺激协议（HOOK/TEACH/PREDICT/QUIZ/CODE/DERIVE/DEBT/SEED…）卡片式阻塞推进；编程逐行推代码、数学逐步推公式；答错回炉；30+ 刺激方式作为方法库按人按学科调用。 |
| 账本 | **成长系统** | 已上线 | 唯一完成权威源、统一 streak、递减能力曲线、真实事件触发的里程碑。算不出来的数字就不显示。 |
| 工具 | **笔记·答疑·可视化** | 已上线 | 消息式笔记、常驻 AI 答疑侧栏、Manim 按需动画。 |

### 为什么认知引擎是"降维打击"

内容平台比的是**有多少**。Nexiova 比的是**多了解学习者**。这是完全不同的一条轴，而且它会复利：你学得越多，模型越准；模型越准，下一次教得越对；教得越对，你学得越快。没有任何以"内容库"为核心的平台能在这条轴上和我们竞争，因为它们的数据结构里根本没有"认知"这个东西。

### 未来目标

**现在 → 3 个月：闭合认知回路**
- 每次答错触发沿前置图谱回溯的缺口诊断
- 欠条感知的规划器：先排还债，再排依赖它的课
- 自适应协议：由认知向量决定卡片类型（过度信直觉的人多给 PREDICT，跳过形式化的人多给 DERIVE）
- Supabase 云端同步，认知模型跨设备持久化
- 内容资产化：自动事实核查 + 权威来源锚定；误区数据库接入干扰项

**3 → 12 个月：让它复利**
- 跨学科迁移识别（CS 的递归 ↔ 数学的归纳 ↔ 金融的复利）并显式呈现
- 基于同一张图和同一个向量的间隔重复——星星变暗前复习，且**因为什么变暗就用什么方式复习**
- 每个"做"任务产出可分享作品，绑定它所证明的节点
- 多智能体私教：讲授 / 审阅 / 苏格拉底追问，按认知画像编排
- 图谱扩到 1000+ 节点，社区评审的学科模板
- 刺激协议与认知孪生格式发布为开放规范

**长期：一个生态，而不是一个 App**
- **开放知识宇宙**：公开、可版本化、社区维护的人类知识图谱，附掌握规格与认知标签——"学习领域的 OpenStreetMap"
- **认知孪生标准**：归学习者所有、可携带的"我如何思考"模型。带着它走，任何遵循规范的导师、课程、工具第一天就能适配你
- **学习操作系统**：计划、笔记、进度、欠条、凭证归学习者，跨工具迁移
- **课程即代码**：机构和社区发布计划模板，编译到共享图谱上，按认知孪生自适应
- **可验证的掌握**：以"你推导了什么、构建了什么、讲清了什么、哪些认知维度被推动了"作为证据，替代到课证明

图谱开放、协议开放、认知模型归学习者——"学习平台"就不再是围墙花园，而成为基础设施。这是目标。

### 参与贡献

最需要的贡献：新增/深化学科节点（带 `cognition_tags`）、为现有节点撰写分层学习规格（模板见 [`docs/学科深度学习内容规格系统.md`](./docs/学科深度学习内容规格系统.md)）、认知引擎（缺口诊断 / 迁移识别 / 欠条规划，请先开 issue）、新的刺激卡片类型、多语言内容。

大改动请先开 issue。PR 需通过 `npx tsc --noEmit`。
