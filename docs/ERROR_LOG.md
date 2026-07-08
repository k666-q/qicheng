# 启程 (Qicheng) - 错误记录文档

> 记录所有已发现的问题、根因分析和修复方案。按时间倒序排列。

---

## ARCH-001: 两阶段生成架构重构
- **时间**: 2026-06-28 11:36
- **问题**: 单阶段生成时，AI 自由度过大 → 对比类概念只展示一个算法；动画结构无规划
- **方案**: 拆为两阶段：
  - **Stage 1（剧本生成）**: DeepSeek 输出结构化 JSON 剧本，包含：
    - 动画类型（algorithm/comparison/process 等）
    - 分段结构（每段的教学目的、视觉元素、play 数量）
    - 布局规划（主视觉位置、文字位置）
    - 具体数据值和结论语句
    - 对比类概念强制要求每个对比对象都有独立段落
  - **Stage 2（代码生成）**: DeepSeek 严格按剧本生成 Manim 代码
- **效果**:
  - Prim vs Kruskal：从"只演示一个"→ 35 plays 两个都演示
  - play 数量由剧本动态规划（12-30），不再硬编码
  - 渲染超时从 90s 放宽到 120s
  - 截断安全阀从 24 放宽到 35
- **文件**: `src/app/api/manim-video/route.ts`

---

## ERR-008: 动画元素重叠（文字堆叠、图节点重叠）
- **发现时间**: 2026-06-28 00:38
- **现象**: BST 动画中，注释文字与节点重叠，底部多行步骤堆在一起看不清
- **根因**: AI 生成代码时没有做布局规划，多个 Text 和 Shape 默认放在场景中心区域，没有及时 FadeOut 旧元素
- **修复**:
  - System prompt 新增 `LAYOUT RULES` 章节，定义屏幕三区域划分（TOP/MIDDLE/BOTTOM）
  - 限制注释文字 font_size=11-12，最多 20 字符
  - 要求最多同时显示 3 条步骤文字，新增前先 FadeOut 旧的
  - 节点间距要求 >= 1.5 单位
  - 模板中示范使用 `ReplacementTransform` 和 `.move_to()` 显式定位
- **文件**: `src/app/api/manim-video/route.ts`

---

## ERR-007: 中文节点数据导致 Manim 渲染 100% 失败
- **发现时间**: 2026-06-27 23:40
- **现象**: 用户看到的视频始终是 4 秒的 "Concept Animation" fallback
- **根因链路**:
  1. 节点数据全部为中文（name="运动学", description="位移、速度..." keywords=["运动学","位移"...]）
  2. 中文数据直接传入 DeepSeek 的 userPrompt
  3. DeepSeek 看到中文输入 → 在 `Text()` 中输出中文字符串
  4. `cleanManimCode` 的 regex `/Text\(["']([^"']*?)["']/g` 只匹配简单模式，遗漏 f-string、字符串拼接等复杂情况
  5. 残留中文进入 Manim 渲染器 → 渲染器无 CJK 字体 → 渲染失败 (500)
  6. catch 走 `SAFE_FALLBACK_CODE` → 返回 HTTP 200 + 4 秒占位视频
  7. 前端收到 200 + videoUrl → 无法区分真假 → 缓存 fallback URL
  8. 下次打开页面直接从缓存读取 → 永远显示 fallback
- **修复**:
  - `route.ts`: userPrompt 明确告知 AI "may be in Chinese, but ALL code output must use ENGLISH"
  - `route.ts`: `cleanManimCode` 增加 f-string 处理 + 全字符串兜底 regex
  - `route.ts`: 返回 `isFallback` 标记
  - `learn/page.tsx`: fallback 视频不写入 localStorage 缓存
- **验证**: 中文输入 "运动学" → AI 输出 "Kinematics" 英文动画，`isFallback: false`，16.5s 完成
- **文件**: `src/app/api/manim-video/route.ts`, `src/app/universe/learn/page.tsx`

---

## ERR-006: 前端 localStorage 缓存导致用户永远看到旧 fallback
- **发现时间**: 2026-06-27 22:56
- **现象**: 即使后端代码已修复，用户刷新页面仍看到 "Concept Animation"
- **根因**: `loadCachedVideo()` 在 useEffect 中从 localStorage 读取旧的 fallback URL，按钮逻辑 `manimVideoUrl ? togglePanel : generate` 导致已有缓存时只切换面板不重新生成
- **修复**:
  - 添加 `PROMPT_V2_TS` 时间戳，自动失效重写前的旧缓存
  - 添加「重新生成」按钮，允许用户手动触发
  - fallback 响应不再写入缓存（ERR-007 修复的一部分）
- **文件**: `src/app/universe/learn/page.tsx`

---

## ERR-005: Manim 渲染器返回的错误信息被进度条文本淹没
- **发现时间**: 2026-06-27 (earlier)
- **现象**: 500 错误消息全是 `Animation #1: Write(...): 45%|████` 进度条文本
- **根因**: Manim CLI 的 stderr 混合了进度条输出和实际 Python traceback
- **修复**: `renderVideo` 中增加过滤逻辑，移除含 `Animation `、`%|`、`it/s]` 的行，优先提取 Traceback
- **文件**: `src/app/api/manim-video/route.ts`

---

## ERR-004: Fallback 视频显示乱码方块字符
- **发现时间**: 2026-06-27 (earlier)
- **现象**: fallback 动画中的中文标题显示为方块乱码
- **根因**: `SAFE_FALLBACK_CODE` 尝试渲染中文标题（`safeTitle` 变量），但 Manim 渲染器无 CJK 字体
- **修复**: `SAFE_FALLBACK_CODE` 改为固定英文文本 "Concept Animation"
- **文件**: `src/app/api/manim-video/route.ts`

---

## ERR-003: DeepSeek 代码生成超时 (>60s)
- **发现时间**: 2026-06-27 (earlier)
- **现象**: API 返回 500，错误 "Request timed out"
- **根因**: 使用了 `deepseek-v4-pro` 推理模型，会先做长链推理思考再输出代码，经常超过 60s
- **修复**: 环境变量 `MANIM_AI_MODEL` 切换为 `deepseek-chat`（快速模型），代码生成 3-8 秒完成
- **文件**: `src/app/api/manim-video/route.ts`

---

## ERR-002: AI 生成过于复杂的代码导致渲染超时 (>90s)
- **发现时间**: 2026-06-27 (earlier)
- **现象**: 渲染服务 90 秒超时
- **根因**: AI 生成 20+ 个 `self.play()` 调用和复杂循环，渲染时间超过限制
- **修复**:
  - `cleanManimCode` 中 self.play() 硬上限截断（超过 14 个截断到 12）
  - 注入低分辨率配置 `720p@24fps` 加速渲染
  - System prompt 限制 MAX 12 self.play()
- **文件**: `src/app/api/manim-video/route.ts`

---

## ERR-001: "没有找到这颗星" — 学习页无法加载深层节点
- **发现时间**: 2026-06-27 (earlier)
- **现象**: 从宇宙视图点击深层节点进入学习页，显示 "没有找到这颗星"
- **根因**: `learn/page.tsx` 只从顶层 `knowledgeGraph.nodes` 查找节点，不会动态加载 `deep/{parentId}.json` 中的 Tier 1/2 节点
- **修复**: 添加 `loadDeepNodes` + `getAllLoadedDeepNodes` 逻辑，逐级搜索深层节点
- **文件**: `src/app/universe/learn/page.tsx`, `src/lib/universe/deep-loader.ts`

---

## 附录：Manim 渲染管线架构

```
[前端 learn/page.tsx]
    ↓ POST /api/manim-video { nodeId, name(中文), description(中文), keywords(中文) }
[后端 route.ts]
    ↓ generateManimCode() → DeepSeek API (deepseek-chat)
    ↓ cleanManimCode() → 去中文/去MathTex/去Arrow/截断play
    ↓ renderVideo() → POST http://localhost:8080/v1/video/rendering
[Docker Manim 渲染服务 :8080]
    ↓ 执行 Manim CLI 渲染 → 生成 .mp4
    ↓ 返回 { video_url }
[后端 route.ts]
    ↓ 如果渲染失败 → SAFE_FALLBACK_CODE 再渲染
    ↓ 返回 { videoUrl, code, isFallback }
[前端 learn/page.tsx]
    ↓ 如果 !isFallback → 缓存到 localStorage
    ↓ 显示 <video> 播放器
```
