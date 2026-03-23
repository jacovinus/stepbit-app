import client from './client';
import type { PipelineExecuteResult } from '../types';

export interface GoalPlanStage {
  id: string;
  title: string;
  stage_type: string;
  summary: string;
  config: Record<string, any>;
}

export interface GoalPlan {
  planner_source: string;
  planner_mode: string;
  goal: string;
  pipeline_name: string;
  summary: string;
  notes: string[];
  stages: GoalPlanStage[];
  pipeline: any;
}

export interface GoalExecutionResult {
  goal: string;
  plan: GoalPlan;
  pipeline: any;
  result: PipelineExecuteResult;
}

export const goalsApi = {
  plan: async (goal: string, rlmEnabled = false): Promise<{ plan: GoalPlan; planner_backend: string }> => {
    const response = await client.post('/goals/plan', { goal, rlm_enabled: rlmEnabled });
    return response.data;
  },

  execute: async (goal: string, rlmEnabled = false): Promise<GoalExecutionResult> => {
    const response = await client.post('/goals/execute', { goal, rlm_enabled: rlmEnabled });
    return response.data;
  },

  executePlanned: async (goal: string, plan: GoalPlan, rlmEnabled = false): Promise<GoalExecutionResult> => {
    const response = await client.post('/goals/execute', { goal, plan, rlm_enabled: rlmEnabled });
    return response.data;
  },

  replan: async (
    goal: string,
    previousPlan: GoalPlan,
    failureReason: string,
    lastResult?: Record<string, any>,
    rlmEnabled = false,
  ): Promise<{ plan: GoalPlan; planner_backend: string }> => {
    const response = await client.post('/goals/replan', {
      goal,
      previous_plan: previousPlan,
      failure_reason: failureReason,
      last_result: lastResult,
      rlm_enabled: rlmEnabled,
    });
    return response.data;
  },
};
