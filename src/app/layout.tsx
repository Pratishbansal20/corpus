import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import "./globals.css";

// Display: headlines and headline money. Optical sizing tightens it as it grows.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// UI text: labels, prose, controls.
const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Data: every rupee figure in a row, table or readout. The statement-print voice.
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves the generated opengraph-image into an absolute URL: without
  // this, Next falls back to localhost and every shared link's preview
  // image would point at a URL that only resolves on the machine it was
  // built on.
  metadataBase: new URL("https://corpusfinance.vercel.app"),
  title: "Corpus: every account, one number",
  description:
    "A private finance hub: Indian stocks, mutual funds, US holdings, bank balances and cards resolved into a single net worth.",
  // iOS never fully honors the web manifest's display: "standalone"; it
  // needs its own meta tags to drop the Safari chrome when launched from
  // the home screen and to match the status bar to the app's own dark
  // background instead of the default light one.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Corpus",
  },
};

export const viewport: Viewport = {
  themeColor: "#100e0c",
  colorScheme: "dark",
  // Lets the app draw under the notch/home-indicator instead of stopping
  // short of it. mobile-nav.tsx already pads itself with
  // env(safe-area-inset-bottom) for exactly this, but that padding is a
  // no-op without this: without viewport-fit=cover, the browser never
  // extends layout into the safe-area region in the first place, so
  // env() falls back to 0 either way.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dark-only by design: the `dark` class is applied on the server so there's
  // no flash and no half-maintained light theme.
  return (
    <html
      lang="en"
      className={`dark ${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
