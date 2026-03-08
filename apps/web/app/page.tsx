import { redirect } from "next/navigation";

export default async function RootPage() {
  // Redirect handled client-side via middleware or dashboard layout
  redirect("/login");
}
