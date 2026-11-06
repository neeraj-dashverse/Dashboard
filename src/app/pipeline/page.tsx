import { redirect } from "next/navigation";

/** Pipeline is parked until it has a place in the dashboard. */
export default function PipelinePage() {
  redirect("/planner");
}
