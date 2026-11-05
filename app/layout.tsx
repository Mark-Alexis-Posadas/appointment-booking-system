import type { Metadata } from "next";
import "./globals.css";
import { RoleNavigation } from "@/components/role-navigation";

export const metadata: Metadata = {
  title: { default: "Appointment Booking", template: "%s · Appointment Booking" },
  description: "Manage appointments, schedules, providers, and services in one place.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><RoleNavigation />{children}</body></html>;
}
