export function calculateNonFlowerCostPerPiece(totalPrice: number, quantity: number): number {
  return quantity > 0 ? totalPrice / quantity : 0;
}

export function calculateNonFlowerAllocationPercentage(
  purchaseQuantity: number,
  allocationQuantity: number | null,
  allocationPercentage: number | null,
): number {
  if (allocationQuantity !== null && purchaseQuantity > 0) {
    return (allocationQuantity / purchaseQuantity) * 100;
  }
  return allocationPercentage ?? 0;
}

export function calculateNonFlowerAllocationCost(
  totalPrice: number,
  purchaseQuantity: number,
  allocationQuantity: number | null,
  allocationPercentage: number | null,
): number {
  return totalPrice * calculateNonFlowerAllocationPercentage(purchaseQuantity, allocationQuantity, allocationPercentage) / 100;
}