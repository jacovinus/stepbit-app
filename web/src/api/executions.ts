import client from './client';

export interface ExecutionRun {
  id: number;
  source_type: string;
  source_id: string;
  action_type: string;
  status: string;
  request_payload: any;
  response_payload: any;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export const executionsApi = {
  list: async (limit = 50, offset = 0): Promise<ExecutionRun[]> => {
    const response = await client.get(`/executions?limit=${limit}&offset=${offset}`);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await client.delete(`/executions/${id}`);
  },
  deleteAll: async (): Promise<void> => {
    await client.delete('/executions');
  },
};
