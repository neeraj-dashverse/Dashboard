import { redirect } from "next/navigation";

/** The month calendar was replaced by the Planner grid. */
export default function CalendarPage() {
  redirect("/planner");
}
