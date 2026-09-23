import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  NonFlowerBankImport,
  NonFlowerBankImportDetailsUpdate,
  NonFlowerBankImportInput,
  NonFlowerPurchaseAllocationInput,
  NonFlowerPurchaseInput,
  NonFlowerPurchasePeriod,
} from '@workspace/api-client-react';
import { AlertTriangle, CalendarDays, CheckCircle2, DollarSign, FileUp, LoaderCircle, Plus, ReceiptText, Save, Tag, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatMarketDate, marketSchedule, type MarketCycleSummary, type MarketScheduleOverride } from '@/lib/market-schedule';
import { parseBankCsv, parseBankPdf, sha256Fingerprint } from '@/lib/non-flower-bank-import';
import {
  calculateNonFlowerAllocationCost,
  calculateNonFlowerAllocationPercentage,
  calculateNonFlowerCostPerPiece,
} from '@/lib/non-flower-price-tracking';

type DraftAllocation = NonFlowerPurchaseAllocationInput & { localId: string };
type NonFlowerDraft = Omit<NonFlowerPurchaseInput, 'allocations' | 'productType'> & {
  localId: string;
  allocations: DraftAllocation[];
};
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function money(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

function unitMoney(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function dateLabel(date: string) {
  return formatMarketDate(new Date(`${date}T00:00:00Z`), 'short');
}

function Button({ children, className = '', onClick, disabled = false, testId }: { children: ReactNode; className?: string; onClick?: () => void; disabled?: boolean; testId: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>{children}</button>;
}

function allocationDraftFromPurchase(purchase: NonFlowerPurchasePeriod['purchases'][number], allocation: NonFlowerPurchasePeriod['purchases'][number]['allocations'][number], index: number): DraftAllocation {
  return {
    localId: `${purchase.id}-allocation-${allocation.id || index}`,
    productType: allocation.productType,
    allocationQuantity: allocation.allocationQuantity,
    allocationPercentage: allocation.allocationPercentage,
  };
}

function allocationTotalPercent(purchase: NonFlowerDraft) {
  return purchase.allocations.reduce((sum, allocation) => sum + calculateNonFlowerAllocationPercentage(purchase.quantity, allocation.allocationQuantity, allocation.allocationPercentage), 0);
}

function allocatedSpendByProduct(drafts: NonFlowerDraft[]) {
  return drafts.reduce<Record<string, number>>((groups, purchase) => {
    let allocated = 0;
    for (const allocation of purchase.allocations) {
      const cost = calculateNonFlowerAllocationCost(purchase.totalPrice, purchase.quantity, allocation.allocationQuantity, allocation.allocationPercentage);
      groups[allocation.productType.trim() || 'Unallocated'] = (groups[allocation.productType.trim() || 'Unallocated'] ?? 0) + cost;
      allocated += cost;
    }
    const remainder = Math.max(0, purchase.totalPrice - allocated);
    if (remainder > 0.005 || purchase.allocations.length === 0) {
      groups.Unallocated = (groups.Unallocated ?? 0) + remainder;
    }
    return groups;
  }, {});
}

type BankDetailDraft = { localId: string; category: string; description: string; totalPrice: number; quantity: number };
type BankLineDraft = Omit<NonFlowerBankImport['lines'][number], 'details'> & { details: BankDetailDraft[] };
type BankImportDraft = Omit<NonFlowerBankImport, 'lines'> & { lines: BankLineDraft[] };

function bankImportDraft(imported: NonFlowerBankImport): BankImportDraft {
  return {
    ...imported,
    lines: imported.lines.map((line) => ({
      ...line,
      details: line.details.map((detail, index) => ({
        localId: `${line.id}-detail-${detail.id || index}`,
        category: detail.category,
        description: detail.description,
        totalPrice: detail.totalPrice,
        quantity: detail.quantity,
      })),
    })),
  };
}

export function NonFlowerPriceTrackingPage({ periods, scheduleOverrides, nextMarket, savePurchases, importBankFile, saveImportDetails }: { periods: NonFlowerPurchasePeriod[]; scheduleOverrides: MarketScheduleOverride[]; nextMarket: MarketCycleSummary; savePurchases: (cycle: number, purchases: NonFlowerPurchaseInput[]) => Promise<boolean>; importBankFile: (cycle: number, data: NonFlowerBankImportInput) => Promise<{ status: 'imported' | 'duplicate'; import: NonFlowerBankImport } | null>; saveImportDetails: (importId: number, data: NonFlowerBankImportDetailsUpdate) => Promise<NonFlowerBankImport | null> }) {
  const schedulePeriods = useMemo(() => {
    const byCycle = new Map(periods.map((period) => [period.marketCycle, period]));
    if (!byCycle.has(nextMarket.cycle)) {
      const endDate = marketSchedule.effectiveDateForCycle(nextMarket.cycle, scheduleOverrides) ?? marketSchedule.dateForCycle(nextMarket.cycle);
      const startDate = marketSchedule.effectiveDateForCycle(nextMarket.cycle - 1, scheduleOverrides) ?? marketSchedule.dateForCycle(nextMarket.cycle - 1);
      byCycle.set(nextMarket.cycle, {
        marketCycle: nextMarket.cycle,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        purchases: [],
        imports: [],
      });
    }
    return [...byCycle.values()].sort((a, b) => a.marketCycle - b.marketCycle);
  }, [nextMarket.cycle, periods, scheduleOverrides]);
  const [activeCycle, setActiveCycle] = useState(nextMarket.cycle);
  const [drafts, setDrafts] = useState<NonFlowerDraft[]>([]);
  const [importDrafts, setImportDrafts] = useState<BankImportDraft[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [savingImportId, setSavingImportId] = useState<number | null>(null);
  const activePeriod = schedulePeriods.find((period) => period.marketCycle === activeCycle) ?? schedulePeriods[0];

  useEffect(() => {
    if (!activePeriod) return;
    setActiveCycle(activePeriod.marketCycle);
    setDrafts(activePeriod.purchases.map((purchase) => ({
      localId: String(purchase.id),
      category: purchase.category,
      description: purchase.description,
      totalPrice: purchase.totalPrice,
      quantity: purchase.quantity,
      allocations: purchase.allocations.map((allocation, index) => allocationDraftFromPurchase(purchase, allocation, index)),
    })));
    setImportDrafts(activePeriod.imports.map(bankImportDraft));
    setSaveState('idle');
    setImportMessage(null);
  }, [activePeriod]);

  const totalSpend = drafts.reduce((sum, purchase) => sum + (Number.isFinite(purchase.totalPrice) ? purchase.totalPrice : 0), 0);
  const allocatedSpend = allocatedSpendByProduct(drafts);
  const addPurchase = () => {
    setDrafts((current) => [...current, {
      localId: `new-${Date.now()}-${current.length}`,
      category: 'Packaging',
      description: '',
      totalPrice: 0,
      quantity: 1,
      allocations: [],
    }]);
    setSaveState('idle');
  };
  const updatePurchase = (localId: string, patch: Partial<Omit<NonFlowerDraft, 'localId' | 'allocations'>>) => {
    setDrafts((current) => current.map((purchase) => purchase.localId === localId ? { ...purchase, ...patch } : purchase));
    setSaveState('idle');
  };
  const updateAllocation = (purchaseId: string, allocationId: string, patch: Partial<NonFlowerPurchaseAllocationInput>) => {
    setDrafts((current) => current.map((purchase) => purchase.localId !== purchaseId
      ? purchase
      : { ...purchase, allocations: purchase.allocations.map((allocation) => allocation.localId === allocationId ? { ...allocation, ...patch } : allocation) }));
    setSaveState('idle');
  };
  const addAllocation = (purchaseId: string) => {
    setDrafts((current) => current.map((purchase) => purchase.localId !== purchaseId
      ? purchase
      : {
        ...purchase,
        allocations: [...purchase.allocations, {
          localId: `${purchaseId}-allocation-${purchase.allocations.length}-${Date.now()}`,
          productType: '',
          allocationQuantity: 1,
          allocationPercentage: null,
        }],
      }));
    setSaveState('idle');
  };
  const removeAllocation = (purchaseId: string, allocationId: string) => {
    setDrafts((current) => current.map((purchase) => purchase.localId !== purchaseId
      ? purchase
      : { ...purchase, allocations: purchase.allocations.filter((allocation) => allocation.localId !== allocationId) }));
    setSaveState('idle');
  };
  const removePurchase = (localId: string) => {
    setDrafts((current) => current.filter((purchase) => purchase.localId !== localId));
    setSaveState('idle');
  };
  const updateBankDetail = (importId: number, lineId: number, detailId: string, patch: Partial<Omit<BankDetailDraft, 'localId'>>) => {
    setImportDrafts((current) => current.map((imported) => imported.id !== importId ? imported : {
      ...imported,
      lines: imported.lines.map((line) => line.id !== lineId ? line : {
        ...line,
        details: line.details.map((detail) => detail.localId === detailId ? { ...detail, ...patch } : detail),
      }),
    }));
  };
  const addBankDetail = (importId: number, lineId: number) => {
    setImportDrafts((current) => current.map((imported) => imported.id !== importId ? imported : {
      ...imported,
      lines: imported.lines.map((line) => line.id !== lineId ? line : {
        ...line,
        details: [...line.details, {
          localId: `${lineId}-detail-new-${Date.now()}`,
          category: 'Packaging',
          description: '',
          totalPrice: 0,
          quantity: 1,
        }],
      }),
    }));
  };
  const removeBankDetail = (importId: number, lineId: number, detailId: string) => {
    setImportDrafts((current) => current.map((imported) => imported.id !== importId ? imported : {
      ...imported,
      lines: imported.lines.map((line) => line.id !== lineId ? line : {
        ...line,
        details: line.details.filter((detail) => detail.localId !== detailId),
      }),
    }));
  };
  const saveBankDetails = async (imported: BankImportDraft) => {
    const hasInvalid = imported.lines.some((line) => line.details.some((detail) =>
      !detail.category.trim()
      || !detail.description.trim()
      || !Number.isFinite(detail.totalPrice)
      || detail.totalPrice < 0
      || !Number.isInteger(detail.quantity)
      || detail.quantity <= 0,
    ));
    if (hasInvalid) {
      toast({ variant: 'destructive', title: 'Check the imported detail rows', description: 'Each row needs a category, description, non-negative total, and whole-number quantity.' });
      return;
    }
    setSavingImportId(imported.id);
    const saved = await saveImportDetails(imported.id, {
      lines: imported.lines.map((line) => ({
        lineId: line.id,
        details: line.details.map(({ localId: _localId, ...detail }) => ({
          ...detail,
          category: detail.category.trim(),
          description: detail.description.trim(),
        })),
      })),
    });
    setSavingImportId(null);
    if (saved) {
      setImportMessage(`Saved breakdown for ${imported.fileName}.`);
      toast({ title: 'Breakdown saved', description: 'The imported bank lines were updated.' });
    } else {
      toast({ variant: 'destructive', title: 'Breakdown save failed', description: 'Your edits are still here. Try again.' });
    }
  };
  const handleBankFile = async (file: File | undefined) => {
    if (!file || !activePeriod) return;
    setImportMessage(null);
    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
      const lines = isPdf
        ? await parseBankPdf(await file.arrayBuffer())
        : parseBankCsv(await file.text());
      const response = await importBankFile(activePeriod.marketCycle, {
        fileName: file.name,
        fileFormat: isPdf ? 'pdf' : 'csv',
        fileFingerprint: await sha256Fingerprint(file),
        lines,
      });
      if (!response) throw new Error('The bank import could not be saved.');
      setImportMessage(response.status === 'duplicate'
        ? `${file.name} was already imported for this fortnight. No duplicate lines were added.`
        : `Imported ${response.import.lines.length} purchase line${response.import.lines.length === 1 ? '' : 's'} from ${file.name}.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'The bank file could not be imported.');
    }
  };
  const hasInvalidDraft = drafts.some((purchase) =>
    !purchase.category.trim()
    || !purchase.description.trim()
    || !Number.isFinite(purchase.totalPrice)
    || purchase.totalPrice < 0
    || !Number.isInteger(purchase.quantity)
    || purchase.quantity <= 0
    || purchase.allocations.some((allocation) =>
      !allocation.productType.trim()
      || (allocation.allocationQuantity === null) === (allocation.allocationPercentage === null)
      || (allocation.allocationQuantity !== null && (!Number.isInteger(allocation.allocationQuantity) || allocation.allocationQuantity <= 0 || allocation.allocationQuantity > purchase.quantity))
      || (allocation.allocationPercentage !== null && (!Number.isFinite(allocation.allocationPercentage) || allocation.allocationPercentage <= 0 || allocation.allocationPercentage > 100))
    )
    || allocationTotalPercent(purchase) > 100.000001
  );
  const performSave = async () => {
    if (!activePeriod) return;
    if (hasInvalidDraft) {
      toast({ variant: 'destructive', title: 'Check the purchase allocations', description: 'Each allocation needs a product type and a quantity or percentage. Allocations cannot exceed the purchase total.' });
      setSaveState('error');
      return;
    }
    setSaveState('saving');
    const success = await savePurchases(activePeriod.marketCycle, drafts.map(({ localId: _localId, ...purchase }) => ({
      ...purchase,
      category: purchase.category.trim(),
      description: purchase.description.trim(),
      allocations: purchase.allocations.map(({ localId: _allocationLocalId, ...allocation }) => ({
        ...allocation,
        productType: allocation.productType.trim(),
      })),
    })));
    setSaveState(success ? 'saved' : 'error');
    toast(success
      ? { title: 'Saved', description: 'Non-flower purchases saved.' }
      : { variant: 'destructive', title: 'Save failed', description: 'Your changes are still here. Try again when you’re ready.' });
  };

  return <div className="space-y-7" data-testid="section-non-flower-price-tracking">
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground"><span className="h-px w-7 bg-accent" />Business costs</div><h1 className="display-font text-4xl leading-[1.02] tracking-[-.035em] text-foreground md:text-5xl">Non-Flower Price Tracking</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">Keep packaging, stationery, and other business purchases tied to the fortnight they belong to. Split one purchase across the products it supports.</p></div><Button onClick={addPurchase} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-add-non-flower-purchase"><Plus size={15} /> Add purchase</Button></div>
    {activePeriod && <section className="paper-card rounded-lg border border-card-border p-5" data-testid="section-non-flower-bank-import">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground"><FileUp size={14} className="text-primary" /> Bank export import</div><p className="mt-2 max-w-xl text-sm text-muted-foreground">Upload the CSV or PDF export for the selected fortnight. Purchase lines are kept as imported source records, then you can break each one into detailed cost rows.</p></div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><FileUp size={15} /> Upload CSV or PDF<input type="file" accept=".csv,text/csv,.pdf,application/pdf" className="sr-only" data-testid="input-non-flower-bank-file" onChange={(event) => { void handleBankFile(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Same-file uploads are detected by file fingerprint for this fortnight. The uploaded file itself is not retained.</p>
      {importMessage && <p className="mt-3 rounded-md border border-primary/15 bg-primary/[.04] px-3 py-2 text-xs text-primary" role="status">{importMessage}</p>}
    </section>}
    <section className="paper-card rounded-lg border border-card-border p-4 md:p-5" data-testid="section-non-flower-fortnights">
      <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Fortnight view</p><p className="mt-1 text-xs text-muted-foreground">Dates follow the same Sunday market schedule as your market history.</p></div><CalendarDays size={18} className="text-muted-foreground" /></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Non-flower purchase fortnights">
        {schedulePeriods.map((period) => <button key={period.marketCycle} type="button" role="tab" aria-selected={period.marketCycle === activeCycle} onClick={() => { setActiveCycle(period.marketCycle); setSaveState('idle'); }} data-testid={`tab-non-flower-fortnight-${period.marketCycle}`} className={`min-w-[142px] rounded-md border px-3 py-2 text-left transition-colors ${period.marketCycle === activeCycle ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/10 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'}`}><span className="block font-mono text-[9px] uppercase tracking-[.12em] opacity-70">Cycle {period.marketCycle}</span><span className="mt-1 block text-xs font-semibold">{dateLabel(period.startDate)} –</span><span className="block text-xs font-semibold">{dateLabel(period.endDate)}</span></button>)}
      </div>
    </section>
     {activePeriod && importDrafts.length > 0 && <section className="paper-card overflow-hidden rounded-lg border border-card-border" data-testid="section-non-flower-imported-lines">
       <div className="border-b border-foreground/10 px-5 py-4 md:px-6"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Imported purchase lines</p><h2 className="mt-1 font-serif text-2xl">Break down each bank line</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">The bank amount stays unchanged. Add as many detailed rows as needed, then make their total equal the source amount.</p></div>
       <div className="space-y-5 p-5 md:p-6">
         {importDrafts.map((imported) => <div key={imported.id} className="rounded-md border border-primary/15 bg-primary/[.025]" data-testid={`section-non-flower-bank-import-${imported.id}`}>
           <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 px-4 py-3"><div><p className="text-sm font-semibold">{imported.fileName}</p><p className="mt-1 text-[11px] text-muted-foreground">{imported.fileFormat.toUpperCase()} · {imported.lines.length} imported line{imported.lines.length === 1 ? '' : 's'}</p></div><Button onClick={() => void saveBankDetails(imported)} disabled={savingImportId === imported.id} className="border border-primary/20 bg-background text-primary hover:bg-primary/[.05]" testId={`button-save-non-flower-bank-import-${imported.id}`}>{savingImportId === imported.id ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} {savingImportId === imported.id ? 'Saving…' : 'Save breakdown'}</Button></div>
           <div className="divide-y divide-foreground/10">
             {imported.lines.map((line) => {
               const detailsTotal = line.details.reduce((sum, detail) => sum + (Number.isFinite(detail.totalPrice) ? detail.totalPrice : 0), 0);
               const difference = line.amount - detailsTotal;
               const reconciled = Math.abs(difference) <= 0.005;
               return <div key={line.id} className="p-4" data-testid={`row-non-flower-bank-line-${line.id}`}>
                 <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><p className="text-sm font-semibold">{line.merchant}</p><p className="mt-1 text-xs text-muted-foreground">{line.description}{line.transactionDate ? ` · ${dateLabel(line.transactionDate)}` : ''}{line.reference ? ` · ${line.reference}` : ''}</p></div><div className="text-left sm:text-right"><p className="font-mono text-sm font-semibold">{unitMoney(line.amount)}</p><p className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${reconciled ? 'text-primary' : 'text-destructive'}`} data-testid={`status-non-flower-bank-line-${line.id}`}>{reconciled ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {reconciled ? 'Reconciled' : `${difference > 0 ? unitMoney(difference) : unitMoney(Math.abs(difference))} ${difference > 0 ? 'still to allocate' : 'over allocated'}`}</p></div></div>
                 <div className="mt-3 hidden grid-cols-[.85fr_1.25fr_.8fr_.55fr_.75fr_32px] gap-2 px-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground sm:grid"><span>Category</span><span>Description</span><span>Total price</span><span>Qty</span><span>Unit price</span><span /></div>
                 <div className="mt-2 space-y-2">
                   {line.details.map((detail) => <div key={detail.localId} className="grid gap-2 sm:grid-cols-[.85fr_1.25fr_.8fr_.55fr_.75fr_32px] sm:items-center" data-testid={`row-non-flower-bank-detail-${detail.localId}`}>
                     <input aria-label="Imported detail category" list="non-flower-category-options" value={detail.category} onChange={(event) => updateBankDetail(imported.id, line.id, detail.localId, { category: event.target.value })} placeholder="Packaging" className="rounded-md border border-foreground/10 bg-background px-2.5 py-2 text-sm outline-none focus:border-primary" />
                     <input aria-label="Imported detail description" value={detail.description} onChange={(event) => updateBankDetail(imported.id, line.id, detail.localId, { description: event.target.value })} placeholder="e.g. tissue paper" className="rounded-md border border-foreground/10 bg-background px-2.5 py-2 text-sm outline-none focus:border-primary" />
                     <input aria-label="Imported detail total price" type="number" min="0" step="0.01" value={detail.totalPrice} onChange={(event) => updateBankDetail(imported.id, line.id, detail.localId, { totalPrice: Number(event.target.value) })} className="rounded-md border border-foreground/10 bg-background px-2.5 py-2 text-sm outline-none focus:border-primary" />
                     <input aria-label="Imported detail quantity" type="number" min="1" step="1" value={detail.quantity} onChange={(event) => updateBankDetail(imported.id, line.id, detail.localId, { quantity: Number(event.target.value) })} className="rounded-md border border-foreground/10 bg-background px-2.5 py-2 text-sm outline-none focus:border-primary" />
                     <span className="rounded-md bg-muted/60 px-2.5 py-2 font-mono text-xs text-muted-foreground">{unitMoney(detail.quantity > 0 ? detail.totalPrice / detail.quantity : 0)}</span>
                     <Button onClick={() => removeBankDetail(imported.id, line.id, detail.localId)} className="h-8 w-8 rounded-full border border-foreground/10 bg-background p-0 text-muted-foreground hover:border-destructive/30 hover:text-destructive" testId={`button-delete-non-flower-bank-detail-${detail.localId}`}><Trash2 size={14} /></Button>
                   </div>)}
                 </div>
                 <button type="button" onClick={() => addBankDetail(imported.id, line.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4" data-testid={`button-add-non-flower-bank-detail-${line.id}`}><Plus size={13} /> Add detail row</button>
               </div>;
             })}
           </div>
         </div>)}
       </div>
     </section>}
    {activePeriod && <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="paper-card overflow-hidden rounded-lg border border-card-border">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/10 px-5 py-4 md:px-6"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Cycle {activePeriod.marketCycle} · {dateLabel(activePeriod.startDate)} – {dateLabel(activePeriod.endDate)}</p><h2 className="mt-1 font-serif text-2xl">Purchase lines</h2></div><span className="text-xs text-muted-foreground">{drafts.length} line{drafts.length === 1 ? '' : 's'}</span></div>
        <div className="hidden grid-cols-[.8fr_1.2fr_.75fr_.65fr_.75fr_36px] gap-3 border-b border-foreground/10 bg-muted/55 px-5 py-3 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground lg:grid"><span>Category</span><span>Description</span><span>Total price</span><span>Qty</span><span>Cost / piece</span><span /></div>
        {drafts.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground"><ReceiptText size={22} className="mx-auto mb-3 opacity-50" /><p>No non-flower purchases in this fortnight.</p><button type="button" onClick={addPurchase} className="mt-2 text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4">Add the first line</button></div>}
        {drafts.map((purchase) => {
          const costPerPiece = calculateNonFlowerCostPerPiece(purchase.totalPrice, purchase.quantity);
          const allocatedPercent = allocationTotalPercent(purchase);
          return <div key={purchase.localId} data-testid={`row-non-flower-purchase-${purchase.localId}`} className="border-b border-foreground/10 px-5 py-4 last:border-0">
            <div className="grid gap-3 lg:grid-cols-[.8fr_1.2fr_.75fr_.65fr_.75fr_36px] lg:items-center">
              <label className="text-xs lg:sr-only" htmlFor={`non-flower-category-${purchase.localId}`}>Category</label><input id={`non-flower-category-${purchase.localId}`} list="non-flower-category-options" value={purchase.category} onChange={(event) => updatePurchase(purchase.localId, { category: event.target.value })} placeholder="Packaging" data-testid={`input-non-flower-category-${purchase.localId}`} className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <label className="text-xs lg:sr-only" htmlFor={`non-flower-description-${purchase.localId}`}>Description</label><input id={`non-flower-description-${purchase.localId}`} value={purchase.description} onChange={(event) => updatePurchase(purchase.localId, { description: event.target.value })} placeholder="e.g. tissue paper" data-testid={`input-non-flower-description-${purchase.localId}`} className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <label className="text-xs lg:sr-only" htmlFor={`non-flower-total-${purchase.localId}`}>Total price</label><input id={`non-flower-total-${purchase.localId}`} type="number" min="0" step="0.01" value={purchase.totalPrice} onChange={(event) => updatePurchase(purchase.localId, { totalPrice: Number(event.target.value) })} data-testid={`input-non-flower-total-${purchase.localId}`} className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <label className="text-xs lg:sr-only" htmlFor={`non-flower-quantity-${purchase.localId}`}>Quantity</label><input id={`non-flower-quantity-${purchase.localId}`} type="number" min="1" step="1" value={purchase.quantity} onChange={(event) => updatePurchase(purchase.localId, { quantity: Number(event.target.value) })} data-testid={`input-non-flower-quantity-${purchase.localId}`} className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <div className="rounded-md bg-muted/60 px-3 py-2 font-mono text-sm" data-testid={`text-non-flower-cost-per-piece-${purchase.localId}`}>{unitMoney(costPerPiece)}</div>
              <Button onClick={() => removePurchase(purchase.localId)} className="h-9 w-9 rounded-full border border-foreground/10 bg-background p-0 text-muted-foreground hover:border-destructive/30 hover:text-destructive" testId={`button-delete-non-flower-purchase-${purchase.localId}`}><Trash2 size={15} /></Button>
            </div>
            <div className="mt-4 rounded-md border border-primary/10 bg-primary/[.035] p-3" data-testid={`section-non-flower-allocations-${purchase.localId}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-primary/70">Product allocations</p><p className="mt-1 text-[11px] text-muted-foreground">{allocatedPercent.toFixed(1)}% allocated · remainder stays unallocated</p></div><button type="button" onClick={() => addAllocation(purchase.localId)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4" data-testid={`button-add-non-flower-allocation-${purchase.localId}`}><Plus size={13} /> Add allocation</button></div>
              {purchase.allocations.length === 0 && <p className="mt-3 text-xs text-muted-foreground">No product allocation yet. Add one to attribute this cost to a bouquet, bookmark, or another product.</p>}
              <div className="mt-3 space-y-2">
                {purchase.allocations.map((allocation) => {
                  const basis = allocation.allocationQuantity !== null ? 'quantity' : 'percentage';
                  const allocationCost = calculateNonFlowerAllocationCost(purchase.totalPrice, purchase.quantity, allocation.allocationQuantity, allocation.allocationPercentage);
                  return <div key={allocation.localId} className="grid gap-2 sm:grid-cols-[.75fr_1.2fr_.8fr_1fr_auto] sm:items-center" data-testid={`row-non-flower-allocation-${allocation.localId}`}>
                    <select aria-label="Allocation basis" value={basis} onChange={(event) => updateAllocation(purchase.localId, allocation.localId, event.target.value === 'quantity' ? { allocationQuantity: 1, allocationPercentage: null } : { allocationQuantity: null, allocationPercentage: 100 })} data-testid={`select-non-flower-allocation-basis-${allocation.localId}`} className="rounded-md border border-foreground/10 bg-background px-2 py-2 text-sm outline-none focus:border-primary"><option value="quantity">Quantity</option><option value="percentage">Percentage</option></select>
                    <input aria-label="Allocation product type" value={allocation.productType} onChange={(event) => updateAllocation(purchase.localId, allocation.localId, { productType: event.target.value })} placeholder="e.g. Bouquet" list="non-flower-product-options" data-testid={`input-non-flower-allocation-product-${allocation.localId}`} className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input aria-label={basis === 'quantity' ? 'Allocated quantity' : 'Allocated percentage'} type="number" min={basis === 'quantity' ? 1 : 0.01} max={basis === 'quantity' ? purchase.quantity : 100} step={basis === 'quantity' ? 1 : 0.1} value={basis === 'quantity' ? allocation.allocationQuantity ?? '' : allocation.allocationPercentage ?? ''} onChange={(event) => basis === 'quantity' ? updateAllocation(purchase.localId, allocation.localId, { allocationQuantity: Number(event.target.value), allocationPercentage: null }) : updateAllocation(purchase.localId, allocation.localId, { allocationQuantity: null, allocationPercentage: Number(event.target.value) })} data-testid={`input-non-flower-allocation-value-${allocation.localId}`} className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                    <span className="font-mono text-xs text-muted-foreground">{unitMoney(allocationCost)} allocated</span>
                    <Button onClick={() => removeAllocation(purchase.localId, allocation.localId)} className="h-8 w-8 rounded-full border border-foreground/10 bg-background p-0 text-muted-foreground hover:border-destructive/30 hover:text-destructive" testId={`button-delete-non-flower-allocation-${allocation.localId}`}><Trash2 size={14} /></Button>
                  </div>;
                })}
              </div>
            </div>
          </div>;
        })}
        <datalist id="non-flower-category-options"><option value="Packaging" /><option value="Stationery" /><option value="Display" /><option value="Equipment" /><option value="Fees" /></datalist>
        <datalist id="non-flower-product-options"><option value="Bouquet" /><option value="Bookmark" /><option value="Card" /><option value="Wrapping" /><option value="General" /></datalist>
        <div className="flex flex-col gap-3 border-t border-foreground/10 px-5 py-4 md:flex-row md:items-center md:justify-between"><span className="text-xs text-muted-foreground">Cost per piece recalculates from the current total price and quantity.</span><Button onClick={() => void performSave()} disabled={saveState === 'saving'} className="bg-primary text-primary-foreground hover:bg-primary/90" testId="button-save-non-flower-purchases">{saveState === 'saving' ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {saveState === 'saving' ? 'Saving…' : 'Save fortnight'}</Button></div>
        {saveState === 'error' && <p className="px-5 pb-5 text-xs text-destructive" role="alert">Your changes are still here. Check the rows or try saving again.</p>}
        {saveState === 'saved' && <p className="flex items-center gap-2 px-5 pb-5 text-xs text-primary" role="status"><CheckCircle2 size={14} /> Non-flower purchases saved.</p>}
      </div>
      <aside className="space-y-3">
        <div className="rounded-lg border border-primary/15 bg-[#e8e4cd] p-5"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><DollarSign size={13} /> Fortnight total</div><p className="mt-3 font-serif text-3xl text-primary" data-testid="text-non-flower-total">{money(totalSpend)}</p><p className="mt-1 text-xs leading-relaxed text-primary/65">All manually entered non-flower purchases in this market window.</p></div>
        <div className="paper-card rounded-lg border border-card-border p-5"><div className="flex items-center gap-2 font-serif text-lg"><Tag size={17} className="text-muted-foreground" /> Allocated by product</div>{Object.keys(allocatedSpend).length === 0 ? <p className="mt-4 text-xs text-muted-foreground">Add an allocation to see product totals.</p> : <div className="mt-4 space-y-3">{Object.entries(allocatedSpend).sort(([a], [b]) => a.localeCompare(b)).map(([product, total]) => <div key={product} className="flex items-center justify-between gap-3 text-sm"><span className={product === 'Unallocated' ? 'text-muted-foreground' : 'font-semibold'}>{product}</span><span className="font-mono text-xs" data-testid={`text-non-flower-product-total-${product.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{unitMoney(total)}</span></div>)}</div>}</div>
      </aside>
    </section>}
  </div>;
}