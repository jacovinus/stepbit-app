import React from 'react';
import type { Message, StructuredArtifact, StructuredCitation, StructuredOutputItem, TurnCapabilityContext } from '../../types';
import { CapabilityBadge, ToolCapabilityBadges } from '../capabilities/CapabilityBadges';
import { MarkdownContent } from '../MarkdownContent';
import { ChartComponent } from '../ChartComponent';

type Props = {
  message: Message;
};

function outputItemsFromMessage(message: Message): StructuredOutputItem[] {
  return Array.isArray(message.metadata?.output_items) ? (message.metadata.output_items as StructuredOutputItem[]) : [];
}

function turnContextFromMessage(message: Message): TurnCapabilityContext | undefined {
  return message.role === 'assistant' ? (message.metadata?.turn_context as TurnCapabilityContext | undefined) : undefined;
}

function artifactRenderer(artifact: StructuredArtifact) {
  const data = artifact.data || {};
  switch (artifact.family) {
    case 'chart':
      return <ChartComponent chartData={data as any} />;
    case 'markdown':
      return <MarkdownContent content={String(data.markdown || data.content || '')} />;
    case 'svg':
      return <div className="max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/10 p-4" dangerouslySetInnerHTML={{ __html: String(data.svg || data.content || '') }} />;
    case 'table': {
      const headers = Array.isArray(data.headers) ? data.headers : [];
      const rows = Array.isArray(data.rows) ? data.rows : [];
      if (headers.length === 0 || rows.length === 0) {
        return <pre className="whitespace-pre-wrap text-xs text-gruv-light-3">{JSON.stringify(data, null, 2)}</pre>;
      }
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gruv-dark-3 text-monokai-aqua font-bold border-b border-gruv-dark-4/30">
              <tr>{headers.map((header: string) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row: any[], index: number) => (
                <tr key={index} className="border-b border-gruv-dark-4/20">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{String(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'file':
      return <pre className="whitespace-pre-wrap text-xs text-gruv-light-3">{JSON.stringify(data, null, 2)}</pre>;
    default:
      return <pre className="whitespace-pre-wrap text-xs text-gruv-light-3">{JSON.stringify(data, null, 2)}</pre>;
  }
}

function usedToolLookup(context?: TurnCapabilityContext) {
  return new Map((context?.available_tools || []).map((tool) => [tool.name, tool]));
}

function citationItem(citation: StructuredCitation, index: number) {
  return (
    <a
      key={`${citation.source_id}-${index}`}
      href={citation.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-white/10 bg-black/10 p-3 hover:border-monokai-aqua/30"
    >
      <div className="flex flex-wrap items-center gap-2">
        <CapabilityBadge label="citation" tone="accent" />
        <span className="text-sm font-semibold text-gruv-light-1">{citation.title}</span>
      </div>
      <p className="mt-2 text-xs text-monokai-aqua break-all">{citation.url}</p>
      {citation.snippet ? <p className="mt-2 text-sm text-gruv-light-3">{citation.snippet}</p> : null}
    </a>
  );
}

function artifactItem(artifact: StructuredArtifact, index: number, context?: TurnCapabilityContext) {
  const tool = usedToolLookup(context).get(artifact.source_tool);
  return (
    <div key={`${artifact.source_tool}-${index}`} className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CapabilityBadge label={artifact.family} tone="warning" />
        <span className="text-sm font-semibold text-gruv-light-1">{artifact.title}</span>
        <CapabilityBadge label={artifact.source_tool} tone="neutral" />
      </div>
      {tool ? (
        <ToolCapabilityBadges
          readOnly={tool.read_only}
          openWorld={tool.open_world}
          destructive={false}
          tags={tool.tags}
        />
      ) : null}
      {artifactRenderer(artifact)}
    </div>
  );
}

export const StructuredArtifactsCard: React.FC<Props> = ({ message }) => {
  if (message.role !== 'assistant') return null;

  const outputItems = outputItemsFromMessage(message);
  if (outputItems.length === 0) return null;

  const context = turnContextFromMessage(message);
  const citations = outputItems.flatMap((item) => item.content.map((content) => content.citation).filter(Boolean) as StructuredCitation[]);
  const artifacts = outputItems.flatMap((item) => item.content.map((content) => content.artifact).filter(Boolean) as StructuredArtifact[]);

  if (citations.length === 0 && artifacts.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {citations.length > 0 ? (
        <div className="rounded-xs border border-white/10 bg-black/20 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <CapabilityBadge label={`${citations.length} citations`} tone="accent" />
          </div>
          <div className="space-y-2">
            {citations.map(citationItem)}
          </div>
        </div>
      ) : null}

      {artifacts.length > 0 ? (
        <div className="rounded-xs border border-white/10 bg-black/20 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <CapabilityBadge label={`${artifacts.length} artifacts`} tone="warning" />
          </div>
          <div className="space-y-3">
            {artifacts.map((artifact, index) => artifactItem(artifact, index, context))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
