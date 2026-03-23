import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type DialogVariant = 'alert' | 'confirm';
type DialogTone = 'default' | 'danger' | 'success';

type DialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type DialogRequest = DialogOptions & {
  id: number;
  variant: DialogVariant;
};

type DialogContextValue = {
  alert: (options: DialogOptions) => Promise<void>;
  confirm: (options: DialogOptions) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<DialogRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const nextIdRef = useRef(1);

  const closeDialog = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setActiveDialog(null);
  }, []);

  const openDialog = useCallback((variant: DialogVariant, options: DialogOptions) => {
    setActiveDialog({
      id: nextIdRef.current++,
      variant,
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      tone: options.tone ?? 'default',
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo<DialogContextValue>(
    () => ({
      alert: async (options) => {
        await openDialog('alert', options);
      },
      confirm: (options) => openDialog('confirm', options),
    }),
    [openDialog],
  );

  useEffect(() => {
    if (!activeDialog) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDialog, closeDialog]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {activeDialog && (
          <AppDialog
            key={activeDialog.id}
            dialog={activeDialog}
            onCancel={() => closeDialog(false)}
            onConfirm={() => closeDialog(true)}
          />
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useAppDialog must be used within AppDialogProvider');
  }
  return context;
}

function AppDialog({
  dialog,
  onCancel,
  onConfirm,
}: {
  dialog: DialogRequest;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const tone = dialog.tone ?? 'default';
  const isConfirm = dialog.variant === 'confirm';

  const toneClasses =
    tone === 'danger'
      ? {
          panel: 'border-monokai-pink/30',
          badge: 'bg-monokai-pink/10 text-monokai-pink',
          confirm: 'bg-monokai-pink text-white hover:brightness-110 shadow-monokai-pink/20',
          icon: AlertTriangle,
        }
      : tone === 'success'
        ? {
            panel: 'border-monokai-green/30',
            badge: 'bg-monokai-green/10 text-monokai-green',
            confirm: 'bg-monokai-green text-black hover:brightness-110 shadow-monokai-green/20',
            icon: CheckCircle2,
          }
        : {
            panel: 'border-monokai-aqua/30',
            badge: 'bg-monokai-aqua/10 text-monokai-aqua',
            confirm: 'bg-monokai-aqua text-black hover:brightness-110 shadow-monokai-aqua/20',
            icon: Info,
          };

  const Icon = toneClasses.icon;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Close dialog"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className={`relative w-full max-w-lg overflow-hidden rounded-[1.75rem] border bg-gruv-dark-1/95 shadow-2xl ${toneClasses.panel}`}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses.badge}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 id="app-dialog-title" className="text-lg font-bold text-gruv-light-1">
                {dialog.title}
              </h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-gruv-light-4">
                {isConfirm ? 'Confirmation Required' : 'System Message'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-2 text-gruv-light-4 transition-colors hover:bg-white/5 hover:text-gruv-light-1"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="text-sm leading-7 text-gruv-light-3">
            {dialog.description ?? 'Please review this action before continuing.'}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/10 px-6 py-5 sm:flex-row sm:justify-end">
          {isConfirm && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gruv-light-2 transition-colors hover:bg-white/5"
            >
              {dialog.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shadow-lg ${toneClasses.confirm}`}
          >
            {dialog.confirmLabel ?? (isConfirm ? 'Confirm' : 'OK')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
