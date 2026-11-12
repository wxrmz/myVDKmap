// Minimal types needed by lib/fixtures; task 2 extends this file (DTO + dictionaries §3.2).
export interface BillItem {
  name: string;
  amount: number;
  unit?: string;
  volume?: number;
  tariff?: number;
}
