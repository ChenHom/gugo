export const DEFAULT_BROKERAGE = 0.001425;
export const DEFAULT_TAX = 0.003;
export const DEFAULT_SLIPPAGE = 0.0015;

export class CostModel {
  constructor(
    public brokerage: number = DEFAULT_BROKERAGE,
    public tax: number = DEFAULT_TAX,
    public slippage: number = DEFAULT_SLIPPAGE
  ) {}

  apply(value: number, side: 'buy' | 'sell'): number {
    if (side === 'buy') {
      return value * (1 + this.slippage) * (1 + this.brokerage);
    }
    return value * (1 - this.slippage) * (1 - this.brokerage - this.tax);
  }

  buy(price: number): number {
    return this.apply(price, 'buy');
  }

  sell(price: number): number {
    return this.apply(price, 'sell');
  }
}
