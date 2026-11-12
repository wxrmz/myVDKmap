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

export const ISSUE_STATUSES = ["new", "sent", "in_progress", "resolved"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
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

export const SEVERITIES = [1, 2, 3] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface DistrictDTO {
  id: string;
  name: string;
  population: number;
  populationYear: number;
  color: string;
}

export interface MicrodistrictDTO {
  id: string;
  name: string;
  districtId: string;
  lat: number;
  lng: number;
}

export interface ComplexDTO {
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

export interface ManagementCompanyDTO {
  id: string;
  name: string;
  rating: number;
  avgResponseDays: number;
  isDemo: boolean;
}

export interface BuildingDTO {
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
  category: IssueCategory;
  title: string;
  description: string;
  photoUrl: string | null;
  authorityId: string;
  appealText: string;
  status: IssueStatus;
  severity: Severity;
  supports: number;
  createdAt: string;
  address?: string;
}

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
