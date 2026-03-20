import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function Card({ children, className, hoverable = true }: { children: React.ReactNode, className?: string, hoverable?: boolean }) {
  return (
    <div className={cn(
      "p-8 rounded-3xl bg-card border border-border shadow-sm transition-all",
      hoverable && "hover:border-monokai-blue/30 hover:shadow-xl hover:-translate-y-1",
      className
    )}>
      {children}
    </div>
  )
}

export function Badge({ children, variant = 'blue', className }: { children: React.ReactNode, variant?: 'blue' | 'pink' | 'green' | 'yellow' | 'purple' | 'orange', className?: string }) {
  const variants = {
    blue: "bg-monokai-blue/10 text-monokai-blue border-monokai-blue/20",
    pink: "bg-monokai-pink/10 text-monokai-pink border-monokai-pink/20",
    green: "bg-monokai-green/10 text-monokai-green border-monokai-green/20",
    yellow: "bg-monokai-yellow/10 text-monokai-yellow border-monokai-yellow/20",
    purple: "bg-monokai-purple/10 text-monokai-purple border-monokai-purple/20",
    orange: "bg-monokai-orange/10 text-monokai-orange border-monokai-orange/20",
  }

  return (
    <span className={cn("px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full border", variants[variant], className)}>
      {children}
    </span>
  )
}
