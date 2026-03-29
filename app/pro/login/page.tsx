import { redirect } from "next/navigation";

// All users now sign in at the universal login page
export default function ProLoginRedirect() {
  redirect("/auth/login");
}
