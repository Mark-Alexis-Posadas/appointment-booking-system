import type { Metadata } from "next";
import "./globals.css";
import { RoleNavigation } from "@/components/role-navigation";

export const metadata: Metadata = {
  title: "Appointment Booking",
  description: "A simple appointment booking foundation for clinics and salons.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><RoleNavigation />{children}</body></html>;
}
