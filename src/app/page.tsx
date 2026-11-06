import { redirect } from "next/navigation";

/** Today is parked until it has a place in the dashboard. */
export default function HomePage() {
  redirect("/planner");
}
