// Veloura Manager V2 — ChartCard wrapper
// Thin wrapper around recharts components to keep consistent styling and
// responsive container behavior. Spec section 7.19 lists ChartCard. Colors
// use the brand design tokens (chart palette lives in designTokens).

import type { ReactNode } from 'react';
import { Card } from '../common/Card';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, action, children, className }: ChartCardProps) {
  return (
    <Card padding="md" className={className}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-text-primary text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}
