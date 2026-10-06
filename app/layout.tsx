import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUTOMOVA DWI Production",
  description: "Digital Work Instruction dan Production Tracking untuk CV Automova Detailing Indonesia.",
  icons: { icon: "/mova-corp-logo.png", shortcut: "/mova-corp-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
