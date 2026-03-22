import client from './client';

export interface EventTrigger {
  id: string;
  event_type: string;
  condition: any;
  action: any;
}

export interface CreateTriggerRequest {
  id: string;
  event_type: string;
  condition: any;
  action: any;
}

export interface PublishEventRequest {
  event_type: string;
  payload: any;
}

export const eventsApi = {
  listTriggers: async (): Promise<EventTrigger[]> => {
    const response = await client.get('/triggers');
    return response.data.triggers;
  },

  createTrigger: async (trigger: CreateTriggerRequest): Promise<void> => {
    await client.post('/triggers', trigger);
  },

  deleteTrigger: async (id: string): Promise<void> => {
    await client.delete(`/triggers/${id}`);
  },

  publishEvent: async (event: PublishEventRequest): Promise<void> => {
    await client.post('/events', event);
  },
};
