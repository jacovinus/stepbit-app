import React from 'react';
import { NavLink, Outlet } from 'react-router';
import {
    LayoutDashboard,
    MessageSquare,
    Database,
    Settings,
    ChevronRight,
    Cpu,
    BookOpen,
    Wrench,
    Zap,
    Workflow,
    AlarmClock,
    BellRing,
    History,
    Target
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const SidebarItem = ({ to, icon: Icon, children }: { to: string, icon: any, children: React.ReactNode }) => (
    <NavLink
        to={to}
        className={({ isActive }) => cn(
            "flex items-center gap-2.5 px-2.5 py-2 rounded-xs text-xs transition-all duration-200 group min-h-0",
            isActive
                ? "bg-monokai-pink text-white shadow-[0_0_12px_rgba(249,38,114,0.22)]"
                : "text-gruv-light-4 hover:bg-gruv-dark-3/80 hover:text-gruv-light-1"
        )}
    >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium truncate">{children}</span>
        <ChevronRight className={cn(
            "ml-auto w-3 h-3 opacity-0 transition-all duration-200 shrink-0",
            "group-hover:opacity-100 group-hover:translate-x-1"
        )} />
    </NavLink>
);

import { useHealthCheck } from '../hooks/useHealthCheck';
import { DisconnectedOverlay } from './DisconnectedOverlay';
import { ProviderSelector } from './ProviderSelector';

export const Layout = () => {
    const { isOnline, apiConnected, dbConnected, llmosConnected, isRetrying } = useHealthCheck();

    return (
        <div className="flex h-screen bg-gruv-dark-1 text-gruv-light-1 overflow-hidden font-sans text-sm">
            {!isOnline && <DisconnectedOverlay isRetrying={isRetrying} />}
            {/* Sidebar */}
            <aside className="w-56 min-w-56 xl:w-60 xl:min-w-60 shrink-0 bg-gruv-dark-0 border-r border-gruv-dark-4/30 p-3 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center gap-2 px-1">
                    <div className="w-8 h-8 bg-gradient-to-br from-monokai-pink to-monokai-purple rounded-xs flex items-center justify-center shadow-md">
                        <Cpu className="text-white w-4 h-4" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight bg-gradient-to-r from-white to-gruv-light-4 bg-clip-text text-transparent">
                        Stepbit
                    </span>
                </div>

                <div className="px-1">
                    <ProviderSelector />
                </div>

                <nav className="flex flex-col gap-1 flex-grow overflow-y-auto pr-1 min-h-0">
                    <SidebarItem to="/" icon={LayoutDashboard}>Dashboard</SidebarItem>
                    <SidebarItem to="/chat" icon={MessageSquare}>Chat</SidebarItem>
                    <SidebarItem to="/database" icon={Database}>Database</SidebarItem>
                    <SidebarItem to="/db-explorer" icon={Database}>SQL Explorer</SidebarItem>
                    <SidebarItem to="/skills" icon={BookOpen}>Skills</SidebarItem>
                    
                    {llmosConnected && (
                        <>
                            <div className="h-px bg-gruv-dark-4/30 my-1 mx-2" />
                            <SidebarItem to="/mcp-tools" icon={Wrench}>MCP Tools</SidebarItem>
                            <SidebarItem to="/reasoning" icon={Zap}>Reasoning</SidebarItem>
                            <SidebarItem to="/pipelines" icon={Workflow}>Pipelines</SidebarItem>
                            <SidebarItem to="/goals" icon={Target}>Goals</SidebarItem>
                            <SidebarItem to="/scheduled-jobs" icon={AlarmClock}>Scheduled Jobs</SidebarItem>
                            <SidebarItem to="/triggers" icon={BellRing}>Triggers</SidebarItem>
                            <SidebarItem to="/executions" icon={History}>Executions</SidebarItem>
                        </>
                    )}
                    
                    <SidebarItem to="/settings" icon={Settings}>Settings</SidebarItem>
                </nav>

                <div className="mt-auto p-2.5 bg-gruv-dark-2/40 rounded-xs border border-gruv-dark-4/20 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                            isOnline && apiConnected ? "bg-monokai-green" : "bg-monokai-red"
                        )} />
                        <span className={cn(
                            "text-[9px] font-mono uppercase tracking-wider truncate",
                            isOnline && apiConnected ? "text-monokai-green" : "text-monokai-red"
                        )}>
                            API: {isOnline && apiConnected ? "Online" : "Offline"}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                            isOnline && dbConnected ? "bg-monokai-aqua" : "bg-monokai-orange"
                        )} />
                        <span className={cn(
                            "text-[9px] font-mono uppercase tracking-wider truncate",
                            isOnline && dbConnected ? "text-monokai-aqua" : "text-monokai-orange"
                        )}>
                            DB: {isOnline && dbConnected ? "Online" : "Offline"}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                            isOnline && llmosConnected ? "bg-monokai-orange" : "bg-gruv-dark-4"
                        )} />
                        <span className={cn(
                            "text-[9px] font-mono uppercase tracking-wider truncate",
                            isOnline && llmosConnected ? "text-monokai-orange" : "text-gruv-gray"
                        )}>
                            stepbit-core: {isOnline && llmosConnected ? "Online" : "Offline"}
                        </span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow min-w-0 overflow-auto relative">
                <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-monokai-pink/4 to-transparent pointer-events-none" />
                <div className="p-4 md:p-5 relative z-10 w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
