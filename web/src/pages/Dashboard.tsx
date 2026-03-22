import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '../api/sessions';
import type { MemoryUsageEntry } from '../types';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { useStepbitCore } from '../hooks/useStepbitCore';
import { Tooltip } from '../components/Tooltip';
import { cn } from '../utils/cn';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Cpu,
    Gauge,
    HardDrive,
    Layers,
    Loader2,
    MessageCircle,
    Zap,
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, isLoading }: any) => (
    <div className="glass p-4 rounded-xs flex flex-col gap-3 hover:border-gruv-light-4/50 transition-colors">
        <div className="flex justify-between items-start">
            <div className={`p-2 rounded-xs bg-${color}/10 text-${color}`}>
                <Icon className="w-4 h-4" />
            </div>
        </div>
        <div>
            <p className="text-gruv-light-4 text-[11px] font-semibold uppercase tracking-wider">{title}</p>
            {isLoading ? (
                <div className="h-7 flex items-center"><Loader2 className="w-4 h-4 animate-spin text-gruv-light-4" /></div>
            ) : (
                <h3 className="text-xl font-semibold mt-1">{value}</h3>
            )}
        </div>
    </div>
);

const RuntimeRow = ({ label, value, accent = 'text-gruv-light-1' }: { label: string; value: string; accent?: string }) => (
    <div className="rounded-xs border border-white/10 bg-gruv-dark-4/10 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">{label}</p>
        <p className={`mt-1.5 text-xs font-semibold break-words ${accent}`}>{value}</p>
    </div>
);

export const Dashboard = () => {
    const health = useHealthCheck();
    const core = useStepbitCore(10000);

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['system-stats'],
        queryFn: () => sessionsApi.getStats(),
        refetchInterval: 5000
    });

    const { data: sessions, isLoading: sessionsLoading } = useQuery({
        queryKey: ['sessions'],
        queryFn: () => sessionsApi.list(),
        retry: false
    });

    const formatBytes = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatNumber = (num: number) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    };

    const safeSessions = Array.isArray(sessions) ? sessions : [];

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">System Overview</h1>
                    <p className="text-xs text-gruv-light-4">Real-time performance metrics, readiness, and runtime visibility.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Tooltip content={health.apiConnected ? 'API is responding correctly' : 'Critical: API unreachable'}>
                        <div className={cn(
                            'px-3 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs transition-all',
                            health.apiConnected
                                ? 'border-monokai-green/30 text-monokai-green bg-monokai-green/5'
                                : 'border-monokai-red/50 text-monokai-red bg-monokai-red/10 shadow-[0_0_15px_rgba(249,38,114,0.2)]'
                        )}>
                            {!health.apiConnected && <AlertCircle className="w-3.5 h-3.5 animate-pulse" />}
                            <div className={cn('w-1.5 h-1.5 rounded-full', health.apiConnected ? 'bg-monokai-green' : 'bg-monokai-red')} />
                            API: {health.apiConnected ? 'READY' : 'DISCONNECTED'}
                        </div>
                    </Tooltip>

                    <Tooltip content={health.dbConnected ? 'DuckDB connection active' : 'Warning: Database disconnected'}>
                        <div className={cn(
                            'px-3 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs transition-all',
                            health.dbConnected
                                ? 'border-monokai-aqua/30 text-monokai-aqua bg-monokai-aqua/5'
                                : 'border-monokai-orange/50 text-monokai-orange bg-monokai-orange/10 shadow-[0_0_15px_rgba(253,151,31,0.2)]'
                        )}>
                            {!health.dbConnected && <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />}
                            <div className={cn('w-1.5 h-1.5 rounded-full', health.dbConnected ? 'bg-monokai-aqua' : 'bg-monokai-orange')} />
                            DB: {health.dbConnected ? 'CONNECTED' : 'OFFLINE'}
                        </div>
                    </Tooltip>

                    <Tooltip content={health.llmosConnected ? (health.llmosReady ? 'stepbit-core is online and ready' : 'stepbit-core is online but still warming up') : 'stepbit-core is offline'}>
                        <div className={cn(
                            'px-3 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs transition-all',
                            health.llmosConnected
                                ? (health.llmosReady
                                    ? 'border-monokai-green/30 text-monokai-green bg-monokai-green/5'
                                    : 'border-monokai-orange/40 text-monokai-orange bg-monokai-orange/10')
                                : 'border-gruv-dark-4 text-gruv-gray bg-gruv-dark-4/10'
                        )}>
                            <div className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                health.llmosConnected ? (health.llmosReady ? 'bg-monokai-green' : 'bg-monokai-orange') : 'bg-gruv-dark-4'
                            )} />
                            CORE: {health.llmosConnected ? (health.llmosReady ? 'READY' : 'WARMING') : 'OFFLINE'}
                        </div>
                    </Tooltip>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard title="Total Sessions" value={formatNumber(stats?.total_sessions || 0)} icon={Layers} color="monokai-aqua" isLoading={statsLoading} />
                <StatCard title="Total Messages" value={formatNumber(stats?.total_messages || 0)} icon={MessageCircle} color="monokai-pink" isLoading={statsLoading} />
                <StatCard title="Tokens Used" value={formatNumber(stats?.total_tokens || 0)} icon={Zap} color="monokai-purple" isLoading={statsLoading} />
                <StatCard title="DB Storage" value={formatBytes(stats?.db_size_bytes || 0)} icon={HardDrive} color="gruv-yellow" isLoading={statsLoading} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard title="Core Active Sessions" value={formatNumber(core.metrics.active_sessions || 0)} icon={Cpu} color="monokai-aqua" isLoading={core.loading} />
                <StatCard title="Core Requests" value={formatNumber(core.metrics.requests_total || 0)} icon={Activity} color="monokai-green" isLoading={core.loading} />
                <StatCard title="Core Tokens" value={formatNumber(core.metrics.tokens_generated_total || 0)} icon={Zap} color="monokai-pink" isLoading={core.loading} />
                <StatCard title="Avg Token Latency" value={`${(core.metrics.token_latency_avg_ms || 0).toFixed(1)} ms`} icon={Gauge} color="monokai-orange" isLoading={core.loading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass p-4 rounded-xs min-h-72 flex flex-col">
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                        <Activity className="text-monokai-aqua w-4 h-4" />
                        Memory Breakdown
                    </h3>
                    <div className="flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                        {statsLoading ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-monokai-aqua" /></div>
                        ) : stats?.memory_usage && stats.memory_usage.length > 0 ? (
                            stats.memory_usage
                                .sort((a: MemoryUsageEntry, b: MemoryUsageEntry) => b.usage_bytes - a.usage_bytes)
                                .map((m: MemoryUsageEntry, idx: number) => (
                                    <div key={idx} className="flex flex-col gap-1.5 p-2.5 bg-gruv-dark-4/10 rounded-xs border border-gruv-dark-4/20">
                                        <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-gruv-light-4">
                                            <span>{m.tag?.replace(/_/g, ' ') || 'SYSTEM'}</span>
                                            <span className="text-monokai-aqua">{formatBytes(m.usage_bytes)}</span>
                                        </div>
                                        <div className="w-full bg-gruv-dark-4/30 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-monokai-aqua shadow-[0_0_10px_rgba(166,226,46,0.3)] transition-all duration-1000"
                                                style={{
                                                    width: `${Math.min(100, (m.usage_bytes / (stats?.memory_usage.reduce((sum: number, curr: MemoryUsageEntry) => sum + curr.usage_bytes, 0) || 1)) * 100)}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                        ) : (
                            <div className="flex-grow flex flex-col items-center justify-center text-gruv-light-4 opacity-50">
                                <Activity className="w-8 h-8 mb-2 opacity-20" />
                                <p className="text-xs font-mono">No memory data available</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass p-4 rounded-xs min-h-72 flex flex-col">
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                        <CheckCircle2 className="text-monokai-green w-4 h-4" />
                        Core Runtime
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        <RuntimeRow label="Connectivity" value={core.online ? 'Online' : 'Offline'} accent={core.online ? 'text-monokai-green' : 'text-monokai-pink'} />
                        <RuntimeRow label="Readiness" value={core.ready ? 'Ready' : 'Not Ready'} accent={core.ready ? 'text-monokai-green' : 'text-monokai-orange'} />
                        <RuntimeRow label="Active Model" value={core.active_model || 'Unavailable'} />
                        <RuntimeRow label="Discovered Models" value={core.supported_models.length ? core.supported_models.join(', ') : 'None detected'} />
                        <div className="rounded-xs border border-white/10 bg-gruv-dark-4/10 p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Clock className="w-3.5 h-3.5 text-monokai-purple" />
                                <span className="text-[10px] uppercase tracking-[0.18em] text-gruv-light-4">Core Message</span>
                            </div>
                            <p className="text-xs text-gruv-light-2">{core.message}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass p-4 rounded-xs min-h-72 flex flex-col">
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <MessageCircle className="text-monokai-purple w-4 h-4" />
                    Recent Sessions
                </h3>
                <div className="flex flex-col gap-2 overflow-y-auto">
                    {sessionsLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-monokai-purple" /></div>
                    ) : safeSessions.length > 0 ? (
                        safeSessions.slice(0, 5).map((s) => (
                            <a
                                key={s.id}
                                href={`/chat?session=${s.id}`}
                                className="flex items-center gap-3 p-2 hover:bg-gruv-dark-4/20 rounded-xs transition-colors cursor-pointer"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href = `/chat?session=${s.id}`;
                                }}
                            >
                                <div className="w-8 h-8 rounded-full bg-gruv-dark-4 flex items-center justify-center">
                                    <MessageCircle className="w-4 h-4 text-gruv-light-1" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-semibold text-xs truncate">{s.title || s.name || 'Untitled Session'}</p>
                                    <p className="text-[11px] text-gruv-light-4">{new Date(s.created_at).toLocaleDateString()} • {s.metadata?.message_count || 0} messages</p>
                                </div>
                            </a>
                        ))
                    ) : (
                        <div className="flex-grow flex flex-col items-center justify-center text-gruv-light-4 opacity-50">
                            <MessageCircle className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-xs font-mono">No recent activity</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
