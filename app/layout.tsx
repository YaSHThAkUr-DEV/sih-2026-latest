import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Oswald } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const righteous = localFont({
  src: "./fonts/Righteous-Regular.ttf",
  variable: "--font-righteous",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NIRMAN DMS — Document Management System",
  description: "Organise | Secure | Progress — National Sovereign Document Management System with Cryptographic Integrity, Section 65B Certificates & Hyperledger Fabric Blockchain",
  icons: {
    icon: "/nirman-logo.png",
    shortcut: "/nirman-logo.png",
    apple: "/nirman-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${righteous.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} ${oswald.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" type="image/png" href="/nirman-logo.png" />
        <link rel="shortcut icon" type="image/png" href="/nirman-logo.png" />
        <link rel="apple-touch-icon" href="/nirman-logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
