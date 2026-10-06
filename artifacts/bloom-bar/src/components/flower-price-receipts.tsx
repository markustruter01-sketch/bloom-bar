import type { FlowerPriceReceipt } from "@workspace/api-client-react";

function currency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function receiptDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function FlowerPriceReceiptsSection({
  receipts,
  isLoading,
  isError,
}: {
  receipts: FlowerPriceReceipt[];
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <section className="mt-8 space-y-4" data-testid="flower-price-receipts">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Receipt history</p>
        <h2 className="mt-1 font-serif text-2xl">Line items from older purchases.</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Receipt line items stay separate from calculated per-stem averages. Stem sizes and GST-inclusive line totals are shown only when verified by the receipt.
        </p>
      </div>
      {isLoading ? (
        <p className="rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground" role="status">
          Loading receipt history…
        </p>
      ) : isError ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive" role="alert">
          Receipt history could not be loaded. Refresh the page to try again.
        </p>
      ) : receipts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/15 bg-card p-6 text-sm text-muted-foreground">
          No scanned receipt line items have been added yet.
        </div>
      ) : (
        <div className="space-y-4">
          {receipts.map((receipt) => (
            <article
              key={receipt.id}
              className="overflow-hidden rounded-lg border border-card-border bg-card"
              data-testid={`receipt-${receipt.id}`}
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground/10 px-4 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg">{receipt.supplier}</h3>
                    <span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[.08em] ${
                      receipt.reviewStatus === "needs-review"
                        ? "bg-[#f1d0c3] text-[#8c4f42]"
                        : "bg-[#dce3c2] text-primary"
                    }`}>
                      {receipt.reviewStatus === "needs-review" ? "Needs review" : "Checked"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {receiptDate(receipt.purchaseDate)} · Receipt {receipt.receiptNumber || "number unclear"}
                  </p>
                  {receipt.reviewNote && (
                    <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#8c4f42]">{receipt.reviewNote}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="block font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">Receipt total</span>
                  <span className="font-mono text-lg text-primary">{currency(receipt.receiptTotal)}</span>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                  <thead className="bg-muted/50 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Flower</th>
                      <th className="px-3 py-2">Variety / origin</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit price</th>
                      <th className="px-3 py-2 text-right">Printed line</th>
                      <th className="px-3 py-2 text-right">GST-incl. paid</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.lines.map((line) => (
                      <tr key={line.id} className="border-t border-foreground/10 align-top">
                        <td className="px-3 py-2 font-medium">{line.flowerType}</td>
                        <td className="px-3 py-2 text-muted-foreground">{line.varietyOrigin || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{line.sizeText || "Not stated"}</td>
                        <td className="px-3 py-2 text-right font-mono">{line.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {line.unitPrice === null ? "—" : currency(line.unitPrice)}
                          {line.taxBasis === "exclusive" && <span className="ml-1 text-muted-foreground">ex GST</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {line.printedLineTotal === null ? "—" : currency(line.printedLineTotal)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {line.lineTotal === null ? "Needs review" : currency(line.lineTotal)}
                        </td>
                        <td className="px-3 py-2">
                          {line.reviewStatus === "needs-review" ? (
                            <span className="text-[#8c4f42]" title={line.reviewNote ?? undefined}>Needs review</span>
                          ) : (
                            <span className="text-primary">Checked</span>
                          )}
                          {line.reviewNote && <p className="mt-1 max-w-52 text-[10px] leading-relaxed text-muted-foreground">{line.reviewNote}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
