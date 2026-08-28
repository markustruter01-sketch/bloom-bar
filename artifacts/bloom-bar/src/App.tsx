import { useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
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
  ListFilter,
  Menu,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Truck,
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

import logoImage from '@assets/52BDD7EC-3FFC-4B86-B92F-AF3D8AA0F7B7_1787904150832.PNG';
import posterImage from '@assets/Sign_Umbrella_Bouquet_Botanical_Poster_1787904150833.png';
import bannerImage from '@assets/5B6123F0-2696-437A-B3F7-BFBB0D2A5F6A_1787904150833.PNG';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type Flower = {
  id: number;
  common: string;
  botanical: string;
  band: 'Filler' | 'Feature' | 'Focal';
  retail: number;
  wholesale: number;
  margin: number;
  role: string;
  seasonality: string;
  enrichment: 'Ready' | 'Needs notes' | 'Missing';
  colour: string;
};

type BuyItem = {
  id: number;
  flower: string;
  detail: string;
  qty: number;
  unit: string;
  lastPrice: number;
  checked: boolean;
  category: string;
};

const flowers: Flower[] = [
  { id: 1, common: 'Lisianthus', botanical: 'Eustoma grandiflorum', band: 'Feature', retail: 8.5, wholesale: 3.2, margin: 62, role: 'Soft feature', seasonality: 'Autumn · Winter', enrichment: 'Ready', colour: '#b6a1c8' },
  { id: 2, common: 'Disbud chrysanthemum', botanical: 'Chrysanthemum morifolium', band: 'Focal', retail: 9, wholesale: 3.7, margin: 59, role: 'Hero bloom', seasonality: 'All year', enrichment: 'Ready', colour: '#e3a38e' },
  { id: 3, common: 'Snapdragon', botanical: 'Antirrhinum majus', band: 'Feature', retail: 7.5, wholesale: 2.4, margin: 68, role: 'Line + height', seasonality: 'Winter · Spring', enrichment: 'Needs notes', colour: '#cfb9d4' },
  { id: 4, common: 'Daisy', botanical: 'Argyranthemum frutescens', band: 'Filler', retail: 4.5, wholesale: 1.3, margin: 71, role: 'Cheerful filler', seasonality: 'Spring · Summer', enrichment: 'Ready', colour: '#e6c26c' },
  { id: 5, common: 'Queen Anne’s lace', botanical: 'Daucus carota', band: 'Filler', retail: 5, wholesale: 1.8, margin: 64, role: 'Air + texture', seasonality: 'Late spring', enrichment: 'Missing', colour: '#d9d5c8' },
  { id: 6, common: 'Stock', botanical: 'Matthiola incana', band: 'Feature', retail: 6.5, wholesale: 2.1, margin: 68, role: 'Scent + body', seasonality: 'Winter · Spring', enrichment: 'Ready', colour: '#9ca7c7' },
  { id: 7, common: 'Billy buttons', botanical: 'Craspedia globosa', band: 'Filler', retail: 5.5, wholesale: 1.4, margin: 75, role: 'Graphic accent', seasonality: 'All year', enrichment: 'Needs notes', colour: '#d6ae4e' },
  { id: 8, common: 'Anemone', botanical: 'Anemone coronaria', band: 'Focal', retail: 8, wholesale: 3.1, margin: 61, role: 'Statement colour', seasonality: 'Winter · Spring', enrichment: 'Ready', colour: '#9d7ba4' },
  { id: 9, common: 'Eucalyptus foliage', botanical: 'Eucalyptus cinerea', band: 'Filler', retail: 3.5, wholesale: 0.9, margin: 74, role: 'Scent + structure', seasonality: 'All year', enrichment: 'Ready', colour: '#9aa58b' },
  { id: 10, common: 'Coral peony', botanical: 'Paeonia lactiflora', band: 'Focal', retail: 12, wholesale: 5.9, margin: 51, role: 'Premium hero', seasonality: 'Late spring', enrichment: 'Missing', colour: '#df8e80' },
];

const priceBands = [
  { name: 'Petite', price: 35, stems: '8–10 stems', note: 'A sweet handful' },
  { name: 'Market', price: 55, stems: '12–15 stems', note: 'Our Sunday best seller' },
  { name: 'Generous', price: 75, stems: '18–22 stems', note: 'For the full table' },
];

const markets = [
  { id: 1, date: '16 Mar 2025', day: 'Sunday', venue: 'Redcliffe Markets', spend: 642.8, revenue: 1846, margin: 65.2, status: 'Next up' },
  { id: 2, date: '02 Mar 2025', day: 'Sunday', venue: 'Redcliffe Markets', spend: 598.4, revenue: 1712, margin: 65.0, status: 'Closed' },
  { id: 3, date: '16 Feb 2025', day: 'Sunday', venue: 'Redcliffe Markets', spend: 621.1, revenue: 1938, margin: 67.9, status: 'Closed' },
  { id: 4, date: '02 Feb 2025', day: 'Sunday', venue: 'Redcliffe Markets', spend: 560.5, revenue: 1587, margin: 64.7, status: 'Closed' },
];

const initialBuyItems: BuyItem[] = [
  { id: 1, flower: 'Lisianthus', detail: 'White · feature', qty: 4, unit: 'bunches', lastPrice: 18.5, checked: true, category: 'Feature' },
  { id: 2, flower: 'Disbud chrysanthemum', detail: 'Apricot · focal', qty: 3, unit: 'bunches', lastPrice: 22, checked: false, category: 'Focal' },
  { id: 3, flower: 'Snapdragon', detail: 'Blush · line', qty: 4, unit: 'bunches', lastPrice: 16, checked: false, category: 'Feature' },
  { id: 4, flower: 'Daisy', detail: 'White · filler', qty: 3, unit: 'bunches', lastPrice: 12.5, checked: false, category: 'Filler' },
  { id: 5, flower: 'Queen Anne’s lace', detail: 'White · air', qty: 2, unit: 'bunches', lastPrice: 19, checked: false, category: 'Filler' },
  { id: 6, flower: 'Eucalyptus foliage', detail: 'Silver dollar · foliage', qty: 4, unit: 'bunches', lastPrice: 10, checked: false, category: 'Foliage' },
  { id: 7, flower: 'Billy buttons', detail: 'Golden · accent', qty: 2, unit: 'bunches', lastPrice: 13.5, checked: false, category: 'Accent' },
];

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/flowers', label: 'Flower library', icon: Flower2 },
  { href: '/markets', label: 'Markets', icon: Store },
];

function money(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

function Button({ children, className = '', onClick, type = 'button', testId, disabled = false }: { children: ReactNode; className?: string; onClick?: () => void; type?: 'button' | 'submit'; testId: string; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>{children}</button>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pageTitle = location === '/' ? 'Good morning, florist' : location.includes('/buy') ? 'Buy list' : location.includes('/close') ? 'Close market' : location.includes('/bouquets') ? 'Bouquet planning' : location === '/flowers' ? 'Flower library' : location === '/markets' ? 'Markets' : 'Bloom Bar';
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
          <Link href="/markets/next/buy" data-testid="link-nav-buy-list" className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${location.includes('/buy') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-primary'}`}><ShoppingBasket size={17} /><span>Buy list</span><span className="ml-auto rounded-full bg-accent/80 px-1.5 py-0.5 font-mono text-[10px] text-sidebar-primary-foreground">6</span></Link>
          <Link href="/markets/next/bouquets" data-testid="link-nav-bouquets" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${location.includes('/bouquets') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-primary'}`}><Sparkles size={17} /><span>Bouquets</span></Link>
          <Link href="/markets/next/close" data-testid="link-nav-close-market" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${location.includes('/close') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-primary'}`}><ClipboardCheck size={17} /><span>Close market</span></Link>
        </nav>
        <div className="mx-5 mb-5 rounded-lg border border-sidebar-border bg-sidebar-accent/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-sidebar-primary"><span className="h-2 w-2 rounded-full bg-[#c8d58f]" /> Morning setup</div>
          <p className="text-xs leading-relaxed text-sidebar-foreground/60">Your next market is in 5 days. Keep the stems cool.</p>
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
            <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#94aa67]" /> Saved locally</div>
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

function MetricCard({ label, value, detail, accent = 'sage', icon: Icon }: { label: string; value: string; detail: string; accent?: 'sage' | 'lilac' | 'peach'; icon: typeof TrendingUp }) {
  const accents = { sage: 'bg-[#dce3c2]', lilac: 'bg-[#e5d8e9]', peach: 'bg-[#f1d0c3]' };
  return <div className="paper-card rounded-lg border border-card-border p-5" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-5 flex items-start justify-between"><span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-full ${accents[accent]} text-foreground`}><Icon size={15} strokeWidth={1.8} /></span></div><div className="font-serif text-3xl tracking-[-.04em]" data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}

function Dashboard({ buyItems }: { buyItems: BuyItem[] }) {
  const checkedCount = buyItems.filter((item) => item.checked).length;
  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-xl border border-foreground/10 bg-[#e8e4cd] px-6 py-8 md:px-10 md:py-11">
      <img src={bannerImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[.16] mix-blend-multiply" />
      <div className="relative max-w-2xl">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary"><CalendarDays size={14} /> Sunday · 16 March 2025</div>
        <h1 className="display-font max-w-xl text-4xl leading-[1.02] tracking-[-.04em] text-primary md:text-[52px]">The next bunch<br /><i className="font-normal text-[#877194]">starts here.</i></h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-primary/70">A tidy plan for your next morning at Redcliffe Markets. You have the good stems covered — now make the little things easy.</p>
        <div className="mt-7 flex flex-wrap gap-2.5"><Link href="/markets/next/buy" data-testid="link-hero-buy-list" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Open buy list <ArrowRight size={15} /></Link><Link href="/markets/next/bouquets" data-testid="link-hero-bouquets" className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-background/40 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-background/65">Plan bouquets <Sparkles size={15} /></Link></div>
      </div>
      <div className="absolute -bottom-10 right-[-10px] hidden w-[235px] rotate-[-5deg] rounded-sm border-[8px] border-[#f2ebe5] shadow-lg lg:block"><img src={posterImage} alt="Bloom Bar umbrella bouquet poster" className="block w-full" data-testid="img-bouquet-poster" /></div>
    </section>

    <section className="grid gap-3 md:grid-cols-3">
      <MetricCard label="Last market" value="$1,712" detail="+8.4% on the previous Sunday" icon={TrendingUp} accent="sage" />
      <MetricCard label="Gross margin" value="65.0%" detail="$1,113.60 after flower spend" icon={BarChart3} accent="lilac" />
      <MetricCard label="Next market" value="5 days" detail="Buy list is 1 of 7 items ready" icon={Clock3} accent="peach" />
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="paper-card overflow-hidden rounded-lg border border-card-border">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4 md:px-6"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Sunday rhythm</p><h2 className="mt-1 font-serif text-xl">Recent performance</h2></div><Link href="/markets" data-testid="link-dashboard-markets" className="text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4">View markets</Link></div>
        <div className="p-5 md:p-6">
          <div className="flex h-[168px] items-end gap-2 border-b border-l border-foreground/10 px-2 pb-0 pt-5 md:gap-5">
            {[{ label: '02 Feb', value: 1587, height: '54%' }, { label: '16 Feb', value: 1938, height: '86%' }, { label: '02 Mar', value: 1712, height: '68%' }, { label: '16 Mar', value: 1846, height: '77%' }].map((item, index) => <div key={item.label} className="group flex h-full flex-1 flex-col justify-end gap-2"><div className="relative flex flex-1 items-end"><div className={`relative w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80 ${index === 3 ? 'bg-primary' : 'bg-[#b9c29b]'}`} style={{ height: item.height }}><span className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{money(item.value)}</span></div></div><span className={`pb-2 text-center font-mono text-[9px] ${index === 3 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{item.label}</span></div>)}
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

function FlowersPage() {
  const [query, setQuery] = useState('');
  const [band, setBand] = useState('All bands');
  const [enrichment, setEnrichment] = useState('All status');
  const [selected, setSelected] = useState<Flower | null>(null);
  const visible = useMemo(() => flowers.filter((flower) => (flower.common.toLowerCase().includes(query.toLowerCase()) || flower.botanical.toLowerCase().includes(query.toLowerCase())) && (band === 'All bands' || flower.band === band) && (enrichment === 'All status' || flower.enrichment === enrichment)), [query, band, enrichment]);
  return <div>
    <PageIntro eyebrow="The studio / flower library" title="Know your stems." description="Your working catalogue for pricing, planning and making the Sunday table feel abundant." action={<Button onClick={() => window.alert('New flowers can be added once local data is connected.')} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-add-flower"><Plus size={15} /> Add flower</Button>} />
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-foreground/10 bg-card/70 p-3 md:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by common or botanical name" data-testid="input-search-flowers" className="h-10 w-full rounded-md border border-foreground/10 bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary" /></label><div className="flex gap-2"><select value={band} onChange={(event) => setBand(event.target.value)} data-testid="select-flower-band" className="h-10 rounded-md border border-foreground/10 bg-background px-3 text-xs font-semibold outline-none"><option>All bands</option><option>Focal</option><option>Feature</option><option>Filler</option></select><select value={enrichment} onChange={(event) => setEnrichment(event.target.value)} data-testid="select-enrichment-status" className="h-10 rounded-md border border-foreground/10 bg-background px-3 text-xs font-semibold outline-none"><option>All status</option><option>Ready</option><option>Needs notes</option><option>Missing</option></select></div></div>
    <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground"><span data-testid="text-flower-count">{visible.length} of {flowers.length} stems shown</span><span className="hidden items-center gap-1.5 sm:flex"><ListFilter size={13} /> Price bands guide your build</span></div>
    <div className="overflow-hidden rounded-lg border border-card-border bg-card"><div className="hidden grid-cols-[1.6fr_1.2fr_.7fr_.6fr_.6fr_.65fr] border-b border-foreground/10 bg-muted/55 px-5 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground md:grid"><span>Flower</span><span>Role / season</span><span>Band</span><span>Retail</span><span>Wholesale</span><span>Margin</span></div>{visible.map((flower, index) => <button type="button" onClick={() => setSelected(flower)} key={flower.id} data-testid={`row-flower-${flower.id}`} className="grid w-full grid-cols-[1fr_auto] gap-3 border-b border-foreground/10 px-4 py-4 text-left transition-colors last:border-0 hover:bg-muted/50 md:grid-cols-[1.6fr_1.2fr_.7fr_.6fr_.6fr_.65fr] md:items-center md:px-5"><div className="flex items-center gap-3"><span className="h-9 w-9 shrink-0 rounded-full border border-foreground/10" style={{ background: `radial-gradient(circle at 40% 30%, ${flower.colour}, #eee5dc)` }} /><span><span className="block text-sm font-semibold">{flower.common}</span><span className="mt-0.5 block font-serif text-xs italic text-muted-foreground">{flower.botanical}</span></span></div><div className="hidden md:block"><div className="text-xs">{flower.role}</div><div className="mt-1 text-[11px] text-muted-foreground">{flower.seasonality}</div></div><div className="hidden md:block"><span className={`inline-flex rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${flower.band === 'Focal' ? 'bg-[#f0d3c9]' : flower.band === 'Feature' ? 'bg-[#e4d7e9]' : 'bg-[#dce3c2]'}`}>{flower.band}</span></div><span className="hidden font-mono text-xs md:block">{money(flower.retail)}</span><span className="hidden font-mono text-xs text-muted-foreground md:block">{money(flower.wholesale)}</span><div className="flex flex-col items-end gap-1 md:items-start"><span className="font-mono text-sm text-primary">{flower.margin}%</span><span className={`text-[10px] ${flower.enrichment === 'Ready' ? 'text-[#6b8b58]' : flower.enrichment === 'Missing' ? 'text-[#aa6e62]' : 'text-[#9a7d44]'}`}>{flower.enrichment}</span></div></button>)}{visible.length === 0 && <div className="px-6 py-14 text-center"><Flower2 className="mx-auto text-muted-foreground/50" size={28} /><p className="mt-3 font-serif text-lg">No stems found</p><p className="mt-1 text-sm text-muted-foreground">Try a different name or clear a filter.</p><Button onClick={() => { setQuery(''); setBand('All bands'); setEnrichment('All status'); }} className="mt-4 border border-foreground/15 bg-background" testId="button-clear-flower-filters">Clear filters</Button></div>}</div>
    {selected && <div className="fixed inset-0 z-40 flex items-end justify-center bg-primary/20 p-3 backdrop-blur-sm md:items-center" onClick={() => setSelected(null)}><div className="w-full max-w-md rounded-xl border border-card-border bg-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><span className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Stem notes</span><h2 className="mt-1 font-serif text-3xl">{selected.common}</h2><p className="font-serif text-sm italic text-muted-foreground">{selected.botanical}</p></div><Button onClick={() => setSelected(null)} className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-muted" testId="button-close-flower-detail"><X size={16} /></Button></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-md bg-muted p-3"><span className="font-mono text-[9px] uppercase text-muted-foreground">Retail</span><div className="mt-1 font-serif text-xl">{money(selected.retail)}</div></div><div className="rounded-md bg-muted p-3"><span className="font-mono text-[9px] uppercase text-muted-foreground">Margin</span><div className="mt-1 font-serif text-xl">{selected.margin}%</div></div></div><div className="mt-4 space-y-3 border-t border-foreground/10 pt-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-semibold">{selected.role}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Seasonality</span><span className="font-semibold">{selected.seasonality}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Enrichment</span><span className="font-semibold">{selected.enrichment}</span></div></div></div></div>}
  </div>;
}

function MarketsPage() {
  const [activeTab, setActiveTab] = useState('All markets');
  const filtered = markets.filter((market) => activeTab === 'All markets' || (activeTab === 'Upcoming' ? market.status === 'Next up' : market.status === 'Closed'));
  return <div><PageIntro eyebrow="The studio / market history" title="Every Sunday, accounted for." description="A clear view of what the stall costs, what it earns, and what to carry forward." action={<Button onClick={() => window.alert('New markets are ready to add when your market calendar is connected.')} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-add-market"><Plus size={15} /> Add market</Button>} /><div className="mb-6 flex items-center gap-1 border-b border-foreground/10"><button onClick={() => setActiveTab('All markets')} data-testid="tab-all-markets" className={`border-b-2 px-3 py-3 text-xs font-semibold ${activeTab === 'All markets' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>All markets <span className="ml-1 font-mono text-[10px] opacity-60">4</span></button><button onClick={() => setActiveTab('Upcoming')} data-testid="tab-upcoming-markets" className={`border-b-2 px-3 py-3 text-xs font-semibold ${activeTab === 'Upcoming' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Upcoming <span className="ml-1 font-mono text-[10px] opacity-60">1</span></button><button onClick={() => setActiveTab('Closed')} data-testid="tab-closed-markets" className={`border-b-2 px-3 py-3 text-xs font-semibold ${activeTab === 'Closed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Closed <span className="ml-1 font-mono text-[10px] opacity-60">3</span></button></div><div className="grid gap-3 md:grid-cols-3"><MetricCard label="Total revenue" value="$7,083" detail="Across 4 Redcliffe Sundays" icon={DollarSign} accent="sage" /><MetricCard label="Average spend" value="$606" detail="Flowers + stall costs" icon={ShoppingBasket} accent="peach" /><MetricCard label="Average margin" value="65.7%" detail="A healthy bunch of trade" icon={BarChart3} accent="lilac" /></div><div className="mt-7 overflow-hidden rounded-lg border border-card-border bg-card"><div className="hidden grid-cols-[1.3fr_1.4fr_.8fr_.8fr_.8fr] border-b border-foreground/10 bg-muted/55 px-5 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground md:grid"><span>Market</span><span>Venue</span><span>Spend</span><span>Revenue</span><span>Margin</span></div>{filtered.map((market) => <div key={market.id} data-testid={`row-market-${market.id}`} className="grid gap-3 border-b border-foreground/10 px-4 py-5 last:border-0 md:grid-cols-[1.3fr_1.4fr_.8fr_.8fr_.8fr] md:items-center md:px-5"><div className="flex items-center justify-between md:block"><div className="flex items-center gap-2"><CalendarDays size={15} className="text-muted-foreground" /><span className="text-sm font-semibold">{market.date}</span>{market.status === 'Next up' && <span className="rounded-full bg-[#dce3c2] px-2 py-1 font-mono text-[9px] uppercase text-primary">Next up</span>}</div><span className="mt-1 block pl-5 text-xs text-muted-foreground md:pl-0">{market.day}</span></div><div className="hidden text-sm text-muted-foreground md:block">{market.venue}</div><div className="grid grid-cols-3 gap-3 border-t border-foreground/10 pt-3 md:contents"><div><span className="block font-mono text-[9px] uppercase text-muted-foreground md:hidden">Spend</span><span className="font-mono text-sm">{money(market.spend)}</span></div><div><span className="block font-mono text-[9px] uppercase text-muted-foreground md:hidden">Revenue</span><span className="font-mono text-sm">{money(market.revenue)}</span></div><div><span className="block font-mono text-[9px] uppercase text-muted-foreground md:hidden">Margin</span><span className="font-mono text-sm text-[#64804e]">{market.margin}%</span></div></div></div>)}</div></div>;
}

function MarketSubnav({ active }: { active: 'buy' | 'bouquets' | 'close' }) {
  return <div className="mb-8 flex gap-1 overflow-x-auto border-b border-foreground/10">{[{ id: 'buy', label: 'Buy list', href: '/markets/next/buy', icon: ShoppingBasket }, { id: 'bouquets', label: 'Bouquets', href: '/markets/next/bouquets', icon: Sparkles }, { id: 'close', label: 'Close market', href: '/markets/next/close', icon: ClipboardCheck }].map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} data-testid={`tab-market-${id}`} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${active === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Icon size={14} />{label}</Link>)}</div>;
}

function BuyPage({ buyItems, toggleBuyItem }: { buyItems: BuyItem[]; toggleBuyItem: (id: number) => void }) {
  const [filter, setFilter] = useState('All stems');
  const categories = ['All stems', ...Array.from(new Set(buyItems.map((item) => item.category)))];
  const items = buyItems.filter((item) => filter === 'All stems' || item.category === filter);
  const done = buyItems.filter((item) => item.checked).length;
  const total = buyItems.reduce((sum, item) => sum + item.qty * item.lastPrice, 0);
  return <div><PageIntro eyebrow="Next market / preparation" title="Buy with a clear head." description="A practical list for the flower run. Tick things off as they land in your trolley." action={<div className="rounded-md bg-[#dce3c2] px-3 py-2 text-center"><div className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">Sunday 16 Mar</div><div className="text-sm font-semibold text-primary">5 days to go</div></div>} /><MarketSubnav active="buy" /><div className="grid gap-5 lg:grid-cols-[1fr_330px]"><div><div className="mb-4 flex items-center justify-between"><div className="flex gap-1 overflow-x-auto rounded-md bg-muted p-1">{categories.map((category) => <button key={category} onClick={() => setFilter(category)} data-testid={`filter-buy-${category.toLowerCase().replaceAll(' ', '-')}`} className={`shrink-0 rounded px-2.5 py-1.5 text-[11px] font-semibold ${filter === category ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{category}</button>)}</div><span className="hidden font-mono text-[10px] text-muted-foreground sm:block">{done}/{buyItems.length} checked</span></div><div className="space-y-2">{items.map((item) => <button type="button" key={item.id} onClick={() => toggleBuyItem(item.id)} data-testid={`button-check-buy-${item.id}`} className={`group flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all ${item.checked ? 'border-[#ccd6b0] bg-[#edf0df]/75' : 'border-card-border bg-card hover:border-primary/30'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${item.checked ? 'check-pop border-primary bg-primary text-primary-foreground' : 'border-foreground/20 group-hover:border-primary'}`}>{item.checked && <Check size={14} strokeWidth={3} />}</span><span className="min-w-0 flex-1"><span className={`block text-sm font-semibold ${item.checked ? 'text-muted-foreground line-through' : ''}`}>{item.flower}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span></span><span className="text-right"><span className="block font-mono text-sm">{item.qty}</span><span className="block text-[10px] text-muted-foreground">{item.unit}</span></span><span className="hidden w-20 text-right sm:block"><span className="block font-mono text-xs">{money(item.lastPrice)}</span><span className="block text-[10px] text-muted-foreground">last price</span></span><MoreHorizontal size={16} className="text-muted-foreground/50" /></button>)}</div><Button onClick={() => window.alert('A new blank stem row is ready to add in the connected version.')} className="mt-4 w-full border border-dashed border-foreground/20 bg-transparent text-muted-foreground hover:border-primary hover:text-primary" testId="button-add-buy-item"><Plus size={15} /> Add another stem</Button></div><aside className="h-fit space-y-3 lg:sticky lg:top-24"><div className="rounded-lg border border-primary/10 bg-[#e8e4cd] p-5"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><DollarSign size={13} /> Sourcing estimate</div><div className="mt-4 font-serif text-4xl tracking-[-.04em] text-primary" data-testid="text-buy-estimate">{money(total)}</div><p className="mt-1 text-xs leading-relaxed text-primary/65">Based on your last recorded prices. Leave a little room for market morning surprises.</p><div className="mt-5 border-t border-primary/15 pt-4"><div className="flex justify-between text-xs"><span className="text-primary/65">Expected flower spend</span><span className="font-mono font-semibold text-primary">{money(total)}</span></div><div className="mt-2 flex justify-between text-xs"><span className="text-primary/65">Target revenue</span><span className="font-mono font-semibold text-primary">$1,846</span></div></div></div><div className="paper-card rounded-lg border border-card-border p-5"><div className="flex items-center gap-2 font-serif text-lg"><Truck size={17} className="text-muted-foreground" /> Sourcing notes</div><ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground"><li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />Confirm grower availability by Thursday afternoon.</li><li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />Ask for the softest apricot disbuds on the cart.</li><li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />Pick up buckets and extra paper on the way in.</li></ul></div></aside></div></div>;
}

function BouquetsPage() {
  const [selectedBand, setSelectedBand] = useState('Market');
  const [count, setCount] = useState(18);
  const band = priceBands.find((item) => item.name === selectedBand) ?? priceBands[1];
  return <div><PageIntro eyebrow="Next market / making plan" title="A table full of colour." description="Decide the shape of Sunday before the first customer arrives. Your build-your-own bar, made legible." action={<Button onClick={() => setCount(count + 1)} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-add-bouquet"><Plus size={15} /> Add bouquet</Button>} /><MarketSubnav active="bouquets" /><div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><div><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Price architecture</p><h2 className="mt-1 font-serif text-2xl">Three sizes, one good day.</h2></div><span className="font-mono text-xs text-muted-foreground">{count} planned</span></div><div className="space-y-3">{priceBands.map((item, index) => <button key={item.name} type="button" onClick={() => setSelectedBand(item.name)} data-testid={`button-price-band-${item.name.toLowerCase()}`} className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all ${selectedBand === item.name ? 'border-primary bg-[#e8e4cd] shadow-sm' : 'border-card-border bg-card hover:border-primary/30'}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif text-lg ${index === 0 ? 'bg-[#e4d7e9]' : index === 1 ? 'bg-[#dce3c2]' : 'bg-[#f1d0c3]'}`}>{index + 1}</span><span className="flex-1"><span className="block font-serif text-xl">{item.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.note} · {item.stems}</span></span><span className="font-mono text-lg">{money(item.price)}</span>{selectedBand === item.name && <CheckCircle2 size={18} className="text-primary" />}</button>)}</div><div className="mt-7 rounded-lg border border-card-border bg-card p-5"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Stem recipe</p><h3 className="mt-1 font-serif text-xl">{band.name} bouquet</h3></div><Pencil size={15} className="text-muted-foreground" /></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ name: 'Focal', qty: 2, colour: '#e3a38e' }, { name: 'Feature', qty: 5, colour: '#b6a1c8' }, { name: 'Filler', qty: 4, colour: '#e6c26c' }, { name: 'Foliage', qty: 3, colour: '#9aa58b' }].map((item) => <div key={item.name} className="rounded-md bg-muted p-3"><span className="block h-3 w-3 rounded-full" style={{ background: item.colour }} /><span className="mt-3 block text-xs font-semibold">{item.name}</span><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{item.qty} stems</span></div>)}</div></div></div><div className="relative overflow-hidden rounded-xl border border-foreground/10 bg-[#e8e4cd] p-6 md:p-8"><img src={posterImage} alt="Umbrella bouquet poster inspiration" className="absolute -right-16 -top-20 w-[210px] rotate-12 opacity-[.15] mix-blend-multiply" /><div className="relative"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><Tag size={13} /> Sunday target</div><div className="mt-8 flex items-end gap-3"><span className="font-serif text-7xl leading-none text-primary">{count}</span><span className="mb-2 font-serif text-xl text-primary/70">bouquets</span></div><p className="mt-4 max-w-xs text-sm leading-relaxed text-primary/70">A gentle target for the umbrella bouquet table. You can always make more when the morning gets busy.</p><div className="mt-8 border-t border-primary/15 pt-5"><div className="flex justify-between text-xs text-primary/70"><span>Target bouquet revenue</span><span className="font-mono font-semibold text-primary">{money(count * 55)}</span></div><div className="mt-3 flex justify-between text-xs text-primary/70"><span>Selected size</span><span className="font-semibold text-primary">{band.name} · {money(band.price)}</span></div></div><Button onClick={() => window.alert(`${count} ${band.name.toLowerCase()} bouquets planned for Sunday.`)} className="mt-8 w-full bg-primary text-primary-foreground hover:bg-primary/90" testId="button-save-bouquet-plan"><Check size={15} /> Save Sunday plan</Button></div></div></div></div>;
}

function ClosePage() {
  const [counts, setCounts] = useState<Record<string, number>>({ 'Lisianthus': 2, 'Daisy': 7, 'Snapdragon': 3, 'Eucalyptus foliage': 5 });
  const [closed, setClosed] = useState(false);
  const stock = [{ name: 'Lisianthus', note: 'Feature stems', opening: 18 }, { name: 'Daisy', note: 'Filler stems', opening: 30 }, { name: 'Snapdragon', note: 'Line stems', opening: 20 }, { name: 'Eucalyptus foliage', note: 'Foliage stems', opening: 26 }];
  const totalLeft = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return <div><PageIntro eyebrow="Next market / pack-down" title="Leave the shed lighter." description="A quick count of what came home, what found a vase, and what to carry into the next Sunday." action={<div className={`rounded-md px-3 py-2 text-center ${closed ? 'bg-[#dce3c2]' : 'bg-muted'}`}><div className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">Market status</div><div className="text-sm font-semibold">{closed ? 'Closed out' : 'Not closed'}</div></div>} /><MarketSubnav active="close" /><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div><div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Leftover stock</p><h2 className="mt-1 font-serif text-2xl">What came home?</h2></div><span className="font-mono text-xs text-muted-foreground">{totalLeft} stems counted</span></div><div className="overflow-hidden rounded-lg border border-card-border bg-card">{stock.map((item) => <div key={item.name} className="flex items-center gap-4 border-b border-foreground/10 p-4 last:border-0"><span className="h-9 w-9 rounded-full border border-foreground/10" style={{ background: `radial-gradient(circle at 40% 30%, ${flowers.find((flower) => flower.common === item.name)?.colour ?? '#b6a1c8'}, #eee5dc)` }} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.note} · {item.opening} opened</span></span><div className="flex items-center gap-2"><Button onClick={() => setCounts((current) => ({ ...current, [item.name]: Math.max(0, (current[item.name] ?? 0) - 1) }))} className="h-8 w-8 rounded-full border border-foreground/15 bg-background p-0 text-lg font-normal" testId={`button-decrease-${item.name.toLowerCase().replaceAll(' ', '-')}`}>−</Button><span className="w-6 text-center font-mono text-sm" data-testid={`text-leftover-${item.name.toLowerCase().replaceAll(' ', '-')}`}>{counts[item.name] ?? 0}</span><Button onClick={() => setCounts((current) => ({ ...current, [item.name]: (current[item.name] ?? 0) + 1 }))} className="h-8 w-8 rounded-full border border-foreground/15 bg-background p-0 text-lg font-normal" testId={`button-increase-${item.name.toLowerCase().replaceAll(' ', '-')}`}><Plus size={14} /></Button></div></div>)}</div><Button onClick={() => setClosed(!closed)} className={`mt-4 w-full ${closed ? 'border border-primary bg-transparent text-primary' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`} testId="button-save-close">{closed ? <><CheckCircle2 size={15} /> Reopen count</> : <><ClipboardCheck size={15} /> Save pack-down count</>}</Button></div><aside className="h-fit space-y-3"><div className="rounded-lg border border-primary/10 bg-[#e8e4cd] p-5"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><Package size={13} /> Pack-down notes</div><p className="mt-4 font-serif text-xl leading-snug text-primary">Good flowers deserve<br />a second Sunday.</p><p className="mt-3 text-xs leading-relaxed text-primary/65">Record what is still fresh so it can guide your next buy list. Compost anything that has lost its lift.</p></div><div className="paper-card rounded-lg border border-card-border p-5"><div className="flex items-center gap-2 font-serif text-lg"><ClipboardList size={17} className="text-muted-foreground" /> Close checklist</div><div className="mt-4 space-y-3 text-xs text-muted-foreground"><label className="flex items-center gap-2"><input type="checkbox" data-testid="checkbox-pack-buckets" className="accent-primary" /> Rinse buckets</label><label className="flex items-center gap-2"><input type="checkbox" data-testid="checkbox-pack-tent" className="accent-primary" /> Pack umbrella sign</label><label className="flex items-center gap-2"><input type="checkbox" data-testid="checkbox-pack-till" className="accent-primary" /> Reconcile the till</label></div></div></aside></div></div>;
}

function Router({ buyItems, toggleBuyItem }: { buyItems: BuyItem[]; toggleBuyItem: (id: number) => void }) {
  return <AppShell><ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/" component={() => <Dashboard buyItems={buyItems} />} /><Route path="/flowers" component={FlowersPage} /><Route path="/markets" component={MarketsPage} /><Route path="/markets/next/buy" component={() => <BuyPage buyItems={buyItems} toggleBuyItem={toggleBuyItem} />} /><Route path="/markets/next/close" component={ClosePage} /><Route path="/markets/next/bouquets" component={BouquetsPage} /><Route component={NotFound} /></Switch></ErrorBoundary></AppShell>;
}

function App() {
  const [buyItems, setBuyItems] = useState(initialBuyItems);
  const toggleBuyItem = (id: number) => setBuyItems((items) => items.map((item) => item.id === id ? { ...item, checked: !item.checked } : item));
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router buyItems={buyItems} toggleBuyItem={toggleBuyItem} /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;