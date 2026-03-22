import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { eventsApi, type EventTrigger } from '../api/events';
import { useStepbitCore } from '../hooks/useStepbitCore';
import { Activity, BellRing, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';

const defaultCondition = `{
  "Equals": {
    "path": "extension",
    "value": ".pdf"
  }
}`;

const defaultAction = `{
  "Goal": {
    "goal": "Inspect the new PDF and summarize it"
  }
}`;

const defaultPayload = `{
  "extension": ".pdf",
  "path": "/tmp/report.pdf"
}`;

const Triggers: React.FC = () => {
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingTrigger, setSubmittingTrigger] = useState(false);
  const [publishingEvent, setPublishingEvent] = useState(false);
  const [triggerError, setTriggerError] = useState('');
  const [eventError, setEventError] = useState('');
  const [eventType, setEventType] = useState('file.created');
  const [triggerId, setTriggerId] = useState('file-processor');
  const [condition, setCondition] = useState(defaultCondition);
  const [action, setAction] = useState(defaultAction);
  const [publishEventType, setPublishEventType] = useState('file.created');
  const [publishPayload, setPublishPayload] = useState(defaultPayload);
  const { online, loading: statusLoading, refresh: refreshStatus } = useStepbitCore();

  useEffect(() => {
    void loadTriggers();
  }, []);

  const sortedTriggers = useMemo(
    () => [...triggers].sort((a, b) => a.id.localeCompare(b.id)),
    [triggers]
  );

  const loadTriggers = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.listTriggers();
      setTriggers(data);
    } catch (error) {
      console.error('Failed to load triggers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrigger = async () => {
    setTriggerError('');

    let parsedCondition: any = null;
    let parsedAction: any;

    try {
      const trimmedCondition = condition.trim();
      parsedCondition = trimmedCondition ? JSON.parse(trimmedCondition) : null;
      parsedAction = JSON.parse(action);
    } catch {
      setTriggerError('Condition and action must be valid JSON.');
      return;
    }

    setSubmittingTrigger(true);
    try {
      await eventsApi.createTrigger({
        id: triggerId.trim(),
        event_type: eventType.trim(),
        condition: parsedCondition,
        action: parsedAction,
      });
      await loadTriggers();
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to create trigger';
      setTriggerError(message);
    } finally {
      setSubmittingTrigger(false);
    }
  };

  const handleDeleteTrigger = async (id: string) => {
    if (!confirm(`Delete trigger "${id}"?`)) return;

    try {
      await eventsApi.deleteTrigger(id);
      await loadTriggers();
    } catch (error) {
      console.error('Failed to delete trigger:', error);
      alert('Failed to delete trigger.');
    }
  };

  const handlePublishEvent = async () => {
    setEventError('');

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(publishPayload);
    } catch {
      setEventError('Payload must be valid JSON.');
      return;
    }

    setPublishingEvent(true);
    try {
      await eventsApi.publishEvent({
        event_type: publishEventType.trim(),
        payload: parsedPayload,
      });
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to publish event';
      setEventError(message);
    } finally {
      setPublishingEvent(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-monokai-purple/20 border border-monokai-purple/30">
            <BellRing className="w-8 h-8 text-monokai-purple" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-gruv-light-0 tracking-tight">Triggers</h1>
            <p className="text-gruv-light-4 font-medium">Define event-driven automations and fire test events into stepbit-core.</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border glass ${online ? 'border-monokai-green/30 bg-monokai-green/5' : 'border-monokai-pink/30 bg-monokai-pink/5'}`}>
          <Activity className={`w-4 h-4 ${online ? 'text-monokai-green animate-pulse' : 'text-monokai-pink'}`} />
          <span className={`text-sm font-bold ${online ? 'text-monokai-green' : 'text-monokai-pink'}`}>
            stepbit-core: {online ? 'Connected' : 'Disconnected'}
          </span>
          <button
            onClick={refreshStatus}
            className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            disabled={statusLoading}
          >
            <RefreshCw className={`w-3 h-3 text-gruv-light-4 ${statusLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_420px_minmax(0,1fr)] gap-8">
        <section className="glass border-white/10 rounded-[2rem] p-6">
          <div className="flex items-center gap-3 mb-6">
            <Plus className="w-6 h-6 text-monokai-purple" />
            <h2 className="text-2xl font-bold text-gruv-light-1">New Trigger</h2>
          </div>

          <div className="space-y-5">
            <Field label="Trigger ID" value={triggerId} onChange={setTriggerId} placeholder="file-processor" />
            <Field label="Event Type" value={eventType} onChange={setEventType} placeholder="file.created" />
            <JsonField label="Condition JSON" value={condition} onChange={setCondition} rows={8} />
            <JsonField label="Action JSON" value={action} onChange={setAction} rows={10} />

            {triggerError && <ErrorBox message={triggerError} />}

            <button
              onClick={() => void handleCreateTrigger()}
              disabled={submittingTrigger || !online}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-monokai-purple to-monokai-pink text-white px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              {submittingTrigger ? 'Creating...' : 'Create Trigger'}
            </button>
          </div>
        </section>

        <section className="glass border-white/10 rounded-[2rem] p-6">
          <div className="flex items-center gap-3 mb-6">
            <Send className="w-6 h-6 text-monokai-aqua" />
            <h2 className="text-2xl font-bold text-gruv-light-1">Publish Test Event</h2>
          </div>

          <div className="space-y-5">
            <Field label="Event Type" value={publishEventType} onChange={setPublishEventType} placeholder="file.created" />
            <JsonField label="Payload JSON" value={publishPayload} onChange={setPublishPayload} rows={12} />

            {eventError && <ErrorBox message={eventError} />}

            <button
              onClick={() => void handlePublishEvent()}
              disabled={publishingEvent || !online}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-monokai-aqua to-monokai-green text-black px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {publishingEvent ? 'Publishing...' : 'Publish Event'}
            </button>
          </div>
        </section>

        <section className="glass border-white/10 rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gruv-light-1">Registered Triggers</h2>
              <p className="text-gruv-light-4">Current trigger definitions loaded in stepbit-core.</p>
            </div>
            <button
              onClick={() => void loadTriggers()}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 text-gruv-light-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="h-36 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : sortedTriggers.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-white/10 rounded-[2rem]">
              <BellRing className="w-12 h-12 text-gruv-light-4 mx-auto mb-4" />
              <p className="text-gruv-light-3 text-lg font-semibold">No triggers registered</p>
              <p className="text-gruv-light-4 mt-2">Create one from the left panel to start wiring events to actions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTriggers.map((trigger, index) => (
                <motion.div
                  key={trigger.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-3 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-gruv-light-1">{trigger.id}</h3>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-monokai-purple/15 text-monokai-purple border border-monokai-purple/20">
                          {trigger.event_type}
                        </span>
                      </div>

                      <JsonPreview label="Condition" value={trigger.condition} />
                      <JsonPreview label="Action" value={trigger.action} />
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => void handleDeleteTrigger(trigger.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-monokai-pink/15 text-monokai-pink border border-monokai-pink/20 hover:bg-monokai-pink/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) => (
  <div>
    <label className="block text-sm font-semibold text-gruv-light-3 mb-2">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl bg-gruv-dark-0 border border-white/10 px-4 py-3 text-gruv-light-1"
    />
  </div>
);

const JsonField = ({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) => (
  <div>
    <label className="block text-sm font-semibold text-gruv-light-3 mb-2">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-2xl bg-gruv-dark-0 border border-white/10 px-4 py-3 text-sm text-monokai-green font-mono"
    />
  </div>
);

const JsonPreview = ({ label, value }: { label: string; value: any }) => (
  <details className="rounded-xl border border-white/10 bg-gruv-dark-0/70">
    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gruv-light-3">{label}</summary>
    <pre className="px-4 pb-4 text-xs text-monokai-green overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  </details>
);

const ErrorBox = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-monokai-pink/30 bg-monokai-pink/10 px-4 py-3 text-sm text-monokai-pink">
    {message}
  </div>
);

export default Triggers;
