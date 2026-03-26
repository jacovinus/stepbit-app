import api from './client';
import type { CoreCronStatus, CoreHealthReport, CoreReadinessReport, CoreRecentEvent, CoreSystemRuntime, McpProviderStatus } from '../types';

export interface McpTool {
  name: string;
  description: string;
  input_schema: any;
  provider_id?: string;
  enabled?: boolean;
  read_only?: boolean;
  destructive?: boolean;
  open_world?: boolean;
  tags?: string[];
}

export const getMcpTools = async (): Promise<McpTool[]> => {
  const response = await api.get('llm/mcp/tools');
  return response.data;
};

export const getMcpProviders = async (): Promise<McpProviderStatus[]> => {
  const response = await api.get('llm/mcp/providers');
  return response.data;
};

export const updateMcpProviderState = async (provider: string, enabled: boolean): Promise<McpProviderStatus> => {
  const response = await api.post(`llm/mcp/providers/${provider}/state`, { enabled });
  return response.data;
};

export const fetchMcpProviderDoc = async (provider: string): Promise<string> => {
  const response = await api.get(`llm/mcp/providers/${provider}/doc`, {
    responseType: 'text',
  });
  return typeof response.data === 'string' ? response.data : String(response.data);
};

export const getCoreHealthReport = async (): Promise<CoreHealthReport> => {
  const response = await api.get('llm/core/health');
  return response.data;
};

export const getCoreReadinessReport = async (): Promise<CoreReadinessReport> => {
  const response = await api.get('llm/core/readiness');
  return response.data;
};

export const getCoreSystemRuntime = async (): Promise<CoreSystemRuntime> => {
  const response = await api.get('llm/core/runtime');
  return response.data;
};

export const getCoreCronStatus = async (): Promise<CoreCronStatus> => {
  const response = await api.get('llm/core/cron-status');
  return response.data;
};

export const getCoreRecentEvents = async (limit = 20): Promise<CoreRecentEvent[]> => {
  const response = await api.get('llm/core/recent-events', {
    params: { limit },
  });
  return response.data;
};

export const executeMcpTool = async (tool: string, input: any): Promise<any> => {
  const response = await api.post(`llm/mcp/tools/${tool}/execute`, { input });
  return response.data;
};

export const fetchArtifactText = async (path: string): Promise<string> => {
  const response = await api.get('llm/artifacts', {
    params: { path },
    responseType: 'text',
  });
  return typeof response.data === 'string' ? response.data : String(response.data);
};

export const fetchArtifactBlob = async (path: string): Promise<Blob> => {
  const response = await api.get('llm/artifacts', {
    params: { path },
    responseType: 'blob',
  });
  return response.data;
};

export const deleteArtifact = async (path: string): Promise<{ deleted: boolean; path: string }> => {
  const response = await api.delete('llm/artifacts', {
    params: { path },
  });
  return response.data;
};

export const executeReasoning = async (graph: any): Promise<any> => {
  const response = await api.post('llm/reasoning/execute', graph);
  return response.data;
};

export const executeReasoningStream = async (graph: any, onEvent: (event: any) => void): Promise<void> => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/llm/reasoning/execute/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('jacox_api_key') || 'sk-dev-key-123'}`
    },
    body: JSON.stringify(graph)
  });

  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          onEvent(data);
        } catch (e) {
          console.error('Error parsing SSE event:', e);
        }
      }
    }
  }
};
