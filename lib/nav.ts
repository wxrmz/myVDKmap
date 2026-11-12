// URLs and labels for the zoom path Город → Район → ЖК → Дом (§2, §4).

export const districtHref = (districtId: string) => `/d/${districtId}`;
export const complexHref = (districtId: string, complexId: string) => `/d/${districtId}/c/${complexId}`;
export const houseHref = (buildingId: string) => `/house/${buildingId}`;
export const workHref = (workId: string) => `/changes?work=${encodeURIComponent(workId)}`;

export const issueHref = (issue: { id: string; buildingId: string | null }) =>
  issue.buildingId ? `${houseHref(issue.buildingId)}?issue=${encodeURIComponent(issue.id)}` : null;

/** «Фрегат» → «ЖК «Фрегат»»; a name that already has quotes or the prefix is not wrapped again. */
export function complexLabel(name: string) {
  if (/^ЖК\s/i.test(name)) return name;
  return /[«"]/.test(name) ? `ЖК ${name}` : `ЖК «${name}»`;
}

interface Crumb {
  label: string;
  href: string;
}

export function breadcrumbs(at: {
  district?: { id: string; name: string };
  complex?: { id: string; name: string };
  house?: { id: string; address: string };
}): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Владивосток", href: "/" }];
  if (at.district) crumbs.push({ label: `${at.district.name} район`, href: districtHref(at.district.id) });
  if (at.district && at.complex) crumbs.push({ label: complexLabel(at.complex.name), href: complexHref(at.district.id, at.complex.id) });
  if (at.house) crumbs.push({ label: at.house.address, href: houseHref(at.house.id) });
  return crumbs;
}
