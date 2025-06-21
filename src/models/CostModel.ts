export const DEFAULT_BROKERAGE = 0.001425;
export const DEFAULT_TAX = 0.003;
export const DEFAULT_SLIPPAGE = 0.0015;

export class CostModel {
  constructor(
    public brokerage: number = DEFAULT_BROKERAGE,
    public tax: number = DEFAULT_TAX,
    public slippage: number = DEFAULT_SLIPPAGE
  ) {}

  buy(price: number): number {
    return price * (1 + this.slippage) * (1 + this.brokerage);
  }

  sell(price: number): number {
    return price * (1 - this.slippage) * (1 - this.brokerage - this.tax);
  }
}
