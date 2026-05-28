-- Phase 4: 用户画像系统 + 留存基础
-- user_profiles: 聚合后的用户画像
-- profile_events: 行为事件流水

-- 用户画像（聚合结果）
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal TEXT,
  domain TEXT,
  starting_point TEXT,
  motivation TEXT,
  time_budget TEXT,
  preferred_difficulty TEXT DEFAULT 'standard',
  struggle_patterns JSONB DEFAULT '[]',
  completed_count INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  corrections JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 行为事件流水表
CREATE TABLE IF NOT EXISTS profile_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_events_user ON profile_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_events_type ON profile_events(event_type, created_at DESC);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own events" ON profile_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON profile_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 给 tasks 表加三档字段（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS light_minutes INT DEFAULT 15;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS intense_minutes INT DEFAULT 60;
  END IF;
END $$;
