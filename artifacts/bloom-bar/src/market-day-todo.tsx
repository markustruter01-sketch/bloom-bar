import { useEffect, useState } from "react";
import { Check, CheckCircle2, ClipboardList, LoaderCircle, Plus, Trash2 } from "lucide-react";
import type { MarketDayTodoPeriod } from "@workspace/api-client-react";

type MarketDayTodoInput = {
  description: string;
  completed: boolean;
  position: number;
};

export function MarketDayTodoPage({
  periods,
  nextMarketCycle,
  saveTodos,
}: {
  periods: MarketDayTodoPeriod[];
  nextMarketCycle: number;
  saveTodos: (cycle: number, items: MarketDayTodoInput[]) => Promise<boolean>;
}) {
  const period = periods.find((candidate) => candidate.marketCycle === nextMarketCycle)
    ?? periods.at(-1)
    ?? null;
  const cycle = period?.marketCycle ?? nextMarketCycle;
  const [items, setItems] = useState<MarketDayTodoInput[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    setItems(period?.items.map(({ description, completed, position }) => ({ description, completed, position })) ?? []);
  }, [period?.marketCycle, period?.items]);

  const persist = async (nextItems: MarketDayTodoInput[]) => {
    setItems(nextItems);
    setSaving(true);
    setSaveError(false);
    const saved = await saveTodos(cycle, nextItems);
    setSaving(false);
    setSaveError(!saved);
  };

  const addItem = () => {
    const description = newItem.trim();
    if (!description) return;
    setNewItem("");
    void persist([...items, { description, completed: false, position: items.length }]);
  };

  const updateItem = (index: number, update: Partial<MarketDayTodoInput>) => {
    void persist(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item));
  };

  const removeItem = (index: number) => {
    void persist(items.filter((_, itemIndex) => itemIndex !== index).map((item, position) => ({ ...item, position })));
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground"><span className="h-px w-7 bg-accent" />Next market / setup</div>
          <h1 className="display-font text-4xl leading-[1.02] tracking-[-.035em] text-foreground md:text-5xl">Market Day To Do.</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">A practical list for the morning, carried forward from the last market without changing its record.</p>
        </div>
        <div className="rounded-md bg-[#dce3c2] px-4 py-3 text-center">
          <div className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">Next market</div>
          <div className="text-sm font-semibold text-primary">{period?.endDate ?? "Preparing"}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-card-border bg-card p-5 md:p-6" data-testid="market-day-todo-list">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-serif text-2xl"><ClipboardList size={20} className="text-primary" /> Before the gates open</div>
              <p className="mt-1 text-xs text-muted-foreground">{items.filter((item) => !item.completed).length} remaining · {items.length} total</p>
            </div>
            {saving && <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status"><LoaderCircle size={13} className="animate-spin" /> Saving…</span>}
          </div>

          <div className="mb-5 flex gap-2">
            <input
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") addItem(); }}
              placeholder="Add a market-day task"
              aria-label="New Market Day To Do item"
              data-testid="input-market-day-todo"
              className="min-w-0 flex-1 rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary"
              maxLength={240}
            />
            <button type="button" onClick={addItem} disabled={!newItem.trim() || saving} data-testid="button-add-market-day-todo" className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"><Plus size={15} /> Add</button>
          </div>

          {items.length ? <div className="divide-y divide-foreground/10 rounded-md border border-foreground/10">
            {items.map((item, index) => <div key={`${item.description}-${index}`} className="flex items-center gap-3 p-3.5" data-testid={`market-day-todo-item-${index}`}>
              <button type="button" onClick={() => updateItem(index, { completed: !item.completed })} aria-label={item.completed ? `Mark ${item.description} incomplete` : `Mark ${item.description} complete`} data-testid={`button-toggle-market-day-todo-${index}`} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${item.completed ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25 bg-background text-transparent hover:border-primary"}`}>{item.completed && <Check size={13} />}</button>
              <span className={`min-w-0 flex-1 text-sm ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.description}</span>
              <button type="button" onClick={() => removeItem(index)} disabled={saving} aria-label={`Remove ${item.description}`} data-testid={`button-remove-market-day-todo-${index}`} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-45"><Trash2 size={15} /></button>
            </div>)}
          </div> : <div className="rounded-md border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">Your list is empty. Add the first task for market morning.</div>}

          {saveError && <p className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive" role="alert">Your changes are still visible, but we couldn’t save them. Try the action again.</p>}
        </section>

        <aside className="h-fit space-y-3">
          <div className="rounded-lg border border-primary/10 bg-[#e8e4cd] p-5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-primary"><CheckCircle2 size={13} /> Carry-forward guide</div>
            <p className="mt-4 font-serif text-xl leading-snug text-primary">Keep the useful parts.<br />Start fresh on the day.</p>
            <p className="mt-3 text-xs leading-relaxed text-primary/65">When you close a market, its current list is copied into the next market as unchecked starting tasks. The closed market keeps its own snapshot.</p>
          </div>
          <div className="paper-card rounded-lg border border-card-border bg-card p-5">
            <div className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">List status</div>
            <p className="mt-2 text-sm font-semibold">{period?.closed ? "Closed market record" : "Open for setup"}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cycle {cycle} · {period?.closedSnapshot ? "A close snapshot is preserved." : "This list will be captured when the market closes."}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}