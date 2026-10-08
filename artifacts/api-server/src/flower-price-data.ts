type ReceiptFlowerPriceValues = {
  flowerType: string;
  varietyOrigin: string | null;
};

export type ReceiptGstValues = {
  lineTotal: number | null;
  printedLineTotal: number | null;
  taxBasis: "inclusive" | "exclusive" | "unknown";
  gstInclusiveLineTotal?: number | null;
  gstEstimated?: boolean;
};

function normalizeFlowerLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-AU");
}

export function canonicalFlowerName({ flowerType, varietyOrigin }: ReceiptFlowerPriceValues): string {
  const type = normalizeFlowerLabel(flowerType);
  const variety = normalizeFlowerLabel(varietyOrigin ?? "");

  if (
    type === "disbud chrysanthemum"
    || type === "chrysanthemum (disbud)"
    || type === "chrysanthemum disbud"
    || (type === "chrysanthemum" && /\bdisbud\b/.test(variety))
  ) {
    return "Disbud chrysanthemum";
  }
  if (type === "snapdragon") return "Snapdragon";
  if (type === "emile" || type === "lisianthus") return "Lisianthus";
  if (
    type === "eucalyptus"
    || type === "eucalyptus foliage"
    || type === "gum cinerea"
    || (type === "gum" && /\bcinerea\b/.test(variety))
  ) {
    return "Eucalyptus";
  }

  return flowerType.trim();
}

export function receiptGstValues(line: ReceiptGstValues): {
  gstInclusiveLineTotal: number | null;
  gstEstimated: boolean;
} {
  if (line.gstInclusiveLineTotal != null) {
    return {
      gstInclusiveLineTotal: line.gstInclusiveLineTotal,
      gstEstimated: line.gstEstimated ?? false,
    };
  }
  if (line.lineTotal != null) {
    return { gstInclusiveLineTotal: line.lineTotal, gstEstimated: false };
  }
  if (line.printedLineTotal == null) {
    return { gstInclusiveLineTotal: null, gstEstimated: false };
  }
  if (line.taxBasis === "inclusive") {
    return { gstInclusiveLineTotal: line.printedLineTotal, gstEstimated: false };
  }
  if (line.taxBasis === "exclusive") {
    return {
      gstInclusiveLineTotal: Math.round((line.printedLineTotal * 1.1 + Number.EPSILON) * 100) / 100,
      gstEstimated: true,
    };
  }
  return { gstInclusiveLineTotal: null, gstEstimated: false };
}

export function costPerStem(gstInclusiveLineTotal: number | null, stemCount: number | null): number | null {
  if (gstInclusiveLineTotal == null || stemCount == null || stemCount <= 0) return null;
  return gstInclusiveLineTotal / stemCount;
}
