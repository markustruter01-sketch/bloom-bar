export function calculateNonFlowerCostPerPiece(totalPrice: number, quantity: number): number {
  return quantity > 0 ? totalPrice / quantity : 0;
}