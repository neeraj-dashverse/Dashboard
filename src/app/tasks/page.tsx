import { redirect } from "next/navigation";

/** Tasks is parked until it has a place in the dashboard. */
export default function TasksPage() {
  redirect("/planner");
}
