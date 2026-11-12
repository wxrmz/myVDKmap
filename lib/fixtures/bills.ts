// Sample utility bills of building fregat-2-1 (54,2 м², two residents, meters installed).
// Tariffs are the real Vladivostok tariffs for residents: before and after the indexation on 1 October 2026
// (Приморский водоканал, ДГК, ДЭК, «Приморский экологический оператор»; source: vladivostok1.ru, 01.10.2026).
// Volumes are those of a typical household. Used by prisma/seed.ts and by the mock AI provider.
import type { BillItem } from "@/lib/types";

export const DEMO_BUILDING_ID = "fregat-2-1";
export const DEMO_APARTMENT_AREA = 54.2;

/** ₽ per unit: [until 30.09.2026, from 01.10.2026]. */
export const TARIFFS = {
  heating: { unit: "Гкал", old: 3186.41, new: 3348.92 },
  hotWater: { unit: "м³", old: 252.4, new: 269.45 },
  coldWater: { unit: "м³", old: 46.87, new: 53.44 },
  sewerage: { unit: "м³", old: 35.76, new: 41.68 },
  electricity: { unit: "кВт·ч", old: 4.65, new: 5.17 },
  waste: { unit: "м³", old: 629.38, new: 661.48 },
} as const;

const r2 = (n: number) => Math.round(n * 100) / 100;
const fixed = (name: string, amount: number): BillItem => ({ name, amount });
const metered = (name: string, t: keyof typeof TARIFFS, volume: number, period: string): BillItem => {
  const tariff = period >= "2026-10" ? TARIFFS[t].new : TARIFFS[t].old;
  return { name, amount: r2(volume * tariff), unit: TARIFFS[t].unit, volume, tariff };
};

function bill(period: string, use: { heat: number; hot: number; cold: number; kwh: number }) {
  const items: BillItem[] = [
    fixed("Содержание жилого помещения", r2(38.5 * DEMO_APARTMENT_AREA)),
    fixed("Взнос на капитальный ремонт", r2(14 * DEMO_APARTMENT_AREA)),
    ...(use.heat > 0 ? [metered("Отопление", "heating", use.heat, period)] : []),
    metered("Горячее водоснабжение", "hotWater", use.hot, period),
    metered("Холодное водоснабжение", "coldWater", use.cold, period),
    metered("Водоотведение", "sewerage", r2(use.hot + use.cold), period),
    metered("Электроэнергия ОДН", "electricity", use.kwh, period),
    metered("Обращение с ТКО", "waste", 0.34, period),
    fixed("Домофон", 60),
  ];
  const total = r2(items.reduce((s, i) => s + i.amount, 0));
  return { id: `bill-${DEMO_BUILDING_ID}-${period}`, buildingId: DEMO_BUILDING_ID, period, items, total };
}

// Heating season 2026/27 started in October, so October has heating for part of the month.
export const DEMO_BILLS = [
  bill("2026-08", { heat: 0, hot: 3.6, cold: 6.2, kwh: 16 }),
  bill("2026-09", { heat: 0, hot: 3.5, cold: 6, kwh: 17 }),
  bill("2026-10", { heat: 0.9, hot: 3.5, cold: 6, kwh: 18 }),
  bill("2026-11", { heat: 1.65, hot: 3.6, cold: 6.1, kwh: 20 }),
];


/** Plain-language names and explanations for bill lines. */
export const BILL_ITEM_GLOSSARY: Record<string, { plainName: string; explanation: string }> = {
  "Содержание жилого помещения": {
    plainName: "Обслуживание дома",
    explanation: "Работа управляющей компании: уборка подъездов и двора, мелкий ремонт, аварийная служба. Считается от площади квартиры.",
  },
  "Взнос на капитальный ремонт": {
    plainName: "Копилка на капремонт",
    explanation: "Деньги откладываются на крупный ремонт дома: крыша, фасад, лифты, трубы. Считается от площади квартиры и не зависит от сезона.",
  },
  Отопление: {
    plainName: "Отопление",
    explanation: "Тепло для батарей, начисляется в отопительный сезон. Зависит от погоды и общедомового счётчика тепла. С 1 октября 2026 — 3348,92 ₽ за Гкал (было 3186,41).",
  },
  "Горячее водоснабжение": {
    plainName: "Горячая вода",
    explanation: "Горячая вода по показаниям квартирного счётчика. Во Владивостоке с 1 октября 2026 — 269,45 ₽ за м³ (было 252,40).",
  },
  "Холодное водоснабжение": {
    plainName: "Холодная вода",
    explanation: "Холодная вода по показаниям квартирного счётчика. С 1 октября 2026 — 53,44 ₽ за м³ (было 46,87).",
  },
  Водоотведение: {
    plainName: "Канализация",
    explanation: "Отвод использованной воды. Считается как сумма холодной и горячей воды. С 1 октября 2026 — 41,68 ₽ за м³ (было 35,76).",
  },
  "Электроэнергия ОДН": {
    plainName: "Свет в подъезде и лифт",
    explanation: "Ваша доля за электричество на общие нужды дома: освещение подъездов, лифты, насосы. С 1 октября 2026 — 5,17 ₽ за кВт·ч (было 4,65).",
  },
  "Обращение с ТКО": {
    plainName: "Вывоз мусора",
    explanation: "Вывоз и утилизация бытовых отходов по нормативу на жильца. С 1 октября 2026 — 661,48 ₽ за м³ (было 629,38).",
  },
  Домофон: {
    plainName: "Домофон",
    explanation: "Обслуживание домофона на подъезде. Фиксированная сумма в месяц.",
  },
};

const MONTHS_RU: Record<string, string> = {
  "01": "январь", "02": "февраль", "03": "март", "04": "апрель", "05": "май", "06": "июнь",
  "07": "июль", "08": "август", "09": "сентябрь", "10": "октябрь", "11": "ноябрь", "12": "декабрь",
};

export const periodLabel = (period: string) => `${MONTHS_RU[period.slice(5, 7)] ?? period.slice(5, 7)} ${period.slice(0, 4)}`;

const money = (n: number) => n.toFixed(2).replace(".", ",");

/** Receipt as plain text — what OCR of the demo receipt would return. */
export function demoBillText(bill: { period: string; items: readonly BillItem[]; total: number }): string {
  const lines = bill.items.map((i) =>
    i.volume !== undefined && i.tariff !== undefined
      ? `${i.name} | ${i.volume} ${i.unit} × ${money(i.tariff)} | ${money(i.amount)}`
      : `${i.name} | | ${money(i.amount)}`,
  );
  return [
    "ЕДИНЫЙ ПЛАТЁЖНЫЙ ДОКУМЕНТ",
    `Расчётный период: ${periodLabel(bill.period)}`,
    "Адрес: г. Владивосток, ул. Нейбута, д. ***, кв. ***",
    `Площадь: ${String(DEMO_APARTMENT_AREA).replace(".", ",")} м²`,
    "Услуга | Объём × тариф | Начислено, ₽",
    ...lines,
    `ИТОГО К ОПЛАТЕ: ${money(bill.total)}`,
  ].join("\n");
}

export const DEMO_BILL_TEXTS: Record<string, string> = Object.fromEntries(
  DEMO_BILLS.map((b) => [b.period, demoBillText(b)]),
);
