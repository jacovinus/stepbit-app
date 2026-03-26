import React from 'react';
import { Bot, Code, Eye, User, Wrench } from 'lucide-react';
import { clsx } from 'clsx';
import { MarkdownContent } from '../MarkdownContent';
import type { Message, TurnCapabilityContext } from '../../types';
import { TurnCapabilityContextCard } from './TurnCapabilityContextCard';

type Props = {
  message: Message;
  index: number;
  raw: boolean;
  onToggleRaw: () => void;
};

function assistantTurnContext(message: Message): TurnCapabilityContext | undefined {
  return message.role === 'assistant' ? (message.metadata?.turn_context as TurnCapabilityContext | undefined) : undefined;
}

export const ChatMessageRow: React.FC<Props> = ({ message, index, raw, onToggleRaw }) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const turnContext = assistantTurnContext(message);

  return (
    <div
      key={index}
      className={clsx(
        'flex gap-4 w-full min-w-0',
        isUser ? 'self-end flex-row-reverse justify-start' : 'self-start justify-start',
      )}
    >
      <div
        className={clsx(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg',
          isUser
            ? 'bg-gruv-dark-3'
            : isTool
              ? 'bg-monokai-aqua/10 border border-monokai-aqua/20'
              : 'bg-monokai-pink/10 border border-monokai-pink/20',
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : isTool ? <Wrench className="w-5 h-5 text-monokai-aqua" /> : <Bot className="w-5 h-5 text-monokai-pink" />}
      </div>
      <div
        className={clsx(
          'p-4 rounded-2xl text-sm leading-relaxed relative group/message w-full min-w-0 max-w-[780px]',
          isUser
            ? 'bg-gruv-dark-3 text-gruv-light-1'
            : isTool
              ? 'bg-monokai-aqua/5 border border-monokai-aqua/20'
              : 'bg-gruv-dark-2/50 border border-gruv-dark-4/30',
        )}
      >
        <button
          onClick={onToggleRaw}
          className="absolute -top-3 right-0 opacity-0 group-hover/message:opacity-100 transition-opacity p-1.5 bg-gruv-dark-4 border border-gruv-dark-4/50 rounded-lg shadow-xl text-gruv-light-4 hover:text-monokai-aqua z-10"
          title={raw ? 'Show Rendered' : 'Show Raw'}
        >
          {raw ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
        </button>

        {raw ? (
          <pre className="whitespace-pre-wrap font-mono text-[0.85em] text-gruv-light-3">{message.content}</pre>
        ) : (
          <MarkdownContent content={message.content} />
        )}

        <TurnCapabilityContextCard context={turnContext} />
      </div>
    </div>
  );
};
