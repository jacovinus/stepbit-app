import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { Database } from './pages/Database';
import { Settings } from './pages/Settings';
import { Skills } from './pages/Skills';
const McpTools = lazy(() => import('./pages/McpTools'));
const ReasoningPlayground = lazy(() => import('./pages/ReasoningPlayground'));
const DatabaseExplorer = lazy(() => import('./pages/DatabaseExplorer'));
const Pipelines = lazy(() => import('./pages/Pipelines'));
const ScheduledJobs = lazy(() => import('./pages/ScheduledJobs'));
const Triggers = lazy(() => import('./pages/Triggers'));
const ExecutionHistory = lazy(() => import('./pages/ExecutionHistory'));
const Goals = lazy(() => import('./pages/Goals'));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-8">
      <div className="rounded-xl border border-gruv-dark-3 bg-gruv-dark-1/80 px-5 py-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gruv-light-4">Loading View</p>
        <p className="mt-2 text-sm text-gruv-light-2">Fetching the next control-plane surface...</p>
      </div>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="database" element={<Database />} />
            <Route path="skills" element={<Skills />} />
            <Route path="mcp-tools" element={<LazyPage><McpTools /></LazyPage>} />
            <Route path="reasoning" element={<LazyPage><ReasoningPlayground /></LazyPage>} />
            <Route path="pipelines" element={<LazyPage><Pipelines /></LazyPage>} />
            <Route path="scheduled-jobs" element={<LazyPage><ScheduledJobs /></LazyPage>} />
            <Route path="triggers" element={<LazyPage><Triggers /></LazyPage>} />
            <Route path="executions" element={<LazyPage><ExecutionHistory /></LazyPage>} />
            <Route path="goals" element={<LazyPage><Goals /></LazyPage>} />
            <Route path="db-explorer" element={<LazyPage><DatabaseExplorer /></LazyPage>} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
