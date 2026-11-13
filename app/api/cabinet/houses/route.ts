import { NextResponse, type NextRequest } from "next/server";
import { serverError } from "@/lib/ai/http";
import { getBuilding } from "@/lib/queries";
import type { HouseSummaryDTO } from "@/lib/types";

const MAX_IDS = 20;

/** `?ids=a,b`: short summaries of saved houses; unknown ids are skipped. */
export async function GET(req: NextRequest) {
  try {
    const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean))].slice(0, MAX_IDS);
    const passports = await Promise.all(ids.map((id) => getBuilding(id)));
    const out: HouseSummaryDTO[] = passports.flatMap((p, i) =>
      p
        ? [
            {
              id: ids[i],
              address: p.building.address,
              district: p.building.district?.name ?? null,
              health: p.health,
              openIssues: p.openIssues.length,
              bills: p.bills.map(({ period, total }) => ({ period, total })),
              works: p.works.map(({ id, title, kind, startDate, endDate, affectsBuilding }) => ({ id, title, kind, startDate, endDate, affectsBuilding })),
            },
          ]
        : [],
    );
    return NextResponse.json(out);
  } catch (e) {
    return serverError(e);
  }
}
