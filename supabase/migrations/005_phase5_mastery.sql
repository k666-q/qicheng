-- Phase 5: 多周目学习系统（Multi-cycle / NG+）
-- node_mastery: 每个用户 × 知识节点的掌握度（0-4 周目）与小助理记忆
-- cycle_runs:   每一次周目完成的记录（答题统计、总结、是否通过）
-- node_debts:   认知欠条（未还的"为什么"）
-- plan_cycles:  计划的周目关系（NG+ 父子链）
--
-- 与前端 localStorage 结构一一对应：
--   src/lib/universe/mastery.ts   (qc_mastery)
--   src/lib/plan/plans-store.ts   (qc_plans[].cycle / parentPlanId)
-- 前端仓储接口见 src/lib/storage/mastery-repo.ts

-- 掌握度主表
CREATE TABLE IF NOT EXISTS node_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  -- 0 未学 · 1 初见 · 2 精读 · 3 贯通 · 4 守护
  level SMALLINT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4),
  -- 小助理记下的一句话卡点，最新在前，最多 5 条
  sticking_points JSONB NOT NULL DEFAULT '[]',
  last_touched TIMESTAMPTZ DEFAULT now(),
  -- 间隔复习（第 3 周目起）：下次召回时间与已复习次数
  next_review_at TIMESTAMPTZ,
  review_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_mastery_user ON node_mastery(user_id, level);
CREATE INDEX IF NOT EXISTS idx_node_mastery_review ON node_mastery(user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- 周目运行记录
CREATE TABLE IF NOT EXISTS cycle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  cycle SMALLINT NOT NULL CHECK (cycle BETWEEN 1 AND 4),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quiz_total INT NOT NULL DEFAULT 0,
  quiz_first_try INT NOT NULL DEFAULT 0,
  -- 用户选过的错误选项（"Q2:B" 形式），供误区挖掘
  wrong_options JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  passed BOOLEAN NOT NULL DEFAULT true,
  -- 输出校验是否触发过重试（质量指标）
  script_retried BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cycle_runs_user_node ON cycle_runs(user_id, node_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cycle_runs_cycle ON cycle_runs(cycle, passed);

-- 认知欠条
CREATE TABLE IF NOT EXISTS node_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  debt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  repaid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_node_debts_open ON node_debts(user_id, node_id) WHERE repaid_at IS NULL;

-- 计划周目关系（NG+）
CREATE TABLE IF NOT EXISTS plan_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  cycle SMALLINT NOT NULL DEFAULT 1 CHECK (cycle BETWEEN 1 AND 4),
  parent_plan_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, plan_id)
);

-- 缺口诊断事件（答错 → 回溯前置 → 建议回炉），用于衡量闭环是否真的带来修复
CREATE TABLE IF NOT EXISTS gap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  cycle SMALLINT NOT NULL,
  gap_node_id TEXT NOT NULL,
  distance SMALLINT NOT NULL DEFAULT 1,
  -- 用户是否点击了"去回炉"
  accepted BOOLEAN,
  -- 回炉后是否在原节点通过了该周目
  repaired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gap_events_user ON gap_events(user_id, created_at DESC);

-- updated_at 触发器
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_node_mastery_updated ON node_mastery;
CREATE TRIGGER trg_node_mastery_updated
  BEFORE UPDATE ON node_mastery
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE node_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_debts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_cycles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gap_events   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own node_mastery select" ON node_mastery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own node_mastery insert" ON node_mastery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own node_mastery update" ON node_mastery FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own cycle_runs select" ON cycle_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own cycle_runs insert" ON cycle_runs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own node_debts select" ON node_debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own node_debts insert" ON node_debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own node_debts update" ON node_debts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own plan_cycles select" ON plan_cycles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own plan_cycles insert" ON plan_cycles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own plan_cycles update" ON plan_cycles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own gap_events select" ON gap_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own gap_events insert" ON gap_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own gap_events update" ON gap_events FOR UPDATE USING (auth.uid() = user_id);

-- 视图：每个用户的认知全景（管理后台 / 学习者画像用）
CREATE OR REPLACE VIEW v_mastery_overview AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE level >= 1) AS nodes_touched,
  COUNT(*) FILTER (WHERE level >= 2) AS nodes_deep,
  COUNT(*) FILTER (WHERE level >= 3) AS nodes_synth,
  COUNT(*) FILTER (WHERE level >= 4) AS nodes_maintain,
  COUNT(*) FILTER (WHERE next_review_at IS NOT NULL AND next_review_at <= now()) AS due_reviews
FROM node_mastery
GROUP BY user_id;
