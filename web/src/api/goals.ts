import client from './client';

export interface GoalExecutionResult {
  goal: string;
  pipeline: any;
  result: {
    final_answer: string;
    trace: string[];
    tool_calls: any[];
    intermediate_results: any[];
  };
}

export const goalsApi = {
  execute: async (goal: string, rlmEnabled = false): Promise<GoalExecutionResult> => {
    const response = await client.post('/goals/execute', { goal, rlm_enabled: rlmEnabled });
    return response.data;
  },
};

