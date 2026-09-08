import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { NextMarketMetricCard } from '../App';
import { MarketCycleBanner } from './market-cycle-banner';
import { getMarketCycleSummary } from './market-schedule';

describe('market cycle banner', () => {
  it('renders the same canonical date and status for Markets and planning surfaces', () => {
    const summary = getMarketCycleSummary(new Date('2026-09-06T12:00:00Z'));
    const marketsMarkup = renderToStaticMarkup(
      <MarketCycleBanner summary={summary} testId="markets-cycle" />,
    );
    const planningMarkup = renderToStaticMarkup(
      <MarketCycleBanner summary={summary} testId="planning-cycle" />,
    );

    assert.match(marketsMarkup, /Sunday 13 Sep/);
    assert.match(marketsMarkup, />Next up</);
    assert.match(planningMarkup, /Sunday 13 Sep/);
    assert.match(planningMarkup, />Next up</);
    assert.equal(
      marketsMarkup.replaceAll('markets-cycle', 'cycle'),
      planningMarkup.replaceAll('planning-cycle', 'cycle'),
    );
  });

  it('renders the canonical date and status for the overview hero', () => {
    const summary = getMarketCycleSummary(new Date('2026-09-06T12:00:00Z'));
    const overviewMarkup = renderToStaticMarkup(
      <MarketCycleBanner summary={summary} testId="overview-cycle" />,
    );

    assert.match(overviewMarkup, /Sunday 13 Sep/);
    assert.match(overviewMarkup, />Next up</);
    assert.match(overviewMarkup, /data-testid="overview-cycle-date"/);
    assert.match(overviewMarkup, /data-testid="overview-cycle-status"/);
  });

  it('renders the shared status in the overview next-market metric', () => {
    const summary = getMarketCycleSummary(new Date('2026-09-06T12:00:00Z'));
    const metricMarkup = renderToStaticMarkup(
      <NextMarketMetricCard nextMarket={summary} checkedCount={2} totalBuyItems={5} />,
    );

    assert.match(metricMarkup, /data-testid="value-next-market">7 days/);
    assert.match(metricMarkup, /data-testid="overview-next-market-date">Sunday 13 Sep/);
    assert.match(metricMarkup, /data-testid="overview-next-market-status">Next up/);
    assert.match(metricMarkup, /buy list is 2 of 5 items ready/);
  });
});