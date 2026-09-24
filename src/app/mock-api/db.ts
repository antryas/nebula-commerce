import { createSeed, MockData } from './seed';

/** In-memory database backing the mock API. */
export class MockDb {
  data: MockData;
  private readonly initial: MockData;
  private lastOrderNumber = 0;

  constructor(data: MockData = createSeed()) {
    this.initial = structuredClone(data);
    this.data = structuredClone(data);
    this.syncOrderNumber();
  }

  /** Restores the database to the state it was constructed with. */
  reset(): void {
    this.data = structuredClone(this.initial);
    this.syncOrderNumber();
  }

  /** Returns a new unique order number, higher than any existing one. */
  nextOrderNumber(): number {
    this.lastOrderNumber += 1;
    return this.lastOrderNumber;
  }

  private syncOrderNumber(): void {
    this.lastOrderNumber = this.data.orders.reduce((max, o) => Math.max(max, o.number), 1000);
  }
}

export const mockDb = new MockDb();
