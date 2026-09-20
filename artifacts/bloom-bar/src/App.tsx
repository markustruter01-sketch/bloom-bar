import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getGetMarketContextQueryKey,
  getGetSellThroughComparisonQueryKey,
  getListMarketsQueryKey,
  getListMarketScheduleOverridesQueryKey,
  useListFlowerPriceTracker,
  useGetSellThroughComparison,
  useListFlowerPrices,
  useListMarketScheduleOverrides,
  useUpsertMarketScheduleOverride,
  useDeleteMarketScheduleOverride,
  useGetMarketContext,
  useListMarkets,
  useReportMarketPurchases,
  useReplaceMarketCosts,
  useReplaceMarketActualPurchases,
  useUpdateMarketBouquetPlan,
  useUpdateMarketBuyItem,
  useUpdateMarketBuyList,
  useUpdateMarketClose,
  FlowerCategory as ApiFlowerCategory,
} from '@workspace/api-client-react';
import type {
  ActualPurchase,
  ActualPurchasesUpdate,
  BunchPurchaseInput,
  BouquetPlan,
  BuyItem as ApiBuyItem,
  CloseMarket,
  FlowerPriceHistory,
  FlowerPriceTrackerMarket,
  Market,
  MarketContext,
  MarketCost,
  MarketCostInput,
  MarketScheduleOverride,
  MarketScheduleOverrideUpdate,
  ReceiptCandidate,
} from '@workspace/api-client-react';
import { createWorker } from 'tesseract.js';
import { ErrorBoundary } from '@/components/error-boundary';
import { ToastAction } from '@/components/ui/toast';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  DollarSign,
  Flower2,
  Leaf,
  LayoutDashboard,
  LockKeyhole,
  LoaderCircle,
  ListFilter,
  Menu,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShoppingBasket,
  Sparkles,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  UnlockKeyhole,
  Upload,
  X,
} from 'lucide-react';
import {
  Link,
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
} from 'wouter';

import NotFound from '@/pages/not-found';
import { trackMarketPlanSave } from '@/lib/analytics';
import { MarketCycleBanner } from '@/lib/market-cycle-banner';
import { formatMarketDate, formatMarketDay, getEffectiveMarketDate, getMarketDate, getMarketScheduleOverride, getMarketStatus, getUtcDayKey, marketSchedule, millisecondsUntilNextUtcDay, type MarketCycleSummary } from '@/lib/market-schedule';

const queryClient = new QueryClient();
const assetBase = `${import.meta.env?.BASE_URL ?? '/'}assets`;
const logoImage = `${assetBase}/bloom-bar-logo.png`;
const posterImage = `${assetBase}/umbrella-bouquet-poster.png`;

const flowerCategories = [
  ApiFlowerCategory.Gum,
  ApiFlowerCategory.Textural_Foliage,
  ApiFlowerCategory.Classic_Blooms,
  ApiFlowerCategory.Statement_Blooms,
  ApiFlowerCategory.Premium_Natives,
] as const;

type FlowerCategory = (typeof flowerCategories)[number];

type Flower = {
  id: number;
  common: string;
  botanical: string;
  category: FlowerCategory;
  retail: number;
  wholesale: number;
  margin: number;
  role: string;
  seasonality: string;
  enrichment: 'Ready' | 'Needs notes' | 'Missing';
  colour: string;
};

type BuyItem = ApiBuyItem;

const flowers: Flower[] = [
  { id: 1, common: 'Lisianthus', botanical: 'Eustoma grandiflorum', category: ApiFlowerCategory.Classic_Blooms, retail: 8.5, wholesale: 3.2, margin: 62, role: 'Soft bloom', seasonality: 'Autumn · Winter', enrichment: 'Ready', colour: '#b6a1c8' },
  { id: 2, common: 'Disbud chrysanthemum', botanical: 'Chrysanthemum morifolium', category: ApiFlowerCategory.Statement_Blooms, retail: 9, wholesale: 3.7, margin: 59, role: 'Hero bloom', seasonality: 'All year', enrichment: 'Ready', colour: '#e3a38e' },
  { id: 3, common: 'Snapdragon', botanical: 'Antirrhinum majus', category: ApiFlowerCategory.Classic_Blooms, retail: 7.5, wholesale: 2.4, margin: 68, role: 'Line + height', seasonality: 'Winter · Spring', enrichment: 'Needs notes', colour: '#cfb9d4' },
  { id: 4, common: 'Daisy', botanical: 'Argyranthemum frutescens', category: ApiFlowerCategory.Classic_Blooms, retail: 4.5, wholesale: 1.3, margin: 71, role: 'Cheerful bloom', seasonality: 'Spring · Summer', enrichment: 'Ready', colour: '#e6c26c' },
  { id: 5, common: 'Queen Anne’s lace', botanical: 'Daucus carota', category: ApiFlowerCategory.Textural_Foliage, retail: 5, wholesale: 1.8, margin: 64, role: 'Air + texture', seasonality: 'Late spring', enrichment: 'Missing', colour: '#d9d5c8' },
  { id: 6, common: 'Stock', botanical: 'Matthiola incana', category: ApiFlowerCategory.Classic_Blooms, retail: 6.5, wholesale: 2.1, margin: 68, role: 'Scent + body', seasonality: 'Winter · Spring', enrichment: 'Ready', colour: '#9ca7c7' },
  { id: 7, common: 'Billy buttons', botanical: 'Craspedia globosa', category: ApiFlowerCategory.Textural_Foliage, retail: 5.5, wholesale: 1.4, margin: 75, role: 'Graphic accent', seasonality: 'All year', enrichment: 'Needs notes', colour: '#d6ae4e' },
  { id: 8, common: 'Anemone', botanical: 'Anemone coronaria', category: ApiFlowerCategory.Statement_Blooms, retail: 8, wholesale: 3.1, margin: 61, role: 'Statement colour', seasonality: 'Winter · Spring', enrichment: 'Ready', colour: '#9d7ba4' },
  { id: 9, common: 'Eucalyptus foliage', botanical: 'Eucalyptus cinerea', category: ApiFlowerCategory.Gum, retail: 3.5, wholesale: 0.9, margin: 74, role: 'Scent + structure', seasonality: 'All year', enrichment: 'Ready', colour: '#9aa58b' },
  { id: 10, common: 'Coral peony', botanical: 'Paeonia lactiflora', category: ApiFlowerCategory.Statement_Blooms, retail: 12, wholesale: 5.9, margin: 51, role: 'Premium hero', seasonality: 'Late spring', enrichment: 'Missing', colour: '#df8e80' },
];

const priceBands = [
  { name: 'Petite', price: 35, stems: '8–10 stems', note: 'A sweet handful' },
  { name: 'Market', price: 55, stems: '12–15 stems', note: 'Our Sunday best seller' },
  { name: 'Generous', price: 75, stems: '18–22 stems', note: 'For the full table' },
];

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/flowers', label: 'Flower library', icon: Flower2 },
  { href: '/flower-price-tracker', label: 'Flower Price Tracker', icon: TrendingUp },
  { href: '/markets', label: 'Markets', icon: Store },
];

function money(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

function unitMoney(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function Button({ children, className = '', onClick, type = 'button', testId, disabled = false }: { children: ReactNode; className?: string; onClick?: () => void; type?: 'button' | 'submit'; testId: string; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>{children}</button>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type BuySaveAction =
  | { kind: 'toggle'; id: number }
  | { kind: 'lock' }
  | { kind: 'unlock' }
  | { kind: 'actual-purchases' }
  | { kind: 'costs' }
  | { kind: 'report' };

function SaveFeedback({ state, onRetry, savedMessage = 'Saved to the market plan.' }: { state: SaveState; onRetry: () => void; savedMessage?: string }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return <p className="flex items-center gap-2 rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground" role="status" data-testid="save-status-saving"><LoaderCircle size={14} className="animate-spin" /> Saving your changes…</p>;
  }
  if (state === 'saved') {
    return <p className="flex items-center gap-2 rounded-md bg-[#edf0df] px-4 py-3 text-xs text-primary" role="status" data-testid="save-status-saved"><CheckCircle2 size={14} /> {savedMessage}</p>;
  }
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive" role="alert" data-testid="save-status-error"><span>Your changes are still here, but we couldn’t save them.</span><Button onClick={onRetry} className="h-8 border border-destructive/25 bg-background px-3 text-destructive hover:bg-destructive/5" testId="button-retry-save"><ArrowRight size={13} /> Try again</Button></div>;
}

function announceSave(success: boolean, savedMessage: string, retry: () => void) {
  if (success) {
    toast({ title: 'Saved', description: savedMessage });
    return;
  }
  toast({
    variant: 'destructive',
    title: 'Save failed',
    description: 'Your changes are still here. Try again when you’re ready.',
    action: <ToastAction altText="Retry save" onClick={retry}>Retry</ToastAction>,
  });
}

function AppShell({ children, remainingBuyItems, nextMarket }: { children: ReactNode; remainingBuyItems: number; nextMarket: MarketCycleSummary }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pageTitle = location === '/' ? 'Good morning, florist' : location.includes('/buy') ? 'Buy list' : location.includes('/close') ? 'Close market' : location.includes('/bouquets') ? 'Bouquet planning' : location === '/flowers' ? 'Flower library' : location === '/flower-price-tracker' ? 'Flower Price Tracker' : location === '/markets' ? 'Markets' : 'Bloom Bar';
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 px-7 pb-8 pt-7">
          <img src={logoImage} alt="The Bloom Bar botanical logo" className="h-14 w-14 rounded-full object-cover" data-testid="img-bloom-logo" />
          <div>
            <div className="display-font text-[21px] leading-none text-sidebar-primary">Bloom Bar</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[.25em] text-sidebar-foreground/60">Market notes</div>
          </div>
        </div>
        <div className="mx-6 mb-5 h-px bg-sidebar-border/70" />
        <nav className="flex-1 space-y-1 px-4" aria-label="Main navigation">
          <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/45">The studio</p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-primary'}`}><Icon size={17} strokeWidth={active ? 2.2 : 1.7} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}</Link>;
          })}
          <p className="mb-3 mt-8 px-3 font-mono text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/45">Next market</p>
          <Link href="/markets/next/buy" data-testid="link-nav-buy-list" className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${location.includes('/buy') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-primary'}`}><ShoppingBasket size={17} /><span>Buy list</span><span className="ml-auto rounded-full bg-accent/80 px-1.5 py-0.5 font-mono text-[10px] text-sidebar-primary-foreground">{remainingBuyItems}</span></Link>
          <Link href="/markets/next/bouquets" data-testid="link-nav-bouquets" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${location.includes('/bouquets') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-primary'}`}><Sparkles size={17} /><span>Bouquets</span></Link>
          <Link href="/markets/next/close" data-testid="link-nav-close-market" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${location.includes('/close') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-primary'}`}><ClipboardCheck size={17} /><span>Close market</span></Link>
        </nav>
        <div className="mx-5 mb-5 rounded-lg border border-sidebar-border bg-sidebar-accent/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-sidebar-primary"><span className="h-2 w-2 rounded-full bg-[#c8d58f]" /> Morning setup</div>
          <p className="text-xs leading-relaxed text-sidebar-foreground/60">Your next market is in {nextMarket.daysUntil}. {nextMarket.recurrence} from {nextMarket.fullDate.split(' · ')[1]}.</p>
          <Link href="/markets/next/buy" data-testid="link-sidebar-open-buy" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sidebar-primary underline decoration-sidebar-primary/40 underline-offset-4">Open plan <ArrowRight size={12} /></Link>
        </div>
      </aside>
      <div className="md:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-foreground/10 bg-background/90 px-5 backdrop-blur-md md:px-10">
          <div className="flex items-center gap-3">
            <Button className="h-9 w-9 rounded-md p-0 text-muted-foreground hover:bg-muted md:hidden" onClick={() => setMenuOpen(!menuOpen)} testId="button-open-menu">{menuOpen ? <X size={18} /> : <Menu size={18} />}</Button>
            <div className="md:hidden"><img src={logoImage} alt="Bloom Bar" className="h-9 w-9 rounded-full object-cover" data-testid="img-mobile-logo" /></div>
            <div className="hidden font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground sm:block">Redcliffe / <span className="text-foreground">{pageTitle}</span></div>
            <div className="font-serif text-lg md:hidden">{pageTitle}</div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#94aa67]" /> Saved to market plan</div>
            <Button className="h-9 w-9 rounded-full border border-foreground/10 bg-card p-0 text-muted-foreground hover:bg-muted" onClick={() => window.alert('No new notes — you are all caught up.')} testId="button-notifications"><Bell size={16} /></Button>
            <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-secondary font-serif text-sm text-secondary-foreground sm:flex" data-testid="avatar-owner">B</div>
          </div>
        </header>
        {menuOpen && <div className="absolute inset-x-0 top-[72px] z-20 border-b border-foreground/10 bg-sidebar p-4 text-sidebar-foreground shadow-lg md:hidden"><nav className="space-y-1">{navItems.map(({ href, label, icon: Icon }) => <Link onClick={() => setMenuOpen(false)} key={href} href={href} data-testid={`link-mobile-${label.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-sidebar-accent/20"><Icon size={17} />{label}</Link>)}<div className="my-2 h-px bg-sidebar-border" /><Link onClick={() => setMenuOpen(false)} href="/markets/next/buy" data-testid="link-mobile-buy-list" className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-sidebar-accent/20"><ShoppingBasket size={17} />Buy list</Link><Link onClick={() => setMenuOpen(false)} href="/markets/next/bouquets" data-testid="link-mobile-bouquets" className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-sidebar-accent/20"><Sparkles size={17} />Bouquets</Link><Link onClick={() => setMenuOpen(false)} href="/markets/next/close" data-testid="link-mobile-close" className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-sidebar-accent/20"><ClipboardCheck size={17} />Close market</Link></nav></div>}
        <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-7 md:px-10 md:pt-10 mobile-safe-bottom">{children}</main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-xl border border-foreground/10 bg-sidebar/95 px-2 py-2 text-sidebar-foreground shadow-xl backdrop-blur-md md:hidden" aria-label="Mobile navigation">
        {[...navItems, { href: '/markets/next/buy', label: 'Buy', icon: ShoppingBasket }].map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-bottom-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex min-w-[56px] flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] ${location === href || (href.includes('/buy') && location.includes('/buy')) ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65'}`}><Icon size={17} /><span>{label}</span></Link>)}
      </nav>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground"><span className="h-px w-7 bg-accent" />{eyebrow}</div><h1 className="display-font text-4xl leading-[1.02] tracking-[-.035em] text-foreground md:text-5xl">{title}</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>{action}</div>;
}

function MetricCard({ label, value, detail, accent = 'sage', icon: Icon }: { label: string; value: string; detail: ReactNode; accent?: 'sage' | 'lilac' | 'peach'; icon: typeof TrendingUp }) {
  const accents = { sage: 'bg-[#dce3c2]', lilac: 'bg-[#e5d8e9]', peach: 'bg-[#f1d0c3]' };
  return <div className="paper-card rounded-lg border border-card-border p-5" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-5 flex items-start justify-between"><span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-full ${accents[accent]} text-foreground`}><Icon size={15} strokeWidth={1.8} /></span></div><div className="font-serif text-3xl tracking-[-.04em]" data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}

export function NextMarketMetricCard({ nextMarket, checkedCount, totalBuyItems }: { nextMarket: MarketCycleSummary; checkedCount: number; totalBuyItems: number }) {
  return <MetricCard
    label="Next market"
    value={nextMarket.daysUntil}
    detail={<div className="space-y-1.5">
      <MarketCycleBanner summary={nextMarket} testId="overview-next-market" />
      <span className="block">buy list is {checkedCount} of {totalBuyItems} items ready</span>
    </div>}
    icon={Clock3}
    accent="peach"
  />;
}

function Dashboard({ buyItems, markets, nextMarket, scheduleOverrides }: { buyItems: BuyItem[]; markets: Market[]; nextMarket: MarketCycleSummary; scheduleOverrides: MarketScheduleOverride[] }) {
  const checkedCount = buyItems.filter((item) => item.checked).length;
  const activeMarkets = markets.filter((market) => getMarketScheduleOverride(market.cycle, scheduleOverrides)?.status !== 'skipped');
  const recentPerformance = activeMarkets
    .slice()
    .sort((a, b) => a.cycle - b.cycle)
    .slice(-4)
    .map((market, index, recent) => {
      const maxRevenue = Math.max(...recent.map((item) => item.revenue), 1);
      return {
        ...market,
        label: formatMarketDate(getEffectiveMarketDate(market.cycle, scheduleOverrides) ?? getMarketDate(market.cycle), 'short'),
        height: `${Math.max(18, Math.round((market.revenue / maxRevenue) * 100))}%`,
        current: market.cycle === nextMarket.cycle,
        index,
      };
    });
  const lastMarket = activeMarkets
    .filter((market) => market.cycle < nextMarket.cycle)
    .sort((a, b) => b.cycle - a.cycle)[0];
  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-xl border border-foreground/10 bg-[#e8e4cd] px-6 py-8 md:px-10 md:py-11">
      <div className="relative max-w-2xl">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary"><CalendarDays size={14} /> <MarketCycleBanner summary={nextMarket} testId="overview-cycle" /> <span className="text-primary/45">/</span> {nextMarket.recurrence}</div>
        <h1 className="display-font max-w-xl text-4xl leading-[1.02] tracking-[-.04em] text-primary md:text-[52px]">The next bunch<br /><i className="font-normal text-[#877194]">starts here.</i></h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-primary/70">A tidy plan for your next morning at Redcliffe Markets. You have the good stems covered — now make the little things easy.</p>
        <div className="mt-7 flex flex-wrap gap-2.5"><Link href="/markets/next/buy" data-testid="link-hero-buy-list" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Open buy list <ArrowRight size={15} /></Link><Link href="/markets/next/bouquets" data-testid="link-hero-bouquets" className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-background/40 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-background/65">Plan bouquets <Sparkles size={15} /></Link></div>
      </div>
      <div className="absolute -bottom-10 right-[-10px] hidden w-[235px] rotate-[-5deg] rounded-sm border-[8px] border-[#f2ebe5] shadow-lg lg:block"><img src={posterImage} alt="Bloom Bar umbrella bouquet poster" className="block w-full" data-testid="img-bouquet-poster" /></div>
    </section>

    <section className="grid gap-3 md:grid-cols-3">
       <MetricCard label="Last market" value={money(lastMarket?.revenue ?? 0)} detail={lastMarket ? `${money(lastMarket.revenue - lastMarket.spend)} after flower spend` : 'No closed market yet'} icon={TrendingUp} accent="sage" />
       <MetricCard label="Gross margin" value={`${(lastMarket?.margin ?? 0).toFixed(1)}%`} detail={lastMarket ? `${money(lastMarket.spend)} flower spend` : 'No closed market yet'} icon={BarChart3} accent="lilac" />
       <NextMarketMetricCard nextMarket={nextMarket} checkedCount={checkedCount} totalBuyItems={buyItems.length} />
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="paper-card overflow-hidden rounded-lg border border-card-border">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4 md:px-6"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Sunday rhythm</p><h2 className="mt-1 font-serif text-xl">Recent performance</h2></div><Link href="/markets" data-testid="link-dashboard-markets" className="text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4">View markets</Link></div>
        <div className="p-5 md:p-6">
          <div className="flex h-[168px] items-end gap-2 border-b border-l border-foreground/10 px-2 pb-0 pt-5 md:gap-5">
             {recentPerformance.map((item) => <div key={item.cycle} className="group flex h-full flex-1 flex-col justify-end gap-2"><div className="relative flex flex-1 items-end"><div className={`relative w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80 ${item.current ? 'bg-primary' : 'bg-[#b9c29b]'}`} style={{ height: item.height }}><span className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{money(item.revenue)}</span></div></div><span className={`pb-2 text-center font-mono text-[9px] ${item.current ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{item.label}</span></div>)}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Revenue per market</span><span className="flex items-center gap-1.5 text-[#66804e]"><TrendingUp size={13} /> 16.3% over 4 Sundays</span></div>
        </div>
      </div>
      <div className="paper-card rounded-lg border border-card-border p-5 md:p-6">
        <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Fresh for Sunday</p><h2 className="mt-1 font-serif text-xl">Buy list</h2></div><Link href="/markets/next/buy" data-testid="link-dashboard-buy-list" className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-primary transition-colors hover:bg-secondary"><ArrowRight size={15} /></Link></div>
        <div className="mt-6 flex items-center gap-4"><div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${checkedCount / buyItems.length * 360}deg, hsl(var(--muted)) 0deg)` }}><div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-card"><span className="font-serif text-xl">{checkedCount}</span><span className="font-mono text-[8px] uppercase text-muted-foreground">of {buyItems.length}</span></div></div><div><div className="text-sm font-semibold">{checkedCount === buyItems.length ? 'All set to buy' : `${buyItems.length - checkedCount} items to source`}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Market morning is looking<br />beautifully organised.</p></div></div>
        <div className="mt-6 space-y-3">{buyItems.slice(0, 3).map((item) => <div className="flex items-center gap-3 text-sm" key={item.id}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.checked ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/20 text-transparent'}`}>{item.checked && <Check size={12} strokeWidth={3} />}</span><span className={item.checked ? 'text-muted-foreground line-through' : ''}>{item.flower}</span><span className="ml-auto font-mono text-[10px] text-muted-foreground">{item.qty} {item.unit}</span></div>)}</div>
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Make it happen</p><h2 className="mt-1 font-serif text-2xl">Quick actions</h2></div><span className="hidden text-xs text-muted-foreground sm:block">A few good places to start</span></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/markets/next/buy" data-testid="link-quick-buy" className="group flex items-center gap-4 rounded-lg border border-foreground/10 bg-[#eee6dc] p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfc8d8] text-primary"><ShoppingBasket size={18} /></span><span><span className="block text-sm font-semibold">Build buy list</span><span className="mt-1 block text-xs text-muted-foreground">Source the right stems</span></span><ArrowRight className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-1" size={16} /></Link>
        <Link href="/markets/next/bouquets" data-testid="link-quick-bouquets" className="group flex items-center gap-4 rounded-lg border border-foreground/10 bg-[#e8e8d5] p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d4ddbe] text-primary"><Sparkles size={18} /></span><span><span className="block text-sm font-semibold">Plan bouquets</span><span className="mt-1 block text-xs text-muted-foreground">Set the Sunday mix</span></span><ArrowRight className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-1" size={16} /></Link>
        <Link href="/markets/next/close" data-testid="link-quick-close" className="group flex items-center gap-4 rounded-lg border border-foreground/10 bg-[#e8dfe5] p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d6c1dc] text-primary"><ClipboardCheck size={18} /></span><span><span className="block text-sm font-semibold">Close the market</span><span className="mt-1 block text-xs text-muted-foreground">Pack down with care</span></span><ArrowRight className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-1" size={16} /></Link>
      </div>
    </section>
  </div>;
}

export function FlowerPriceTracker({ prices, isLoading }: { prices: FlowerPriceHistory[]; isLoading: boolean }) {
  const [expandedFlowers, setExpandedFlowers] = useState<Set<string>>(() => new Set());

  const toggleHistory = (flower: string) => {
    setExpandedFlowers((current) => {
      const next = new Set(current);
      if (next.has(flower)) {
        next.delete(flower);
      } else {
        next.add(flower);
      }
      return next;
    });
  };

  return <section className="mb-8 rounded-lg border border-primary/15 bg-[#e8e4cd] p-5 md:p-6" data-testid="section-flower-price-tracker">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><TrendingUp size={13} /> Buy List Report history</div>
        <h2 className="mt-2 font-serif text-2xl text-primary">Flower Price Tracker</h2>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-primary/65">Actual unit costs from completed reports, ready to guide the next proposed buy list.</p>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[.12em] text-primary/55">{prices.length} flower{prices.length === 1 ? '' : 's'} tracked</span>
    </div>
    {isLoading ? <p className="mt-5 rounded-md bg-primary/5 px-4 py-3 text-xs text-primary/65" role="status">Loading reported prices…</p> : prices.length === 0 ? <p className="mt-5 rounded-md bg-primary/5 px-4 py-3 text-xs text-primary/65">Complete a Buy List Report to start building price history.</p> : <div className="mt-5 overflow-hidden rounded-md border border-primary/10 bg-card">
      <div className="hidden grid-cols-[1.35fr_1fr_1fr_1fr] border-b border-foreground/10 bg-muted/55 px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground md:grid"><span>Flower</span><span>Latest</span><span>Previous</span><span>Movement</span></div>
      {prices.map((price) => {
        const flowerKey = price.flower.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const historyPanelId = `flower-price-history-${flowerKey}`;
        const isExpanded = expandedFlowers.has(price.flower);
        const changeLabel = price.change === null ? 'New' : `${price.change >= 0 ? '+' : ''}${unitMoney(price.change)}${price.changePercent === null ? '' : ` (${price.changePercent >= 0 ? '+' : ''}${price.changePercent.toFixed(1)}%)`}`;
        return <div key={price.flower} data-testid={`row-flower-price-${flowerKey}`} className="grid gap-3 border-b border-foreground/10 px-4 py-4 last:border-0 md:grid-cols-[1.35fr_1fr_1fr_1fr] md:items-center">
          <div>
            <span className="block text-sm font-semibold">{price.flower}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{price.category}</span>
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={historyPanelId}
              data-testid={`button-toggle-flower-history-${flowerKey}`}
              onClick={() => toggleHistory(price.flower)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-[11px] font-semibold text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary/70"
            >
              {isExpanded ? 'Hide full history' : 'View full history'}
              <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div><span className="block font-mono text-sm">{unitMoney(price.latest.unitCost)}</span><span className="mt-1 block text-[11px] text-muted-foreground">{price.latest.date}</span></div>
          <div><span className="block font-mono text-sm">{price.previous ? unitMoney(price.previous.unitCost) : '—'}</span><span className="mt-1 block text-[11px] text-muted-foreground">{price.previous ? price.previous.date : 'No previous report'}</span></div>
          <div className={price.change === null ? 'text-xs text-muted-foreground' : price.change > 0 ? 'text-xs font-semibold text-[#a65e4f]' : price.change < 0 ? 'text-xs font-semibold text-[#64804e]' : 'text-xs font-semibold text-muted-foreground'}>{changeLabel}</div>
          {isExpanded && <div id={historyPanelId} data-testid={`panel-flower-history-${flowerKey}`} className="col-span-full rounded-md border border-primary/10 bg-primary/[.035] p-3 md:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-[.14em] text-primary/70">Full reported history</h3>
              <span className="font-mono text-[10px] text-muted-foreground">{price.history.length} report{price.history.length === 1 ? '' : 's'}</span>
            </div>
            <div className="mt-3 divide-y divide-foreground/10 rounded border border-foreground/10 bg-card">
              {price.history.map((point: { marketCycle: number; date: string; unitCost: number }, index: number) => <div key={`${point.marketCycle}-${point.date}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-semibold">{point.date}</span>
                  {index === 0 && <span className="rounded-full bg-[#dce3c2] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-primary">Latest</span>}
                </span>
                <span className="font-mono font-semibold text-primary">{unitMoney(point.unitCost)} / unit</span>
              </div>)}
            </div>
          </div>}
        </div>;
      })}
    </div>}
  </section>;
}

export function FlowerPriceTrackerPage({ reports, isLoading }: { reports: FlowerPriceTrackerMarket[]; isLoading: boolean }) {
  const [selectedCycle, setSelectedCycle] = useState<number | null>(null);
  useEffect(() => {
    if (reports.length === 0) {
      setSelectedCycle(null);
      return;
    }
    if (selectedCycle === null || !reports.some((report) => report.marketCycle === selectedCycle)) {
      setSelectedCycle(reports[0].marketCycle);
    }
  }, [reports, selectedCycle]);

  const selectedReport = reports.find((report) => report.marketCycle === selectedCycle) ?? reports[0];
  return <div>
    <PageIntro
      eyebrow="The studio / reported purchases"
      title="Flower Price Tracker"
      description="Open a market date to see exactly what each bunch cost. Reports stay as line-items so supplier differences remain visible."
    />
    {isLoading ? <p className="rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground" role="status">Loading reported purchase lines…</p> : reports.length === 0 ? <div className="rounded-lg border border-dashed border-foreground/15 bg-card px-6 py-12 text-center"><TrendingUp className="mx-auto text-muted-foreground/50" size={28} /><p className="mt-3 font-serif text-xl">No market dates reported yet</p><p className="mt-1 text-sm text-muted-foreground">Save actual purchases on the Buy List, then press Report to add that market date here.</p></div> : <div className="space-y-5" data-testid="page-flower-price-tracker">
      <div className="flex gap-2 overflow-x-auto border-b border-foreground/10 pb-px" role="tablist" aria-label="Reported market dates">
        {reports.map((report) => <button
          key={report.marketCycle}
          type="button"
          role="tab"
          aria-selected={report.marketCycle === selectedReport.marketCycle}
          data-testid={`tab-flower-price-tracker-${report.marketCycle}`}
          onClick={() => setSelectedCycle(report.marketCycle)}
          className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${report.marketCycle === selectedReport.marketCycle ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          {report.date}
        </button>)}
      </div>
      <section className="overflow-hidden rounded-lg border border-card-border bg-card" data-testid={`report-flower-price-tracker-${selectedReport.marketCycle}`}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/10 bg-[#e8e4cd] px-5 py-5">
          <div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">Reported market</p><h2 className="mt-1 font-serif text-2xl text-primary">{selectedReport.date}</h2><p className="mt-1 text-xs text-primary/65">{selectedReport.venue} · {selectedReport.lineItems.length} purchase line{selectedReport.lineItems.length === 1 ? '' : 's'}</p></div>
          <span className="rounded-full bg-background/55 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-primary">Finalized report</span>
        </div>
        <div className="hidden grid-cols-[1.45fr_1fr_.75fr_.8fr_1fr_.9fr_1fr] gap-3 border-b border-foreground/10 bg-muted/55 px-5 py-3 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground lg:grid"><span>Flower</span><span>Supplier</span><span>Bunch size</span><span>Bunches</span><span>Price / bunch</span><span>Stem qty</span><span>Cost / stem</span></div>
        <div>{selectedReport.lineItems.map((item) => <div key={item.id} data-testid={`tracker-line-item-${item.id}`} className="grid gap-3 border-b border-foreground/10 px-5 py-4 last:border-0 lg:grid-cols-[1.45fr_1fr_.75fr_.8fr_1fr_.9fr_1fr] lg:items-center">
          <div><span className="block text-sm font-semibold">{item.flower}</span><span className="mt-1 block text-[11px] text-muted-foreground lg:hidden">Bunch {item.bunchSize} · {item.bunchesPurchased} bunch{item.bunchesPurchased === 1 ? '' : 'es'}</span></div>
          <span className="text-xs text-muted-foreground"><span className="mr-1 font-mono text-[9px] uppercase lg:hidden">Supplier</span>{item.supplier ?? '—'}</span>
          <span className="text-xs lg:text-sm"><span className="mr-1 font-mono text-[9px] uppercase text-muted-foreground lg:hidden">Bunch size</span>{item.bunchSize} stems</span>
          <span className="text-xs lg:text-sm"><span className="mr-1 font-mono text-[9px] uppercase text-muted-foreground lg:hidden">Bunches</span>{item.bunchesPurchased}</span>
          <span className="font-mono text-sm"><span className="mr-1 font-sans text-[9px] uppercase text-muted-foreground lg:hidden">Price</span>{unitMoney(item.pricePerBunch)}</span>
          <span className="font-mono text-sm"><span className="mr-1 font-sans text-[9px] uppercase text-muted-foreground lg:hidden">Stems</span>{item.totalStemQty}</span>
          <span className="font-mono text-sm text-primary"><span className="mr-1 font-sans text-[9px] uppercase text-muted-foreground lg:hidden">Per stem</span>{unitMoney(item.costPerStem)}</span>
        </div>)}</div>
      </section>
    </div>}
  </div>;
}

function FlowersPage({ flowerPrices, flowerPricesLoading }: { flowerPrices: FlowerPriceHistory[]; flowerPricesLoading: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [enrichment, setEnrichment] = useState('All status');
  const [selected, setSelected] = useState<Flower | null>(null);
  const visible = useMemo(() => flowers.filter((flower) => (flower.common.toLowerCase().includes(query.toLowerCase()) || flower.botanical.toLowerCase().includes(query.toLowerCase())) && (category === 'All categories' || flower.category === category) && (enrichment === 'All status' || flower.enrichment === enrichment)), [query, category, enrichment]);
  return <div>
    <PageIntro eyebrow="The studio / flower library" title="Know your stems." description="Your working catalogue for pricing, planning and making the Sunday table feel abundant." action={<Button onClick={() => window.alert('New flowers can be added once local data is connected.')} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-add-flower"><Plus size={15} /> Add flower</Button>} />
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-foreground/10 bg-card/70 p-3 md:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by common or botanical name" data-testid="input-search-flowers" className="h-10 w-full rounded-md border border-foreground/10 bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary" /></label><div className="flex gap-2"><select value={category} onChange={(event) => setCategory(event.target.value)} data-testid="select-flower-category" className="h-10 rounded-md border border-foreground/10 bg-background px-3 text-xs font-semibold outline-none"><option>All categories</option>{flowerCategories.map((item) => <option key={item}>{item}</option>)}</select><select value={enrichment} onChange={(event) => setEnrichment(event.target.value)} data-testid="select-enrichment-status" className="h-10 rounded-md border border-foreground/10 bg-background px-3 text-xs font-semibold outline-none"><option>All status</option><option>Ready</option><option>Needs notes</option><option>Missing</option></select></div></div>
    <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground"><span data-testid="text-flower-count">{visible.length} of {flowers.length} stems shown</span><span className="hidden items-center gap-1.5 sm:flex"><ListFilter size={13} /> Categories keep the library clear</span></div>
    <div className="overflow-hidden rounded-lg border border-card-border bg-card"><div className="hidden grid-cols-[1.6fr_1.2fr_.7fr_.6fr_.6fr_.65fr] border-b border-foreground/10 bg-muted/55 px-5 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground md:grid"><span>Flower</span><span>Role / season</span><span>Category</span><span>Retail</span><span>Wholesale</span><span>Margin</span></div>{visible.map((flower) => <button type="button" onClick={() => setSelected(flower)} key={flower.id} data-testid={`row-flower-${flower.id}`} className="grid w-full grid-cols-[1fr_auto] gap-3 border-b border-foreground/10 px-4 py-4 text-left transition-colors last:border-0 hover:bg-muted/50 md:grid-cols-[1.6fr_1.2fr_.7fr_.6fr_.6fr_.65fr] md:items-center md:px-5"><div className="flex items-center gap-3"><span className="h-9 w-9 shrink-0 rounded-full border border-foreground/10" style={{ background: `radial-gradient(circle at 40% 30%, ${flower.colour}, #eee5dc)` }} /><span><span className="block text-sm font-semibold">{flower.common}</span><span className="mt-0.5 block font-serif text-xs italic text-muted-foreground">{flower.botanical}</span></span></div><div className="hidden md:block"><div className="text-xs">{flower.role}</div><div className="mt-1 text-[11px] text-muted-foreground">{flower.seasonality}</div></div><div className="hidden md:block"><span className={`inline-flex rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${flower.category === 'Statement Blooms' ? 'bg-[#f0d3c9]' : flower.category === 'Classic Blooms' ? 'bg-[#e4d7e9]' : flower.category === 'Premium Natives' ? 'bg-[#f4dfbd]' : flower.category === 'Gum' ? 'bg-[#dce3c2]' : 'bg-[#dbe1d3]'}`}>{flower.category}</span></div><span className="hidden font-mono text-xs md:block">{money(flower.retail)}</span><span className="hidden font-mono text-xs text-muted-foreground md:block">{money(flower.wholesale)}</span><div className="flex flex-col items-end gap-1 md:items-start"><span className="font-mono text-sm text-primary">{flower.margin}%</span><span className={`text-[10px] ${flower.enrichment === 'Ready' ? 'text-[#6b8b58]' : flower.enrichment === 'Missing' ? 'text-[#aa6e62]' : 'text-[#9a7d44]'}`}>{flower.enrichment}</span></div></button>)}{visible.length === 0 && <div className="px-6 py-14 text-center"><Flower2 className="mx-auto text-muted-foreground/50" size={28} /><p className="mt-3 font-serif text-lg">No stems found</p><p className="mt-1 text-sm text-muted-foreground">Try a different name or clear a filter.</p><Button onClick={() => { setQuery(''); setCategory('All categories'); setEnrichment('All status'); }} className="mt-4 border border-foreground/15 bg-background" testId="button-clear-flower-filters">Clear filters</Button></div>}</div>
    {selected && <div className="fixed inset-0 z-40 flex items-end justify-center bg-primary/20 p-3 backdrop-blur-sm md:items-center" onClick={() => setSelected(null)}><div className="w-full max-w-md rounded-xl border border-card-border bg-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><span className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Stem notes</span><h2 className="mt-1 font-serif text-3xl">{selected.common}</h2><p className="font-serif text-sm italic text-muted-foreground">{selected.botanical}</p></div><Button onClick={() => setSelected(null)} className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-muted" testId="button-close-flower-detail"><X size={16} /></Button></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-md bg-muted p-3"><span className="font-mono text-[9px] uppercase text-muted-foreground">Retail</span><div className="mt-1 font-serif text-xl">{money(selected.retail)}</div></div><div className="rounded-md bg-muted p-3"><span className="font-mono text-[9px] uppercase text-muted-foreground">Margin</span><div className="mt-1 font-serif text-xl">{selected.margin}%</div></div></div><div className="mt-4 space-y-3 border-t border-foreground/10 pt-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-semibold">{selected.category}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-semibold">{selected.role}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Seasonality</span><span className="font-semibold">{selected.seasonality}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Enrichment</span><span className="font-semibold">{selected.enrichment}</span></div></div></div></div>}
  </div>;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function MarketSchedulePanel({
  overrides,
  onSave,
  onClear,
}: {
  overrides: MarketScheduleOverride[];
  onSave: (cycle: number, data: MarketScheduleOverrideUpdate) => Promise<boolean>;
  onClear: (cycle: number) => Promise<boolean>;
}) {
  const [rescheduleDates, setRescheduleDates] = useState<Record<number, string>>({});
  const cycles = marketSchedule.upcomingCalculatedCycles(new Date(), 5);

  return <section className="mb-7 rounded-lg border border-primary/15 bg-[#e8e4cd] p-5 md:p-6" data-testid="panel-market-schedule">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><CalendarDays size={13} /> Schedule controls</div>
        <h2 className="mt-1 font-serif text-2xl text-primary">Every 2nd Sunday</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-primary/65">Skip a calculated market or move it to a different date. Buy lists, price history and market summaries follow the saved override.</p>
      </div>
    </div>
    <div className="mt-5 divide-y divide-primary/10 rounded-md border border-primary/10 bg-card">
      {cycles.map((cycle) => {
        const calculatedDate = getMarketDate(cycle);
        const override = getMarketScheduleOverride(cycle, overrides);
        const effectiveDate = getEffectiveMarketDate(cycle, overrides);
        const inputValue = rescheduleDates[cycle] ?? formatDateInput(effectiveDate ?? calculatedDate);
        const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(inputValue);
        return <div key={cycle} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span>{formatMarketDate(calculatedDate, 'full')}</span>
              {override?.status === 'skipped' && <span className="rounded-full bg-destructive/10 px-2 py-1 font-mono text-[9px] uppercase text-destructive">Skipped</span>}
              {override?.status === 'rescheduled' && <span className="rounded-full bg-[#dce3c2] px-2 py-1 font-mono text-[9px] uppercase text-primary">Rescheduled</span>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cycle {cycle}
              {override?.status === 'rescheduled' && override.rescheduledDate ? ` · now ${formatMarketDate(new Date(`${override.rescheduledDate}T00:00:00Z`), 'full')}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {override?.status === 'skipped' ? <Button onClick={() => onClear(cycle)} className="border border-foreground/15 bg-background text-xs" testId={`button-clear-schedule-${cycle}`}>Restore date</Button> : <>
              <Button onClick={() => onSave(cycle, { status: 'skipped', rescheduledDate: null })} className="border border-destructive/20 bg-background text-xs text-destructive hover:bg-destructive/5" testId={`button-skip-market-${cycle}`}>Skip</Button>
              <input type="date" value={inputValue} onChange={(event) => setRescheduleDates((current) => ({ ...current, [cycle]: event.target.value }))} aria-label={`Reschedule cycle ${cycle}`} data-testid={`input-reschedule-market-${cycle}`} className="h-9 rounded-md border border-foreground/15 bg-background px-2 text-xs" />
              <Button onClick={() => onSave(cycle, { status: 'rescheduled', rescheduledDate: inputValue })} disabled={!hasValidDate} className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" testId={`button-reschedule-market-${cycle}`}>Reschedule</Button>
            </>}
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function MarketsPage({ markets, nextMarket, scheduleOverrides, saveScheduleOverride, clearScheduleOverride }: { markets: Market[]; nextMarket: MarketCycleSummary; scheduleOverrides: MarketScheduleOverride[]; saveScheduleOverride: (cycle: number, data: MarketScheduleOverrideUpdate) => Promise<boolean>; clearScheduleOverride: (cycle: number) => Promise<boolean> }) {
  const [activeTab, setActiveTab] = useState('All markets');
  const listedMarkets = markets.map((market) => {
    const date = getEffectiveMarketDate(market.cycle, scheduleOverrides) ?? getMarketDate(market.cycle);
    return { ...market, status: getMarketStatus(market.cycle, nextMarket.cycle, scheduleOverrides), day: formatMarketDay(date), displayDate: formatMarketDate(date, 'table') };
  });
  const filtered = listedMarkets.filter((market) => activeTab === 'All markets' || (activeTab === 'Upcoming' ? market.status === 'Next up' || market.status === 'Upcoming' : market.status === 'Closed'));
  const totalRevenue = markets.reduce((sum, market) => sum + market.revenue, 0);
  const averageSpend = markets.length ? markets.reduce((sum, market) => sum + market.spend, 0) / markets.length : 0;
  const averageMargin = markets.length ? markets.reduce((sum, market) => sum + market.margin, 0) / markets.length : 0;
  return <div><PageIntro eyebrow="The studio / market history" title="Every 2nd Sunday, accounted for." description="A clear view of what the stall costs, what it earns, and what to carry forward." action={<Button onClick={() => window.alert('New markets are ready to add when your market calendar is connected.')} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-add-market"><Plus size={15} /> Add market</Button>} /><div className="mb-4 flex justify-end"><MarketCycleBanner summary={nextMarket} testId="markets-cycle" /></div><MarketSchedulePanel overrides={scheduleOverrides} onSave={saveScheduleOverride} onClear={clearScheduleOverride} /><div className="mb-6 flex items-center gap-1 border-b border-foreground/10"><button onClick={() => setActiveTab('All markets')} data-testid="tab-all-markets" className={`border-b-2 px-3 py-3 text-xs font-semibold ${activeTab === 'All markets' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>All markets <span className="ml-1 font-mono text-[10px] opacity-60">{listedMarkets.length}</span></button><button onClick={() => setActiveTab('Upcoming')} data-testid="tab-upcoming-markets" className={`border-b-2 px-3 py-3 text-xs font-semibold ${activeTab === 'Upcoming' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Upcoming <span className="ml-1 font-mono text-[10px] opacity-60">{listedMarkets.filter((market) => market.status === 'Next up' || market.status === 'Upcoming').length}</span></button><button onClick={() => setActiveTab('Closed')} data-testid="tab-closed-markets" className={`border-b-2 px-3 py-3 text-xs font-semibold ${activeTab === 'Closed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Closed <span className="ml-1 font-mono text-[10px] opacity-60">{listedMarkets.filter((market) => market.status === 'Closed').length}</span></button></div><div className="grid gap-3 md:grid-cols-3"><MetricCard label="Total revenue" value={money(totalRevenue)} detail={`Across ${markets.length} Redcliffe Sundays`} icon={DollarSign} accent="sage" /><MetricCard label="Average spend" value={money(averageSpend)} detail="Flowers + stall costs" icon={ShoppingBasket} accent="peach" /><MetricCard label="Average margin" value={`${averageMargin.toFixed(1)}%`} detail="A healthy bunch of trade" icon={BarChart3} accent="lilac" /></div><div className="mt-7 overflow-hidden rounded-lg border border-card-border bg-card"><div className="hidden grid-cols-[1.3fr_1.4fr_.8fr_.8fr_.8fr] border-b border-foreground/10 bg-muted/55 px-5 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground md:grid"><span>Market</span><span>Venue</span><span>Spend</span><span>Revenue</span><span>Margin</span></div>{filtered.map((market) => <div key={market.id} data-testid={`row-market-${market.id}`} className="grid gap-3 border-b border-foreground/10 px-4 py-5 last:border-0 md:grid-cols-[1.3fr_1.4fr_.8fr_.8fr_.8fr] md:items-center md:px-5"><div className="flex items-center justify-between md:block"><div className="flex items-center gap-2"><CalendarDays size={15} className="text-muted-foreground" /><span className="text-sm font-semibold">{market.displayDate}</span><span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase ${market.status === 'Next up' ? 'bg-[#dce3c2] text-primary' : market.status === 'Skipped' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{market.status}</span></div><span className="mt-1 block pl-5 text-xs text-muted-foreground md:pl-0">{market.day}</span></div><div className="hidden text-sm text-muted-foreground md:block">{market.venue}</div><div className="grid grid-cols-3 gap-3 border-t border-foreground/10 pt-3 md:contents"><div><span className="block font-mono text-[9px] uppercase text-muted-foreground md:hidden">Spend</span><span className="block font-mono text-sm">{money(market.spend)}</span><div data-testid={`market-cost-breakdown-${market.id}`} className="mt-2 space-y-1 text-[10px] text-muted-foreground"><div className="flex justify-between gap-2"><span>Flowers</span><span className="font-mono">{money(market.flowerSpend)}</span></div>{market.costs.map((cost) => <div key={cost.id} className="flex justify-between gap-2"><span className="truncate">{cost.description}</span><span className="shrink-0 font-mono">{money(cost.amount)}</span></div>)}</div></div><div><span className="block font-mono text-[9px] uppercase text-muted-foreground md:hidden">Revenue</span><span className="font-mono text-sm">{money(market.revenue)}</span></div><div><span className="block font-mono text-[9px] uppercase text-muted-foreground md:hidden">Margin</span><span className="font-mono text-sm text-[#64804e]">{market.margin}%</span></div></div></div>)}</div></div>;
}

function SellThroughComparisonPanel({ markets, scheduleOverrides }: { markets: Market[]; scheduleOverrides: MarketScheduleOverride[] }) {
  const completedMarkets = useMemo(
    () => markets.filter((market) => market.closed && getMarketScheduleOverride(market.cycle, scheduleOverrides)?.status !== 'skipped').sort((a, b) => b.cycle - a.cycle),
    [markets, scheduleOverrides],
  );
  const completedCycleKey = completedMarkets.map((market) => market.cycle).join(',');
  const [selectedCycles, setSelectedCycles] = useState<number[]>([]);

  useEffect(() => {
    setSelectedCycles((current) => {
      const available = new Set(completedMarkets.map((market) => market.cycle));
      const stillAvailable = current.filter((cycle) => available.has(cycle));
      return stillAvailable.length ? stillAvailable : completedMarkets.slice(0, 3).map((market) => market.cycle);
    });
  }, [completedCycleKey]);

  const comparisonQuery = useGetSellThroughComparison(
    { cycles: selectedCycles },
    { query: { enabled: selectedCycles.length > 0, queryKey: getGetSellThroughComparisonQueryKey({ cycles: selectedCycles }) } },
  );
  const toggleCycle = (cycle: number) => {
    setSelectedCycles((current) => current.includes(cycle) ? current.filter((value) => value !== cycle) : [...current, cycle]);
  };
  const comparison = comparisonQuery.data;
  const gridColumns = comparison ? `minmax(150px, 1.2fr) repeat(${comparison.cycles.length}, minmax(130px, 1fr))` : undefined;

  return <section data-testid="panel-sell-through-comparison" className="rounded-lg border border-card-border bg-card p-5 md:p-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><TrendingUp size={13} /> Across completed markets</div>
        <h2 className="mt-1 font-serif text-2xl">Compare what moved</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Select completed market cycles to see the same flowers side by side. Stem counts keep repeat overbuying easy to spot.</p>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">{selectedCycles.length} cycle{selectedCycles.length === 1 ? '' : 's'} selected</span>
    </div>
    {completedMarkets.length ? <div className="mt-5 flex flex-wrap gap-2" aria-label="Completed market cycles">
      {completedMarkets.map((market) => <label key={market.cycle} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${selectedCycles.includes(market.cycle) ? 'border-primary/30 bg-primary/10 text-primary' : 'border-foreground/10 bg-background text-muted-foreground hover:border-primary/20'}`}>
        <input type="checkbox" checked={selectedCycles.includes(market.cycle)} onChange={() => toggleCycle(market.cycle)} data-testid={`checkbox-compare-cycle-${market.cycle}`} className="accent-primary" />
        <span><span className="block font-semibold">{market.date}</span><span className="font-mono text-[10px] opacity-70">Cycle {market.cycle}</span></span>
      </label>)}
    </div> : <div className="mt-5 rounded-md border border-dashed border-foreground/15 bg-background/60 p-5 text-center text-sm text-muted-foreground">Close a market cycle to make it available for comparison.</div>}
    {comparisonQuery.isLoading && <p className="mt-5 rounded-md bg-primary/5 px-4 py-3 text-xs text-primary/70" role="status">Loading sell-through comparison…</p>}
    {comparisonQuery.isError && <p className="mt-5 rounded-md bg-destructive/10 px-4 py-3 text-xs text-destructive" role="alert">The selected market results could not be loaded. Try selecting the cycles again.</p>}
    {comparison && <div className="mt-5 overflow-x-auto rounded-md border border-primary/10">
      {comparison.flowers.length ? <div className="min-w-[560px]">
        <div className="grid border-b border-primary/10 bg-primary/[.035] px-4 py-3 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground" style={{ gridTemplateColumns: gridColumns }}>
          <span>Flower</span>
          {comparison.cycles.map((cycle) => <span key={cycle.cycle} className="text-right"><span className="block text-primary">{cycle.date}</span><span className="font-normal normal-case tracking-normal">{cycle.venue} · cycle {cycle.cycle}</span></span>)}
        </div>
        {comparison.flowers.map((flower) => <div key={flower.flower} className="grid items-center border-b border-foreground/10 px-4 py-4 last:border-0" style={{ gridTemplateColumns: gridColumns }}>
          <span className="text-sm font-semibold">{flower.flower}</span>
          {comparison.cycles.map((cycle) => {
            const result = flower.results.find((candidate) => candidate.marketCycle === cycle.cycle);
            return <span key={cycle.cycle} className="text-right" data-testid={`comparison-${flower.flower.toLowerCase().replaceAll(' ', '-')}-${cycle.cycle}`}>
              <span className="block font-mono text-lg font-semibold text-primary">{result?.sellThroughPercent ?? 0}%</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{result?.soldStems ?? 0} sold / {result?.purchasedStems ?? 0} bought</span>
              <span className="block text-[10px] text-muted-foreground/75">{result?.leftoverStems ?? 0} came home</span>
            </span>;
          })}
        </div>)}
      </div> : <div className="p-6 text-center text-sm text-muted-foreground">No flower movement has been recorded for the selected cycles.</div>}
    </div>}
  </section>;
}

function MarketSubnav({ active, nextMarket }: { active: 'buy' | 'bouquets' | 'close'; nextMarket: MarketCycleSummary }) {
  return <div className="mb-8 flex items-center justify-between gap-3 overflow-x-auto border-b border-foreground/10"><div className="flex gap-1">{[{ id: 'buy', label: 'Buy list', href: '/markets/next/buy', icon: ShoppingBasket }, { id: 'bouquets', label: 'Bouquets', href: '/markets/next/bouquets', icon: Sparkles }, { id: 'close', label: 'Close market', href: '/markets/next/close', icon: ClipboardCheck }].map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} data-testid={`tab-market-${id}`} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${active === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Icon size={14} />{label}</Link>)}</div><MarketCycleBanner summary={nextMarket} testId="planning-cycle" /></div>;
}

type ReceiptPayload = Pick<ActualPurchasesUpdate, 'receiptFileName' | 'receiptText' | 'receiptCandidates'>;

export function parseReceiptCandidates(text: string, buyItems: BuyItem[]): ReceiptCandidate[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const supplierLine = lines.find((line) => /^(?:supplier|grower|from)\s*[:\-]\s*/i.test(line));
  const supplier = supplierLine?.replace(/^(?:supplier|grower|from)\s*[:\-]\s*/i, '').trim() || null;
  return lines.flatMap((rawLine) => {
    const supplierMatch = rawLine.match(/^(?:supplier|grower|from)\s*[:\-]\s*(.+)$/i);
    if (supplierMatch) return [];
    const priceMatch = [...rawLine.matchAll(/(?:AUD\s*)?\$\s*(\d+(?:[.,]\d{1,2})?)/gi)].at(-1);
    if (!priceMatch) return [];
    const pricePerBunch = Number(priceMatch[1].replace(',', '.'));
    if (!Number.isFinite(pricePerBunch) || pricePerBunch < 0) return [];
    const beforePrice = rawLine.slice(0, priceMatch.index ?? rawLine.length);
    const quantityMatch = beforePrice.match(/(?:\b(\d+)\s*[x×]|\b[x×]\s*(\d+)|\b(\d+)\s*bunch(?:es)?\b|(\d+)\s*$)/i);
    const bunchesPurchased = Number(quantityMatch?.[1] ?? quantityMatch?.[2] ?? quantityMatch?.[3] ?? quantityMatch?.[4] ?? 1);
    const matchedItem = buyItems.find((item) => rawLine.toLowerCase().includes(item.flower.toLowerCase()));
    const flower = matchedItem?.flower ?? beforePrice
      .replace(/\b(?:\d+)\s*[x×]\b/gi, '')
      .replace(/\b[x×]\s*\d+\b/gi, '')
      .replace(/\b\d+\s*bunch(?:es)?\b/gi, '')
      .replace(/[@:]/g, ' ')
      .replace(/[^a-zA-ZÀ-ÿ\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!flower || /^(subtotal|total|gst|tax|cash|change|receipt)$/i.test(flower)) return [];
    const confidence: ReceiptCandidate['confidence'] = matchedItem ? 'high' : 'medium';
    return [{
      flower,
      stems: bunchesPurchased,
      unitCost: pricePerBunch,
      bunchSize: 1,
      bunchesPurchased,
      pricePerBunch,
      supplier,
      confidence,
      rawLine,
    }];
  }).slice(0, 30);
}

export function applyReceiptCandidates(
  drafts: BunchPurchaseInput[],
  candidates: ReceiptCandidate[],
  buyItems: BuyItem[],
  manualPriceEdits: Set<number>,
): { drafts: BunchPurchaseInput[]; applied: number; added: number; skipped: number } {
  const next = [...drafts];
  const usedRows = new Set<number>();
  let applied = 0;
  let added = 0;
  let skipped = 0;
  candidates.forEach((candidate) => {
    const candidatePrice = candidate.pricePerBunch ?? candidate.unitCost;
    const candidateBunches = candidate.bunchesPurchased ?? candidate.stems ?? 1;
    const matchingRow = next.findIndex((purchase, index) =>
      !usedRows.has(index)
      && !manualPriceEdits.has(index)
      && purchase.flower.trim().toLowerCase() === candidate.flower.trim().toLowerCase(),
    );
    if (matchingRow >= 0) {
      next[matchingRow] = { ...next[matchingRow], pricePerBunch: candidatePrice, source: 'receipt' };
      usedRows.add(matchingRow);
      applied += 1;
      return;
    }
    const hasProtectedRow = next.some((purchase) => purchase.flower.trim().toLowerCase() === candidate.flower.trim().toLowerCase());
    if (hasProtectedRow) {
      skipped += 1;
      return;
    }
    const matchedItem = buyItems.find((item) => item.flower.toLowerCase() === candidate.flower.toLowerCase());
    next.push({
      flower: candidate.flower,
      detail: matchedItem?.detail ?? 'Receipt line — please confirm',
      category: matchedItem?.category ?? ApiFlowerCategory.Classic_Blooms,
      bunchSize: candidate.bunchSize ?? 1,
      bunchesPurchased: candidateBunches,
      pricePerBunch: candidatePrice,
      supplier: candidate.supplier ?? null,
      source: 'receipt',
    });
    added += 1;
  });
  return { drafts: next, applied, added, skipped };
}

function purchaseDraftFromItem(item: BuyItem): BunchPurchaseInput {
  return {
    flower: item.flower,
    detail: item.detail,
    category: item.category,
    bunchSize: 10,
    bunchesPurchased: item.qty,
    pricePerBunch: item.lastPrice,
    supplier: null,
    source: 'manual',
  };
}

function purchaseDraftFromActual(purchase: ActualPurchase): BunchPurchaseInput {
  return {
    flower: purchase.flower,
    detail: purchase.detail,
    category: purchase.category,
    bunchSize: purchase.bunchSize,
    bunchesPurchased: purchase.bunchesPurchased,
    pricePerBunch: purchase.pricePerBunch,
    supplier: purchase.supplier,
    source: purchase.source,
  };
}

export function BuyPage({
  buyItems,
  actualPurchases,
  costs,
  buyList,
  nextMarket,
  toggleBuyItem,
  setBuyListLock,
  saveActualPurchases,
  saveCosts,
  reportPurchases,
}: {
  buyItems: BuyItem[];
  actualPurchases: ActualPurchase[];
  costs: MarketCost[];
  buyList: MarketContext['buyList'];
  nextMarket: MarketCycleSummary;
  toggleBuyItem: (id: number) => Promise<boolean>;
  setBuyListLock: (locked: boolean) => Promise<boolean>;
  saveActualPurchases: (purchases: BunchPurchaseInput[], receipt: ReceiptPayload) => Promise<boolean>;
  saveCosts: (costs: MarketCostInput[]) => Promise<boolean>;
  reportPurchases: () => Promise<boolean>;
}) {
  const [filter, setFilter] = useState('All categories');
  const [drafts, setDrafts] = useState<BunchPurchaseInput[]>([]);
  const [costDrafts, setCostDrafts] = useState<MarketCostInput[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveAction, setSaveAction] = useState<BuySaveAction | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload>(() => ({
    receiptFileName: buyList.receiptFileName,
    receiptText: buyList.receiptText,
    receiptCandidates: buyList.receiptCandidates,
  }));
  const [receiptStatus, setReceiptStatus] = useState<'idle' | 'reading' | 'ready' | 'unreadable'>('idle');
  const [manualPriceEdits, setManualPriceEdits] = useState<Set<number>>(() => new Set(
    actualPurchases.flatMap((purchase, index) => purchase.source === 'manual' ? [index] : []),
  ));
  const categories = ['All categories', ...flowerCategories];
  const items = buyItems.filter((item) => filter === 'All categories' || item.category === filter);
  const done = buyItems.filter((item) => item.checked).length;
  const proposedTotal = buyItems.reduce((sum, item) => sum + item.qty * item.lastPrice, 0);
  const actualTotal = drafts.reduce((sum, purchase) => sum + purchase.bunchesPurchased * purchase.pricePerBunch, 0);
  const nonFlowerTotal = costDrafts.reduce((sum, cost) => sum + cost.amount, 0);

  useEffect(() => {
    if (!buyList.locked) return;
    setDrafts(actualPurchases.length ? actualPurchases.map(purchaseDraftFromActual) : buyItems.map(purchaseDraftFromItem));
    setCostDrafts(costs.map(({ description, amount }) => ({ description, amount })));
    setReceipt({
      receiptFileName: buyList.receiptFileName,
      receiptText: buyList.receiptText,
      receiptCandidates: buyList.receiptCandidates,
    });
    setManualPriceEdits(new Set(actualPurchases.flatMap((purchase, index) => purchase.source === 'manual' ? [index] : [])));
  }, [buyList.marketCycle, buyList.locked, buyList.receiptFileName, buyList.receiptText, buyList.receiptCandidates, actualPurchases, buyItems, costs]);

  const updateDraft = (index: number, patch: Partial<BunchPurchaseInput>, marksManualPrice = false) => {
    setSaveState('idle');
    setDrafts((current) => current.map((purchase, purchaseIndex) => purchaseIndex === index ? { ...purchase, ...patch, ...(marksManualPrice ? { source: 'manual' as const } : {}) } : purchase));
    if (marksManualPrice) {
      setManualPriceEdits((current) => new Set(current).add(index));
    }
  };

  const addDraft = () => {
    setSaveState('idle');
    setDrafts((current) => [...current, { flower: '', detail: 'Added after purchase', category: ApiFlowerCategory.Classic_Blooms, bunchSize: 1, bunchesPurchased: 1, pricePerBunch: 0, supplier: null, source: 'manual' }]);
  };

  const removeDraft = (index: number) => {
    setSaveState('idle');
    setDrafts((current) => current.filter((_, purchaseIndex) => purchaseIndex !== index));
    setManualPriceEdits((current) => new Set([...current].filter((entry) => entry !== index).map((entry) => entry > index ? entry - 1 : entry)));
  };

  const analyzeReceipt = async (file: File) => {
    setReceiptStatus('reading');
    setFeedback(null);
    try {
      const worker = await createWorker('eng');
      const ocrResult = await worker.recognize(file);
      await worker.terminate();
      const candidates = parseReceiptCandidates(ocrResult.data.text, buyItems);
      setReceipt({ receiptFileName: file.name, receiptText: ocrResult.data.text, receiptCandidates: candidates });
      if (candidates.length === 0) {
        setReceiptStatus('unreadable');
        setFeedback('No readable flower prices were found. Your current entries are unchanged — continue with manual entry.');
        return;
      }

      let appliedResult: ReturnType<typeof applyReceiptCandidates> | undefined;
      setDrafts((current) => {
        appliedResult = applyReceiptCandidates(current, candidates, buyItems, manualPriceEdits);
        return appliedResult.drafts;
      });
      setReceiptStatus('ready');
      const appliedCount = (appliedResult?.applied ?? 0) + (appliedResult?.added ?? 0);
      setFeedback(`${appliedCount} receipt price${appliedCount === 1 ? '' : 's'} added. Review the highlighted values before saving${appliedResult?.skipped ? `; ${appliedResult.skipped} protected manual entr${appliedResult.skipped === 1 ? 'y was' : 'ies were'} left unchanged` : ''}.`);
    } catch {
      setReceiptStatus('unreadable');
      setFeedback('Receipt analysis could not finish. Your current entries are unchanged — continue with manual entry.');
    }
  };

  const addCost = () => {
    setSaveState('idle');
    setCostDrafts((current) => [...current, { description: '', amount: 0 }]);
  };

  const updateCost = (index: number, patch: Partial<MarketCostInput>) => {
    setSaveState('idle');
    setCostDrafts((current) => current.map((cost, costIndex) => costIndex === index ? { ...cost, ...patch } : cost));
  };

  const performSave = async (action: BuySaveAction) => {
    if ((action.kind === 'actual-purchases' || action.kind === 'report') && drafts.some((purchase) => !purchase.flower.trim() || purchase.bunchSize <= 0 || purchase.bunchesPurchased <= 0 || purchase.pricePerBunch < 0)) {
      setFeedback('Each purchase needs a flower name, positive bunch size/count, and a non-negative price per bunch.');
      setSaveState('idle');
      return;
    }
    if (action.kind === 'costs' && costDrafts.some((cost) => !cost.description.trim() || cost.amount < 0)) {
      setFeedback('Each market cost needs a description and a non-negative amount.');
      setSaveState('idle');
      return;
    }
    setSaveAction(action);
    setSaveState('saving');
    setIsSaving(true);
    let saved = false;
    let savedMessage = 'Saved to the market plan.';
    if (action.kind === 'toggle') {
      saved = await toggleBuyItem(action.id);
      savedMessage = 'Buy-list progress saved.';
    } else if (action.kind === 'lock') {
      saved = await setBuyListLock(true);
      savedMessage = 'Buy list locked for shopping.';
    } else if (action.kind === 'unlock') {
      saved = await setBuyListLock(false);
      savedMessage = 'Buy list unlocked for editing.';
    } else if (action.kind === 'actual-purchases') {
      saved = await saveActualPurchases(drafts, receipt);
      savedMessage = 'Actual purchases saved against this market date.';
    } else if (action.kind === 'costs') {
      saved = await saveCosts(costDrafts);
      savedMessage = 'Market costs saved against this market date.';
    } else {
      const purchasesSaved = await saveActualPurchases(drafts, receipt);
      saved = purchasesSaved && await reportPurchases();
      savedMessage = 'Buy List Report saved for this market date.';
    }
    trackMarketPlanSave('buy_list', saved ? 'success' : 'failure');
    setIsSaving(false);
    setSaveState(saved ? 'saved' : 'error');
    announceSave(saved, savedMessage, () => void performSave(action));
  };

  const handleRetry = () => {
    if (saveAction) void performSave(saveAction);
  };

  return <div>
    <PageIntro
      eyebrow="Next market / preparation"
      title={buyList.locked ? 'Record what really came home.' : 'Buy with a clear head.'}
      description={buyList.locked ? 'The proposed list is locked. Record each bunch you actually bought, including supplier details when useful.' : 'Build the proposed flower run, tick items off as they land in your trolley, then lock the list before shopping.'}
      action={<div className="flex items-center gap-2"><div className="rounded-md bg-[#dce3c2] px-3 py-2 text-center"><div className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">{nextMarket.shortDate}</div><div className="text-sm font-semibold text-primary">{nextMarket.daysUntil} to go</div></div>{buyList.locked && <Button onClick={() => { if (window.confirm('Unlock this proposed list so you can edit it? Your actual purchases will stay saved.')) void performSave({ kind: 'unlock' }); }} disabled={isSaving} className="border border-primary/20 bg-background text-primary hover:bg-primary/5" testId="button-unlock-buy-list"><UnlockKeyhole size={15} /> Unlock to Edit</Button>}</div>}
    />
    <MarketSubnav active="buy" nextMarket={nextMarket} />
    {!buyList.locked ? <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-md bg-muted p-1">{categories.map((category) => <button key={category} onClick={() => setFilter(category)} data-testid={`filter-buy-${category.toLowerCase().replaceAll(' ', '-')}`} className={`shrink-0 rounded px-2.5 py-1.5 text-[11px] font-semibold ${filter === category ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{category}</button>)}</div>
          <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">{done}/{buyItems.length} checked</span>
        </div>
         <div className="space-y-2">{items.map((item) => <button type="button" key={item.id} onClick={() => void performSave({ kind: 'toggle', id: item.id })} disabled={isSaving} data-testid={`button-check-buy-${item.id}`} className={`group flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all ${item.checked ? 'border-[#ccd6b0] bg-[#edf0df]/75' : 'border-card-border bg-card hover:border-primary/30'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${item.checked ? 'check-pop border-primary bg-primary text-primary-foreground' : 'border-foreground/20 group-hover:border-primary'}`}>{item.checked && <Check size={14} strokeWidth={3} />}</span><span className="min-w-0 flex-1"><span className={`block text-sm font-semibold ${item.checked ? 'text-muted-foreground line-through' : ''}`}>{item.flower}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span></span><span className="text-right"><span className="block font-mono text-sm">{item.qty}</span><span className="block text-[10px] text-muted-foreground">{item.unit}</span></span><span className="hidden w-32 text-right sm:block"><span className="block font-mono text-xs">{money(item.lastPrice)}</span><span data-testid={`text-buy-price-source-${item.id}`} className="block text-[10px] leading-tight text-muted-foreground">{item.priceSource.kind === 'reported' ? `Buy List Report · ${item.priceSource.date}` : 'Fallback estimate · no report history'}</span></span><MoreHorizontal size={16} className="text-muted-foreground/50" /></button>)}</div>
        <div className="mt-4 rounded-lg border border-primary/15 bg-[#e8e4cd] p-5">
          <div className="flex items-start gap-3"><LockKeyhole size={18} className="mt-0.5 text-primary" /><div><h3 className="font-serif text-xl text-primary">Ready to freeze this run?</h3><p className="mt-1 text-xs leading-relaxed text-primary/70">Locking keeps the proposed list stable while you shop. You can still record different quantities, prices, or extra flowers in the actual purchase record.</p></div></div>
           <Button onClick={() => void performSave({ kind: 'lock' })} disabled={isSaving} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" testId="button-lock-buy-list">{isSaving && saveAction?.kind === 'lock' ? <LoaderCircle size={15} className="animate-spin" /> : <LockKeyhole size={15} />} {isSaving && saveAction?.kind === 'lock' ? 'Saving…' : 'Lock List'}</Button>
          <div className="mt-3"><SaveFeedback state={saveState} onRetry={handleRetry} /></div>
        </div>
      </div>
      <aside className="h-fit space-y-3 lg:sticky lg:top-24"><div className="rounded-lg border border-primary/10 bg-[#e8e4cd] p-5"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><DollarSign size={13} /> Sourcing estimate</div><div className="mt-4 font-serif text-4xl tracking-[-.04em] text-primary" data-testid="text-buy-estimate">{money(proposedTotal)}</div><p className="mt-1 text-xs leading-relaxed text-primary/65">Based on your last recorded prices. Leave a little room for market morning surprises.</p><div className="mt-5 border-t border-primary/15 pt-4"><div className="flex justify-between text-xs"><span className="text-primary/65">Expected flower spend</span><span className="font-mono font-semibold text-primary">{money(proposedTotal)}</span></div><div className="mt-2 flex justify-between text-xs"><span className="text-primary/65">Target revenue</span><span className="font-mono font-semibold text-primary">$1,846</span></div></div></div></aside>
    </div> : <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <div className="space-y-5">
        <section className="rounded-lg border border-card-border bg-card p-5">
           <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Actual purchases</p><h2 className="mt-1 font-serif text-2xl">What did you buy?</h2><p className="mt-1 text-xs text-muted-foreground">Replace the proposed lines with what actually came home. Add new flowers, remove planned flowers, or keep multiple supplier lines for one flower.</p></div><span className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase ${buyList.reported ? 'bg-[#dce3c2] text-primary' : 'bg-muted text-muted-foreground'}`}>{buyList.reported ? 'Reported' : 'Not reported'}</span></div>
            <div className="mt-5 space-y-2">{drafts.length === 0 ? <div className="rounded-md border border-dashed border-foreground/15 bg-background px-4 py-6 text-center text-xs text-muted-foreground">No purchase lines yet. Add every flower you bought, including flowers that were not on the proposed list.</div> : drafts.map((purchase, index) => <div key={`${purchase.flower}-${index}`} className="grid gap-2 rounded-md border border-foreground/10 bg-background p-3 sm:grid-cols-[1.25fr_.7fr_.7fr_.8fr_1fr_auto] sm:items-end"><label className="text-[10px] font-mono uppercase text-muted-foreground">Flower<input value={purchase.flower} onChange={(event) => updateDraft(index, { flower: event.target.value })} placeholder="Flower type" className="mt-1 w-full rounded border border-foreground/15 bg-card px-2 py-2 text-sm font-sans normal-case text-foreground outline-none focus:border-primary" /></label><label className="text-[10px] font-mono uppercase text-muted-foreground">Bunch size<input type="number" min="1" step="1" value={purchase.bunchSize} onChange={(event) => updateDraft(index, { bunchSize: Number(event.target.value) })} className="mt-1 w-full rounded border border-foreground/15 bg-card px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-primary" /></label><label className="text-[10px] font-mono uppercase text-muted-foreground">Bunches<input type="number" min="1" step="1" value={purchase.bunchesPurchased} onChange={(event) => updateDraft(index, { bunchesPurchased: Number(event.target.value) })} className="mt-1 w-full rounded border border-foreground/15 bg-card px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-primary" /></label><label className="text-[10px] font-mono uppercase text-muted-foreground">Price / bunch{purchase.source === 'receipt' && <span className="ml-1 rounded bg-[#e8e4cd] px-1 py-0.5 text-[8px] normal-case text-primary">Receipt suggestion · editable</span>}<input type="number" min="0" step="0.01" value={purchase.pricePerBunch} onChange={(event) => updateDraft(index, { pricePerBunch: Number(event.target.value) }, true)} className="mt-1 w-full rounded border border-foreground/15 bg-card px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-primary" /></label><label className="text-[10px] font-mono uppercase text-muted-foreground">Supplier<input value={purchase.supplier ?? ''} onChange={(event) => updateDraft(index, { supplier: event.target.value || null })} placeholder="Optional" className="mt-1 w-full rounded border border-foreground/15 bg-card px-2 py-2 text-sm font-sans normal-case text-foreground outline-none focus:border-primary" /></label><Button onClick={() => removeDraft(index)} className="h-9 border border-foreground/15 bg-transparent px-2 text-muted-foreground hover:border-destructive hover:text-destructive" testId={`button-remove-purchase-${index}`}><Trash2 size={15} /></Button><div className="text-[10px] text-muted-foreground sm:col-span-6">{purchase.detail} · {purchase.category} · {purchase.bunchSize * purchase.bunchesPurchased} stems</div></div>)}</div>
          <div className="mt-4 flex flex-wrap gap-2"><Button onClick={addDraft} className="border border-dashed border-foreground/20 bg-transparent text-muted-foreground hover:border-primary hover:text-primary" testId="button-add-actual-purchase"><Plus size={15} /> Add purchase</Button><Button onClick={() => void performSave({ kind: 'actual-purchases' })} disabled={isSaving} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-save-actual-purchases">{isSaving && saveAction?.kind === 'actual-purchases' ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {isSaving && saveAction?.kind === 'actual-purchases' ? 'Saving…' : 'Save actual purchases'}</Button></div>
        </section>
         <section className="rounded-lg border border-primary/15 bg-[#e8e4cd] p-5" data-testid="section-receipt-analysis">
           <div className="flex items-start gap-3"><ReceiptText size={18} className="mt-0.5 text-primary" /><div><h3 className="font-serif text-xl text-primary">Read a receipt</h3><p className="mt-1 text-xs leading-relaxed text-primary/70">Upload a clear receipt photo to suggest bunch prices. Nothing is saved until you review and save the purchase lines.</p></div></div>
           <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/25 bg-background/40 px-4 py-4 text-sm text-primary/75 hover:border-primary hover:text-primary"><Upload size={16} />{receiptStatus === 'reading' ? 'Reading receipt…' : receipt.receiptFileName ?? 'Choose a receipt photo'}<input type="file" accept="image/*" className="sr-only" disabled={receiptStatus === 'reading'} onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeReceipt(file); }} /></label>
           <p className="mt-3 text-[11px] leading-relaxed text-primary/65">{receiptStatus === 'reading' ? 'OCR is running in your browser. This may take a moment.' : receiptStatus === 'unreadable' ? 'The receipt could not be read. Your existing entries are unchanged; manual entry is still available above.' : receiptStatus === 'ready' ? 'Receipt suggestions are marked in the price fields and remain fully editable.' : 'Best results come from a flat, well-lit image with the flower name and price visible.'}</p>
           {receipt.receiptCandidates && receipt.receiptCandidates.length > 0 && <div className="mt-4 rounded-md border border-primary/10 bg-background/45 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-[9px] uppercase tracking-[.14em] text-primary/70">Detected lines</span><span className="font-mono text-[10px] text-primary/60">{receipt.receiptCandidates.length}</span></div><ul className="mt-2 space-y-1 text-xs text-primary/75">{receipt.receiptCandidates.slice(0, 5).map((candidate, index) => <li key={`${candidate.rawLine}-${index}`} className="flex justify-between gap-3"><span className="truncate">{candidate.flower}</span><span className="shrink-0 font-mono">{unitMoney(candidate.pricePerBunch ?? candidate.unitCost)} / bunch</span></li>)}</ul></div>}
         </section>
        <section className="rounded-lg border border-card-border bg-card p-5" data-testid="section-market-costs">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Market costs</p><h2 className="mt-1 font-serif text-2xl">The rest of the market day.</h2><p className="mt-1 text-xs text-muted-foreground">Track stall fees, packaging, transport, and anything else beyond the flowers.</p></div><Button onClick={addCost} disabled={isSaving} className="border border-foreground/15 bg-background hover:border-primary" testId="button-add-market-cost"><Plus size={15} /> Add cost</Button></div>
          <div className="mt-5 space-y-2">{costDrafts.length === 0 ? <p className="rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground">No non-flower costs added yet.</p> : costDrafts.map((cost, index) => <div key={index} className="grid gap-2 rounded-md border border-foreground/10 bg-background p-3 sm:grid-cols-[1fr_.45fr_auto] sm:items-end"><label className="text-[10px] font-mono uppercase text-muted-foreground">Description<input value={cost.description} onChange={(event) => updateCost(index, { description: event.target.value })} placeholder="Stall fee" className="mt-1 w-full rounded border border-foreground/15 bg-card px-2 py-2 text-sm font-sans normal-case text-foreground outline-none focus:border-primary" /></label><label className="text-[10px] font-mono uppercase text-muted-foreground">Amount<input type="number" min="0" step="0.01" value={cost.amount} onChange={(event) => updateCost(index, { amount: Number(event.target.value) })} className="mt-1 w-full rounded border border-foreground/15 bg-card px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-primary" /></label><Button onClick={() => { setSaveState('idle'); setCostDrafts((current) => current.filter((_, costIndex) => costIndex !== index)); }} disabled={isSaving} className="h-9 border border-foreground/15 bg-background px-2 text-muted-foreground hover:border-destructive hover:text-destructive" testId={`button-remove-market-cost-${index}`}><Trash2 size={15} /></Button></div>)}</div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4"><span className="text-xs text-muted-foreground">Non-flower total <strong className="font-mono text-foreground">{money(nonFlowerTotal)}</strong></span><Button onClick={() => void performSave({ kind: 'costs' })} disabled={isSaving} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-save-market-costs">{isSaving && saveAction?.kind === 'costs' ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {isSaving && saveAction?.kind === 'costs' ? 'Saving…' : 'Save market costs'}</Button></div>
        </section>
        {feedback && <p className="rounded-md bg-[#edf0df] px-4 py-3 text-xs text-primary" role="status">{feedback}</p>}
        <SaveFeedback state={saveState} onRetry={handleRetry} />
      </div>
      <aside className="h-fit space-y-3 lg:sticky lg:top-24"><div className="rounded-lg border border-primary/10 bg-[#e8e4cd] p-5"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><DollarSign size={13} /> Actual flower spend</div><div className="mt-4 font-serif text-4xl tracking-[-.04em] text-primary" data-testid="text-actual-spend">{money(actualTotal)}</div><p className="mt-1 text-xs leading-relaxed text-primary/65">Saved against Sunday {nextMarket.shortDate}. This replaces the proposal when the report is created.</p><div className="mt-5 border-t border-primary/15 pt-4"><div className="flex justify-between text-xs"><span className="text-primary/65">Purchase lines</span><span className="font-mono font-semibold text-primary">{drafts.length}</span></div><div className="mt-2 flex justify-between text-xs"><span className="text-primary/65">Total stems</span><span className="font-mono font-semibold text-primary">{drafts.reduce((sum, purchase) => sum + purchase.bunchSize * purchase.bunchesPurchased, 0)}</span></div></div></div><div className="paper-card rounded-lg border border-card-border p-5"><div className="flex items-center gap-2 font-serif text-lg"><UnlockKeyhole size={17} className="text-muted-foreground" /> List locked</div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">The proposed list is frozen for this market cycle. Actual purchases can differ without changing the original plan.</p><Button onClick={() => void performSave({ kind: 'report' })} disabled={isSaving || drafts.length === 0 || buyList.reported} className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90" testId="button-report-buy-list">{isSaving && saveAction?.kind === 'report' ? <LoaderCircle size={15} className="animate-spin" /> : buyList.reported ? <CheckCircle2 size={15} /> : <ClipboardList size={15} />} {isSaving && saveAction?.kind === 'report' ? 'Saving…' : buyList.reported ? 'Buy List Report saved' : 'Create Buy List Report'}</Button></div>{buyList.editLog.length > 0 && <section className="paper-card rounded-lg border border-card-border p-5" data-testid="section-buy-list-edit-log"><div className="flex items-center gap-2 font-serif text-lg"><Clock3 size={17} className="text-muted-foreground" /> Edit history</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Changes made after this list was first locked.</p><ul className="mt-4 space-y-3">{buyList.editLog.slice().reverse().map((entry) => <li key={entry.id} className="border-l-2 border-primary/20 pl-3 text-xs"><span className="block text-muted-foreground">{new Date(entry.createdAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span><span className="mt-1 block font-medium">{entry.summary}</span></li>)}</ul></section>}</aside>
    </div>}
  </div>;
}

export function BouquetsPage({ bouquetPlan, nextMarket, saveBouquetPlan }: { bouquetPlan: BouquetPlan; nextMarket: MarketCycleSummary; saveBouquetPlan: (selectedBand: string, count: number) => Promise<boolean> }) {
  const [selectedBand, setSelectedBand] = useState(bouquetPlan.selectedBand);
  const [count, setCount] = useState(bouquetPlan.count);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  useEffect(() => {
    setSelectedBand(bouquetPlan.selectedBand);
    setCount(bouquetPlan.count);
  }, [bouquetPlan.marketCycle, bouquetPlan.selectedBand, bouquetPlan.count]);
  const band = priceBands.find((item) => item.name === selectedBand) ?? priceBands[1];
  const performSave = async () => {
    setSaveState('saving');
    const saved = await saveBouquetPlan(band.name, count);
    trackMarketPlanSave('bouquet', saved ? 'success' : 'failure');
    setSaveState(saved ? 'saved' : 'error');
    announceSave(saved, 'Sunday bouquet plan saved.', () => void performSave());
  };
  return <div><PageIntro eyebrow="Next market / making plan" title="A table full of colour." description="Decide the shape of Sunday before the first customer arrives. Your build-your-own bar, made legible." action={<div className="flex items-center gap-3"><div className="rounded-md bg-[#dce3c2] px-3 py-2 text-center"><div className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">{nextMarket.shortDate}</div><div className="text-sm font-semibold text-primary">Next market</div></div><Button onClick={() => { setCount(count + 1); setSaveState('idle'); }} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-add-bouquet"><Plus size={15} /> Add bouquet</Button></div>} /><MarketSubnav active="bouquets" nextMarket={nextMarket} /><div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><div><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Price architecture</p><h2 className="mt-1 font-serif text-2xl">Three sizes, one good day.</h2></div><span className="font-mono text-xs text-muted-foreground">{count} planned</span></div><div className="space-y-3">{priceBands.map((item, index) => <button key={item.name} type="button" onClick={() => { setSelectedBand(item.name); setSaveState('idle'); }} data-testid={`button-price-band-${item.name.toLowerCase()}`} className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all ${selectedBand === item.name ? 'border-primary bg-[#e8e4cd] shadow-sm' : 'border-card-border bg-card hover:border-primary/30'}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif text-lg ${index === 0 ? 'bg-[#e4d7e9]' : index === 1 ? 'bg-[#dce3c2]' : 'bg-[#f1d0c3]'}`}>{index + 1}</span><span className="flex-1"><span className="block font-serif text-xl">{item.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.note} · {item.stems}</span></span><span className="font-mono text-lg">{money(item.price)}</span>{selectedBand === item.name && <CheckCircle2 size={18} className="text-primary" />}</button>)}</div><div className="mt-7 rounded-lg border border-card-border bg-card p-5"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Stem recipe</p><h3 className="mt-1 font-serif text-xl">{band.name} bouquet</h3></div><Pencil size={15} className="text-muted-foreground" /></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ name: 'Focal', qty: 2, colour: '#e3a38e' }, { name: 'Feature', qty: 5, colour: '#b6a1c8' }, { name: 'Filler', qty: 4, colour: '#e6c26c' }, { name: 'Foliage', qty: 3, colour: '#9aa58b' }].map((item) => <div key={item.name} className="rounded-md bg-muted p-3"><span className="block h-3 w-3 rounded-full" style={{ background: item.colour }} /><span className="mt-3 block text-xs font-semibold">{item.name}</span><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{item.qty} stems</span></div>)}</div></div></div><div className="relative overflow-hidden rounded-xl border border-foreground/10 bg-[#e8e4cd] p-6 md:p-8"><img src={posterImage} alt="Umbrella bouquet poster inspiration" className="absolute -right-16 -top-20 w-[210px] rotate-12 opacity-[.15] mix-blend-multiply" /><div className="relative"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><Tag size={13} /> Sunday target</div><div className="mt-8 flex items-end gap-3"><span className="font-serif text-7xl leading-none text-primary">{count}</span><span className="mb-2 font-serif text-xl text-primary/70">bouquets</span></div><p className="mt-4 max-w-xs text-sm leading-relaxed text-primary/70">A gentle target for the umbrella bouquet table. You can always make more when the morning gets busy.</p><div className="mt-8 border-t border-primary/15 pt-5"><div className="flex justify-between text-xs text-primary/70"><span>Target bouquet revenue</span><span className="font-mono font-semibold text-primary">{money(count * band.price)}</span></div><div className="mt-3 flex justify-between text-xs text-primary/70"><span>Selected size</span><span className="font-semibold text-primary">{band.name} · {money(band.price)}</span></div></div><Button onClick={() => void performSave()} disabled={saveState === 'saving'} className="mt-8 w-full bg-primary text-primary-foreground hover:bg-primary/90" testId="button-save-bouquet-plan">{saveState === 'saving' ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {saveState === 'saving' ? 'Saving…' : 'Save Sunday plan'}</Button><div className="mt-3"><SaveFeedback state={saveState} onRetry={() => void performSave()} savedMessage="Sunday bouquet plan saved." /></div></div></div></div></div>;
}

export function ClosePage({ closeMarket, actualPurchases, nextMarket, saveCloseMarket }: { closeMarket: CloseMarket; actualPurchases: ActualPurchase[]; nextMarket: MarketCycleSummary; saveCloseMarket: (counts: Record<string, number>, closed: boolean, reopen?: boolean) => Promise<boolean> }) {
  const [counts, setCounts] = useState<Record<string, number>>(closeMarket.counts);
  const [closed, setClosed] = useState(closeMarket.closed);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  useEffect(() => {
    setCounts(closeMarket.counts);
    setClosed(closeMarket.closed);
  }, [closeMarket.marketCycle, closeMarket.counts, closeMarket.closed]);
  const purchasedByFlower = new Map(actualPurchases.map((purchase) => [purchase.flower, purchase]));
  const stock = [...new Set([...actualPurchases.map((purchase) => purchase.flower), ...Object.keys(counts)])].map((name) => {
    const purchase = purchasedByFlower.get(name);
    return { name, note: purchase?.detail ?? 'Recorded leftover without a purchase', opening: purchase?.stems ?? 0 };
  });
  const sellThrough = closeMarket.sellThrough;
  const totalLeft = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const performSave = async (action: 'close' | 'reopen' = closed ? 'reopen' : 'close') => {
    const nextClosed = action === 'close';
    setSaveState('saving');
    const saved = await saveCloseMarket(counts, nextClosed, action === 'reopen');
    trackMarketPlanSave('close_market', saved ? 'success' : 'failure');
    if (saved) setClosed(nextClosed);
    setSaveState(saved ? 'saved' : 'error');
    announceSave(saved, nextClosed ? 'Pack-down count saved and market closed.' : 'Pack-down count saved and market reopened.', () => void performSave());
  };
  const requestReopen = () => {
    if (window.confirm('Reopen this finalized close-out so its leftover counts can be edited?')) {
      void performSave('reopen');
    }
  };
  return <div><PageIntro eyebrow="Next market / pack-down" title="Leave the shed lighter." description="A quick count of what came home, what found a vase, and what to carry into the next Sunday." action={<div className={`rounded-md px-3 py-2 text-center ${closed ? 'bg-[#dce3c2]' : 'bg-muted'}`}><div className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">Market status</div><div className="flex items-center justify-center gap-1 text-sm font-semibold">{closed && <LockKeyhole size={13} />}{closed ? 'Finalized · Locked' : 'Open for edits'}</div></div>} /><MarketSubnav active="close" nextMarket={nextMarket} /><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div>{closed && <div className="mb-5 flex items-start gap-3 rounded-lg border border-primary/20 bg-[#e8e4cd] p-4 text-primary" role="status" data-testid="close-lock-status"><LockKeyhole size={18} className="mt-0.5 shrink-0" /><div><p className="text-sm font-semibold">Finalized and locked</p><p className="mt-1 text-xs leading-relaxed text-primary/70">This sell-through record is an operational report. Reopen it intentionally before changing leftover counts.</p></div></div>}<div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Leftover stock</p><h2 className="mt-1 font-serif text-2xl">What came home?</h2></div><span className="font-mono text-xs text-muted-foreground">{totalLeft} stems counted</span></div>{stock.length ? <div className="overflow-hidden rounded-lg border border-card-border bg-card">{stock.map((item) => <div key={item.name} className="flex items-center gap-4 border-b border-foreground/10 p-4 last:border-0"><span className="h-9 w-9 rounded-full border border-foreground/10" style={{ background: `radial-gradient(circle at 40% 30%, ${flowers.find((flower) => flower.common === item.name)?.colour ?? '#b6a1c8'}, #eee5dc)` }} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.note} · {item.opening} purchased</span></span><div className="flex items-center gap-2"><Button onClick={() => { setCounts((current) => ({ ...current, [item.name]: Math.max(0, (current[item.name] ?? 0) - 1) })); setSaveState('idle'); }} disabled={closed || (counts[item.name] ?? 0) <= 0} className="h-8 w-8 rounded-full border border-foreground/15 bg-background p-0 text-lg font-normal" testId={`button-decrease-${item.name.toLowerCase().replaceAll(' ', '-')}`}>−</Button><span className="w-6 text-center font-mono text-sm" data-testid={`text-leftover-${item.name.toLowerCase().replaceAll(' ', '-')}`}>{counts[item.name] ?? 0}</span><Button onClick={() => { setCounts((current) => ({ ...current, [item.name]: Math.min(item.opening, (current[item.name] ?? 0) + 1) })); setSaveState('idle'); }} disabled={closed || (counts[item.name] ?? 0) >= item.opening} className="h-8 w-8 rounded-full border border-foreground/15 bg-background p-0 text-lg font-normal" testId={`button-increase-${item.name.toLowerCase().replaceAll(' ', '-')}`}><Plus size={14} /></Button></div></div>)}</div> : <div className="rounded-lg border border-dashed border-foreground/15 bg-card p-8 text-center text-sm text-muted-foreground">Save actual purchases on the Buy list first to compare purchased stems with what came home.</div>}<div className="mb-4 mt-6 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Sell-through</p><h2 className="mt-1 font-serif text-2xl">What moved?</h2></div><span className="font-mono text-xs text-muted-foreground">Cycle {closeMarket.marketCycle}</span></div><div className="overflow-hidden rounded-lg border border-card-border bg-card">{sellThrough.length ? sellThrough.map((item) => <div key={item.flower} className="flex items-center gap-4 border-b border-foreground/10 p-4 last:border-0"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.flower}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.soldStems} sold · {item.leftoverStems} came home · {item.purchasedStems} purchased</span></span><span className="font-mono text-lg font-semibold text-primary" data-testid={`text-sell-through-${item.flower.toLowerCase().replaceAll(' ', '-')}`}>{item.sellThroughPercent}%</span></div>) : <div className="p-6 text-center text-sm text-muted-foreground">Sell-through appears here once purchases and leftovers are recorded.</div>}</div><Button onClick={closed ? requestReopen : () => void performSave()} disabled={saveState === 'saving'} className={`mt-4 w-full ${closed ? 'border border-primary bg-transparent text-primary' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`} testId="button-save-close">{saveState === 'saving' ? <LoaderCircle size={15} className="animate-spin" /> : closed ? <UnlockKeyhole size={15} /> : <ClipboardCheck size={15} />} {saveState === 'saving' ? 'Saving…' : closed ? 'Reopen to edit' : 'Save pack-down count'}</Button><div className="mt-3"><SaveFeedback state={saveState} onRetry={() => void performSave()} savedMessage={closed ? 'Pack-down count saved and market closed.' : 'Pack-down count saved and market reopened.'} /></div></div><aside className="h-fit space-y-3"><div className="rounded-lg border border-primary/10 bg-[#e8e4cd] p-5"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><Package size={13} /> Pack-down notes</div><p className="mt-4 font-serif text-xl leading-snug text-primary">Good flowers deserve<br />a second Sunday.</p><p className="mt-3 text-xs leading-relaxed text-primary/65">Record what is still fresh so it can guide your next buy list. Compost anything that has lost its lift.</p></div><div className="paper-card rounded-lg border border-card-border bg-card p-5"><div className="flex items-center gap-2 font-serif text-lg"><ClipboardList size={17} className="text-muted-foreground" /> Close checklist</div><div className="mt-4 space-y-3 text-xs text-muted-foreground"><label className="flex items-center gap-2"><input type="checkbox" data-testid="checkbox-pack-buckets" className="accent-primary" /> Rinse buckets</label><label className="flex items-center gap-2"><input type="checkbox" data-testid="checkbox-pack-tent" className="accent-primary" /> Pack umbrella sign</label><label className="flex items-center gap-2"><input type="checkbox" data-testid="checkbox-pack-till" className="accent-primary" /> Reconcile the till</label></div></div></aside></div></div>;
}

function Router({ nextMarket, scheduleOverrides, buyItems, actualPurchases, costs, buyList, markets, bouquetPlan, closeMarket, flowerPrices, flowerPricesLoading, flowerPriceTrackerReports, flowerPriceTrackerLoading, toggleBuyItem, setBuyListLock, saveActualPurchases, saveCosts, reportPurchases, saveBouquetPlan, saveCloseMarket, saveScheduleOverride, clearScheduleOverride }: { nextMarket: MarketCycleSummary; scheduleOverrides: MarketScheduleOverride[]; buyItems: BuyItem[]; actualPurchases: ActualPurchase[]; costs: MarketCost[]; buyList: MarketContext['buyList']; markets: Market[]; bouquetPlan: BouquetPlan; closeMarket: CloseMarket; flowerPrices: FlowerPriceHistory[]; flowerPricesLoading: boolean; flowerPriceTrackerReports: FlowerPriceTrackerMarket[]; flowerPriceTrackerLoading: boolean; toggleBuyItem: (id: number) => Promise<boolean>; setBuyListLock: (locked: boolean) => Promise<boolean>; saveActualPurchases: (purchases: BunchPurchaseInput[], receipt: ReceiptPayload) => Promise<boolean>; saveCosts: (costs: MarketCostInput[]) => Promise<boolean>; reportPurchases: () => Promise<boolean>; saveBouquetPlan: (selectedBand: string, count: number) => Promise<boolean>; saveCloseMarket: (counts: Record<string, number>, closed: boolean, reopen?: boolean) => Promise<boolean>; saveScheduleOverride: (cycle: number, data: MarketScheduleOverrideUpdate) => Promise<boolean>; clearScheduleOverride: (cycle: number) => Promise<boolean> }) {
  return <AppShell nextMarket={nextMarket} remainingBuyItems={buyItems.filter((item) => !item.checked).length}><ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/" component={() => <Dashboard buyItems={buyItems} markets={markets} nextMarket={nextMarket} scheduleOverrides={scheduleOverrides} />} /><Route path="/flowers" component={() => <FlowersPage flowerPrices={flowerPrices} flowerPricesLoading={flowerPricesLoading} />} /><Route path="/flower-price-tracker" component={() => <FlowerPriceTrackerPage reports={flowerPriceTrackerReports} isLoading={flowerPriceTrackerLoading} />} /><Route path="/markets" component={() => <div className="space-y-7"><MarketsPage markets={markets} nextMarket={nextMarket} scheduleOverrides={scheduleOverrides} saveScheduleOverride={saveScheduleOverride} clearScheduleOverride={clearScheduleOverride} /><SellThroughComparisonPanel markets={markets} scheduleOverrides={scheduleOverrides} /></div>} /><Route path="/markets/next/buy" component={() => <BuyPage buyItems={buyItems} actualPurchases={actualPurchases} costs={costs} buyList={buyList} nextMarket={nextMarket} toggleBuyItem={toggleBuyItem} setBuyListLock={setBuyListLock} saveActualPurchases={saveActualPurchases} saveCosts={saveCosts} reportPurchases={reportPurchases} />} /><Route path="/markets/next/close" component={() => <ClosePage closeMarket={closeMarket} actualPurchases={actualPurchases} nextMarket={nextMarket} saveCloseMarket={saveCloseMarket} />} /><Route path="/markets/next/bouquets" component={() => <BouquetsPage bouquetPlan={bouquetPlan} nextMarket={nextMarket} saveBouquetPlan={saveBouquetPlan} />} /><Route component={NotFound} /></Switch></ErrorBoundary></AppShell>;
}

export function useUtcDayRollover() {
  const [utcDay, setUtcDay] = useState(() => getUtcDayKey(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reconcileUtcDay = () => {
      const currentUtcDay = getUtcDayKey(new Date());
      setUtcDay((previousUtcDay) => previousUtcDay === currentUtcDay ? previousUtcDay : currentUtcDay);
    };
    const scheduleRollover = () => {
      timer = setTimeout(() => {
        const currentUtcDay = getUtcDayKey(new Date());
        if (currentUtcDay === utcDay) {
          scheduleRollover();
          return;
        }
        setUtcDay(currentUtcDay);
      }, millisecondsUntilNextUtcDay(new Date()));
    };

    window.addEventListener('focus', reconcileUtcDay);
    window.addEventListener('pageshow', reconcileUtcDay);
    document.addEventListener('visibilitychange', reconcileUtcDay);
    scheduleRollover();
    return () => {
      window.removeEventListener('focus', reconcileUtcDay);
      window.removeEventListener('pageshow', reconcileUtcDay);
      document.removeEventListener('visibilitychange', reconcileUtcDay);
      clearTimeout(timer);
    };
  }, [utcDay]);

  return utcDay;
}

function AppContent() {
  const utcDay = useUtcDayRollover();
  const scheduleOverridesQuery = useListMarketScheduleOverrides();
  const scheduleOverrides = scheduleOverridesQuery.data ?? [];
  const nextMarket = useMemo(() => marketSchedule.nextSummary(new Date(), scheduleOverrides), [utcDay, scheduleOverrides]);
  const nextMarketCycle = nextMarket.cycle;

  const marketContextQuery = useGetMarketContext(nextMarketCycle);
  const marketsQuery = useListMarkets();
  const flowerPricesQuery = useListFlowerPrices();
  const flowerPriceTrackerQuery = useListFlowerPriceTracker();
  useEffect(() => {
    const refreshMarketData = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetMarketContextQueryKey(nextMarketCycle) }),
        queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() }),
      ]);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshMarketData();
    };

    window.addEventListener('focus', refreshMarketData);
    window.addEventListener('pageshow', refreshMarketData);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshMarketData);
      window.removeEventListener('pageshow', refreshMarketData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [nextMarketCycle]);

  const buyItemMutation = useUpdateMarketBuyItem();
  const buyListMutation = useUpdateMarketBuyList();
  const actualPurchasesMutation = useReplaceMarketActualPurchases();
  const costsMutation = useReplaceMarketCosts();
  const reportPurchasesMutation = useReportMarketPurchases();
  const bouquetPlanMutation = useUpdateMarketBouquetPlan();
  const closeMarketMutation = useUpdateMarketClose();
  const scheduleOverrideMutation = useUpsertMarketScheduleOverride();
  const deleteScheduleOverrideMutation = useDeleteMarketScheduleOverride();
  const context = marketContextQuery.data;
  const markets = marketsQuery.data ?? [];
  const flowerPrices = flowerPricesQuery.data ?? [];
  const flowerPriceTrackerReports = flowerPriceTrackerQuery.data ?? [];
  const buyItems = context?.buyItems ?? [];
  const buyList = context?.buyList ?? {
    marketCycle: context?.cycle ?? nextMarketCycle,
    locked: false,
    reported: false,
    receiptFileName: null,
    receiptText: null,
    receiptCandidates: [],
    editLog: [],
  };
  const actualPurchases = context?.actualPurchases ?? [];
  const costs = context?.costs ?? [];
  const updateContext = (patch: Partial<MarketContext>) => {
    queryClient.setQueryData<MarketContext>(getGetMarketContextQueryKey(nextMarketCycle), (current) => current ? { ...current, ...patch } : current);
  };
  const toggleBuyItem = async (id: number) => {
    const item = buyItems.find((candidate) => candidate.id === id);
    if (!item) return false;
    try {
      const updated = await buyItemMutation.mutateAsync({ cycle: nextMarketCycle, id, data: { checked: !item.checked } });
      updateContext({ buyItems: buyItems.map((candidate) => candidate.id === updated.id ? updated : candidate) });
      return true;
    } catch {
      return false;
    }
  };
  const setBuyListLock = async (locked: boolean) => {
    try {
      const buyList = await buyListMutation.mutateAsync({ cycle: nextMarketCycle, data: { locked } });
      updateContext({ buyList });
      return true;
    } catch {
      return false;
    }
  };
  const saveActualPurchases = async (purchases: BunchPurchaseInput[], receipt: ReceiptPayload) => {
    try {
      const saved = await actualPurchasesMutation.mutateAsync({ cycle: nextMarketCycle, data: { purchases, ...receipt } });
      updateContext({ buyList: saved.buyList, actualPurchases: saved.purchases });
      await queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() });
      return true;
    } catch {
      return false;
    }
  };
  const reportPurchases = async () => {
    try {
      const buyList = await reportPurchasesMutation.mutateAsync({ cycle: nextMarketCycle });
      updateContext({ buyList });
      return true;
    } catch {
      return false;
    }
  };
  const saveCosts = async (nextCosts: MarketCostInput[]) => {
    try {
      const saved = await costsMutation.mutateAsync({ cycle: nextMarketCycle, data: { costs: nextCosts } });
      updateContext({ costs: saved.costs, spend: saved.spend, margin: saved.margin });
      queryClient.setQueryData<Market[]>(getListMarketsQueryKey(), (current) => current?.map((market) => market.cycle === nextMarketCycle ? { ...market, spend: saved.spend, margin: saved.margin } : market));
      return true;
    } catch {
      return false;
    }
  };
  const saveBouquetPlan = async (selectedBand: string, count: number) => {
    try {
      const bouquetPlan = await bouquetPlanMutation.mutateAsync({ cycle: nextMarketCycle, data: { selectedBand, count } });
      updateContext({ bouquetPlan });
      return true;
    } catch {
      return false;
    }
  };
  const saveCloseMarket = async (counts: Record<string, number>, closed: boolean) => {
    try {
      const closeMarket = await closeMarketMutation.mutateAsync({ cycle: nextMarketCycle, data: { counts, closed } });
      updateContext({ closeMarket });
      return true;
    } catch {
      return false;
    }
  };
  const saveScheduleOverride = async (cycle: number, data: MarketScheduleOverrideUpdate) => {
    try {
      await scheduleOverrideMutation.mutateAsync({ cycle, data });
      await queryClient.invalidateQueries({ queryKey: getListMarketScheduleOverridesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() });
      return true;
    } catch {
      return false;
    }
  };
  const clearScheduleOverride = async (cycle: number) => {
    try {
      await deleteScheduleOverrideMutation.mutateAsync({ cycle });
      await queryClient.invalidateQueries({ queryKey: getListMarketScheduleOverridesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() });
      return true;
    } catch {
      return false;
    }
  };
  if (marketContextQuery.isError || marketsQuery.isError || scheduleOverridesQuery.isError || flowerPriceTrackerQuery.isError) {
    return <TooltipProvider><div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-center font-serif text-lg text-muted-foreground">Your market notes could not be loaded. Refresh to try again.</div></TooltipProvider>;
  }
  if (marketContextQuery.isLoading || marketsQuery.isLoading || scheduleOverridesQuery.isLoading || flowerPriceTrackerQuery.isLoading || !context) {
    return <TooltipProvider><div className="flex min-h-[100dvh] items-center justify-center bg-background font-serif text-lg text-muted-foreground">Loading your market notes…</div></TooltipProvider>;
  }
  return <TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router nextMarket={nextMarket} scheduleOverrides={scheduleOverrides} buyItems={buyItems} actualPurchases={actualPurchases} costs={costs} buyList={buyList} markets={markets} bouquetPlan={context.bouquetPlan} closeMarket={context.closeMarket} flowerPrices={flowerPrices} flowerPricesLoading={flowerPricesQuery.isLoading} flowerPriceTrackerReports={flowerPriceTrackerReports} flowerPriceTrackerLoading={flowerPriceTrackerQuery.isLoading} toggleBuyItem={toggleBuyItem} setBuyListLock={setBuyListLock} saveActualPurchases={saveActualPurchases} saveCosts={saveCosts} reportPurchases={reportPurchases} saveBouquetPlan={saveBouquetPlan} saveCloseMarket={saveCloseMarket} saveScheduleOverride={saveScheduleOverride} clearScheduleOverride={clearScheduleOverride} /></WouterRouter><Toaster /></TooltipProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><AppContent /></QueryClientProvider>;
}

export default App;
