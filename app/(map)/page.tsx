import { getComplex } from "@/lib/queries";
import { DevHarness } from "./DevHarness";

// TEMPORARY (task 5): map harness; tasks 6–7 replace this page with the city panel and delete DevHarness.
export default async function Page() {
  const demo = process.env.NODE_ENV === "production" ? null : await getComplex("fregat-2");
  return (
    <DevHarness
      demo={
        demo && {
          districtId: demo.district.id,
          complexId: demo.id,
          buildings: demo.buildings.map((b) => ({ id: b.id, lat: b.lat, lng: b.lng })),
        }
      }
    />
  );
}
