// Veloura Manager V2 — Pagination
// Reusable numbered pagination for list pages.

import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1.5 pt-3">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className={clsx(
          'inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
          page === 0
            ? 'bg-surface text-text-muted cursor-not-allowed'
            : 'bg-surface text-text-secondary border border-border hover:bg-surface-alt'
        )}
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>
      {getPageNumbers().map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-2 text-text-muted text-sm select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p - 1)}
            className={clsx(
              'w-9 h-9 rounded-lg text-sm font-semibold transition-colors',
              page === p - 1
                ? 'bg-action text-white'
                : 'bg-surface text-text-secondary border border-border hover:bg-surface-alt'
            )}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className={clsx(
          'inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
          page >= totalPages - 1
            ? 'bg-surface text-text-muted cursor-not-allowed'
            : 'bg-surface text-text-secondary border border-border hover:bg-surface-alt'
        )}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
