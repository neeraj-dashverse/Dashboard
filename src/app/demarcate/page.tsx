import { redirect } from "next/navigation";

/** Demarcate is parked until it has a place in the dashboard. */
export default function DemarcatePage() {
  redirect("/planner");
}
