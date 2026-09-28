/**
 * 掌握度仓储接口（多周目系统的持久化边界）。
 *
 * 目的：让 mastery 数据的"读写方式"与"存哪里"解耦。
 * - 现在：LocalMasteryRepo → localStorage（qc_mastery），零依赖，可离线。
 * - 之后：SupabaseMasteryRepo → supabase/migrations/005_phase5_mastery.sql 的四张表，
 *   登录后 `hydrateFromRemote()` 一次拉取 → 本地缓存 → 每次写入双写（本地立即 + 远端异步）。
 *
 * 业务代码只依赖 `getMasteryRepo()`，不直接 import 具体实现。
 * 现阶段 `src/lib/universe/mastery.ts` 仍是同步 API 的主入口（UI 需要同步读），
 * 本接口先作为异步同步层的合同存在；接入 Supabase 时 mastery.ts 内部改为调用这里。
 */

import type { CycleRecord, NodeMastery } from "@/lib/universe/mastery";
import type { MasteryLevel } from "@/lib/learn/cycles";
import {
  getMastery as localGet,
  recordCycleComplete as localRecord,
  addStickingPoint as localStick,
  addDebt as localAddDebt,
  repayDebt as localRepay,
  getDueForReview as localDue,
  getGapNodes as localGaps,
} from "@/lib/universe/mastery";

export interface MasteryRepo {
  /** 读取单节点掌握度（无记录返回 level 0 的空壳） */
  get(nodeId: string): Promise<NodeMastery>;
  /** 读取多个节点的等级（宇宙渲染用） */
  levels(nodeIds: string[]): Promise<Map<string, MasteryLevel>>;
  /** 记录一次周目完成；返回更新后的记录 */
  recordCycle(nodeId: string, record: CycleRecord): Promise<NodeMastery>;
  addStickingPoint(nodeId: string, text: string): Promise<void>;
  addDebt(nodeId: string, debt: string): Promise<void>;
  repayDebt(nodeId: string, debt: string): Promise<void>;
  /** 到期复习的节点 id（按到期时间升序） */
  dueForReview(now?: number): Promise<string[]>;
  /** 有卡点或欠条的节点（NG+ 规划、缺口诊断用） */
  gapNodes(): Promise<{ nodeId: string; stickingPoints: string[]; debts: string[]; level: MasteryLevel }[]>;
  /** 远端 → 本地一次性回灌（登录后调用；本地实现为 no-op） */
  hydrateFromRemote(): Promise<void>;
}

class LocalMasteryRepo implements MasteryRepo {
  async get(nodeId: string) {
    return localGet(nodeId);
  }
  async levels(nodeIds: string[]) {
    const m = new Map<string, MasteryLevel>();
    for (const id of nodeIds) m.set(id, localGet(id).level);
    return m;
  }
  async recordCycle(nodeId: string, record: CycleRecord) {
    return localRecord(nodeId, record);
  }
  async addStickingPoint(nodeId: string, text: string) {
    localStick(nodeId, text);
  }
  async addDebt(nodeId: string, debt: string) {
    localAddDebt(nodeId, debt);
  }
  async repayDebt(nodeId: string, debt: string) {
    localRepay(nodeId, debt);
  }
  async dueForReview(now?: number) {
    return localDue(now);
  }
  async gapNodes() {
    return localGaps();
  }
  async hydrateFromRemote() {
    /* no remote */
  }
}

let _repo: MasteryRepo | null = null;

/** 获取当前仓储实现。接入 Supabase 后在此根据登录态切换。 */
export function getMasteryRepo(): MasteryRepo {
  if (!_repo) _repo = new LocalMasteryRepo();
  return _repo;
}

/** 测试 / 未来注入远端实现 */
export function setMasteryRepo(repo: MasteryRepo | null) {
  _repo = repo;
}
