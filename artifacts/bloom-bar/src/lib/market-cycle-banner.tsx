import React from 'react';
import type { MarketCycleSummary } from './market-schedule';

export function MarketCycleBanner({
  summary,
  testId,
}: {
  summary: MarketCycleSummary;
  testId: string;
}) {
  return (
    <div
      className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground"
      data-testid={testId}
    >
      <span data-testid={`${testId}-date`}>{summary.shortDate}</span>
      <span className="text-foreground/35">·</span>
      <span data-testid={`${testId}-status`}>{summary.status}</span>
    </div>
  );
}