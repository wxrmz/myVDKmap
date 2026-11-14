// Shared dictionaries (§3.2) and DTOs returned by lib/queries.ts: dates are ISO strings, JSON columns are parsed.

export interface BillItem {
  name: string;
  amount: number;
  unit?: string;
  volume?: number;
  tariff?: number;
}

export const ISSUE_CATEGORIES = [
  "road",
  "lighting",
  "entrance",
  "flooding",
  "garbage",
  "elevator",
  "roof",
  "yard",
  "water",
  "noise",
  "other",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  road: "Дорога",
  lighting: "Освещение",
  entrance: "Подъезд",
  flooding: "Подтопление",
  garbage: "Мусор",
  elevator: "Лифт",
  roof: "Крыша",
  yard: "Двор",
  water: "Вода",
  noise: "Шум",
  other: "Другое",
};

/** What the resident says it is: an emergency, an ordinary appeal, or something else. */
export const ISSUE_KINDS = ["accident", "appeal", "other"] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];
export const ISSUE_KIND_LABELS: Record<IssueKind, string> = { accident: "Авария", appeal: "Обращение", other: "Прочее" };

/** Separate receipts a flat gets: each one is read and kept on its own. */
export const BILL_KINDS = ["housing", "capital", "power", "other"] as const;
export type BillKind = (typeof BILL_KINDS)[number];
export const BILL_KIND_LABELS: Record<BillKind, string> = {
  housing: "Коммуналка",
  capital: "Капремонт",
  power: "Электроэнергия",
  other: "Другая",
};

export type IssueStatus = "new" | "sent" | "in_progress" | "resolved";
export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  new: "Новая",
  sent: "Отправлена",
  in_progress: "В работе",
  resolved: "Решена",
};

export const WORK_KINDS = ["road", "improvement", "utility_outage", "cap_repair", "construction", "other"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];
export const WORK_KIND_LABELS: Record<WorkKind, string> = {
  road: "Ремонт дороги",
  improvement: "Благоустройство",
  utility_outage: "Отключение",
  cap_repair: "Капремонт",
  construction: "Стройка",
  other: "Другое",
};

export type Severity = 1 | 2 | 3;

interface DistrictDTO {
  id: string;
  name: string;
  population: number;
  populationYear: number;
  color: string;
}

interface MicrodistrictDTO {
  id: string;
  name: string;
  districtId: string;
  lat: number;
  lng: number;
}

interface ComplexDTO {
  id: string;
  name: string;
  developer: string | null;
  street: string | null;
  status: string;
  floors: string | null;
  note: string | null;
  microdistrictId: string;
  lat: number;
  lng: number;
}

interface ManagementCompanyDTO {
  id: string;
  name: string;
  rating: number;
  avgResponseDays: number;
  isDemo: boolean;
}

interface BuildingDTO {
  id: string;
  address: string;
  lat: number;
  lng: number;
  floors: number | null;
  yearBuilt: number | null;
  wallMaterial: string | null;
  apartments: number | null;
  complexId: string | null;
  microdistrictId: string;
  managementCompanyId: string | null;
  lastCapRepairYear: number | null;
  nextCapRepair: number | null;
  isDemo: boolean;
  complex?: Pick<ComplexDTO, "id" | "name"> | null;
  microdistrict?: Pick<MicrodistrictDTO, "id" | "name">;
  district?: Pick<DistrictDTO, "id" | "name" | "color">;
  managementCompany?: ManagementCompanyDTO | null;
}

export interface IssueDTO {
  id: string;
  buildingId: string | null;
  lat: number;
  lng: number;
  kind: IssueKind;
  category: IssueCategory;
  title: string;
  description: string;
  photoUrl: string | null;
  authorityId: string;
  appealText: string;
  status: IssueStatus;
  severity: Severity;
  supports: number;
  /** Closed by residents' votes, not by an official answer. */
  closedByResidents: boolean;
  createdAt: string;
  address?: string;
}

/** An issue as the map shows it: without the long texts that only its own page needs. */
export type MapIssueDTO = Omit<IssueDTO, "description" | "appealText">;

export interface AuthorityDTO {
  id: string;
  name: string;
  handles: string[];
  contact: string | null;
}

export interface BillDTO {
  id: string;
  buildingId: string;
  period: string;
  items: BillItem[];
  total: number;
}

export interface CityWorkDTO {
  id: string;
  title: string;
  sourceText: string;
  plainSummary: string;
  kind: WorkKind;
  startDate: string;
  endDate: string | null;
  lat: number | null;
  lng: number | null;
  buildings: Pick<BuildingDTO, "id" | "address">[];
}

export interface SearchResult {
  type: "district" | "complex" | "building";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  districtId?: string;
  /** Houses only: the point, so a found house can be used as an address. */
  lat?: number;
  lng?: number;
}

export interface HealthDTO {
  score: number;
  level: "good" | "warn" | "bad";
  label: "Всё хорошо" | "Есть проблемы" | "Нужно внимание";
  parts: string[];
}

export interface DistrictWithCountsDTO extends DistrictDTO {
  openIssues: number;
}

/** Complex as the map shows it (`getMapComplexes`): with its district, house count and open issues. */
export interface MapComplexDTO extends ComplexDTO {
  districtId: string;
  houses: number;
  openIssues: number;
}

export interface DistrictDetailDTO extends DistrictWithCountsDTO {
  microdistricts: (MicrodistrictDTO & { complexes: ComplexDTO[] })[];
  complexCount: number;
  buildingCount: number;
}

export interface ComplexDetailDTO extends ComplexDTO {
  district: Pick<DistrictDTO, "id" | "name" | "color">;
  microdistrict: Pick<MicrodistrictDTO, "id" | "name">;
  buildings: (BuildingDTO & { openIssues: number })[];
  openIssues: number;
}

export interface BuildingPassportDTO {
  building: BuildingDTO;
  openIssues: IssueDTO[];
  resolvedIssues: IssueDTO[];
  bills: BillDTO[];
  /** Works that list this house (`affectsBuilding`) or whose point is within ~600 m. */
  works: (CityWorkDTO & { affectsBuilding: boolean })[];
  health: HealthDTO;
}

export interface DistrictStatsDTO {
  openIssues: number;
  totalIssues: number;
  topCategories: { category: IssueCategory; count: number }[];
}

/** Saved house in the cabinet (`/api/cabinet/houses`). `id` is the id the cabinet stores. */
export interface HouseSummaryDTO {
  id: string;
  address: string;
  district: string | null;
  health: HealthDTO;
  openIssues: number;
  bills: Pick<BillDTO, "period" | "total">[];
  works: (Pick<CityWorkDTO, "id" | "title" | "kind" | "startDate" | "endDate"> & { affectsBuilding: boolean })[];
}
