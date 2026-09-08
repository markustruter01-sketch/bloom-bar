type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export type MarketPlanSaveAction = 'buy_list' | 'bouquet' | 'close_market';
export type MarketPlanSaveOutcome = 'success' | 'failure';

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the save flow.
  }
}

export function trackMarketPlanSave(
  action: MarketPlanSaveAction,
  outcome: MarketPlanSaveOutcome,
): void {
  trackEvent('market_plan_save', { action, outcome });
}