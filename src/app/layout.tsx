import type { Metadata, Viewport } from "next";
import { Inter, Outfit, DM_Sans, Nunito, Sora, Poppins, Raleway, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import "./globals.css";

// Pre-download all fonts at build time — no CDN needed at runtime
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });
const poppins = Poppins({ weight: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'], variable: '--font-poppins', display: 'swap' });
const raleway = Raleway({ subsets: ['latin'], variable: '--font-raleway', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: "IronForge — Forge Your Best Self",
  description: "World-class workout tracker with 870+ exercises, real-time tracking, and intelligent training suggestions.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/icon-192.png'],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IronForge",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0A0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = [
    inter.variable, outfit.variable, dmSans.variable, nunito.variable,
    sora.variable, poppins.variable, raleway.variable, spaceGrotesk.variable,
    jetbrainsMono.variable,
  ].join(' ');

  // Theme + font + UI settings restore script
  const restoreScript = `(function(){try{var d=indexedDB.open('IronForgeDB');d.onsuccess=function(e){try{var t=e.target.result.transaction('userProfile','readonly').objectStore('userProfile').getAll();t.onsuccess=function(){var r=t.result&&t.result[0];if(!r)return;if(r.theme&&r.theme!=='dark')document.documentElement.setAttribute('data-theme',r.theme);if(r.font)document.documentElement.setAttribute('data-font',r.font);if(r.fontSize)document.documentElement.setAttribute('data-fontsize',r.fontSize);if(r.compactMode)document.documentElement.setAttribute('data-compact','true');if(r.buttonStyle&&r.buttonStyle!=='default')document.documentElement.setAttribute('data-buttons',r.buttonStyle);if(r.cardStyle&&r.cardStyle!=='glass')document.documentElement.setAttribute('data-cards',r.cardStyle);if(r.borderRadius&&r.borderRadius!=='default')document.documentElement.setAttribute('data-radius',r.borderRadius);if(r.animationLevel&&r.animationLevel!=='normal')document.documentElement.setAttribute('data-anim',r.animationLevel);if(r.navStyle&&r.navStyle!=='default')document.documentElement.setAttribute('data-nav',r.navStyle);if(r.accentIntensity&&r.accentIntensity!=='normal')document.documentElement.setAttribute('data-accent-intensity',r.accentIntensity);if(r.colorMode&&r.colorMode!=='normal')document.documentElement.setAttribute('data-color-mode',r.colorMode);if(r.textShadow)document.documentElement.setAttribute('data-text-shadow','true');if(r.glowIntensity&&r.glowIntensity!=='normal')document.documentElement.setAttribute('data-glow',r.glowIntensity);if(r.borderThickness&&r.borderThickness!=='normal')document.documentElement.setAttribute('data-border-width',r.borderThickness);if(r.glassOpacity&&r.glassOpacity!=='medium')document.documentElement.setAttribute('data-glass-opacity',r.glassOpacity);if(r.contrastMode&&r.contrastMode!=='normal')document.documentElement.setAttribute('data-contrast',r.contrastMode)}}catch(x){}}catch(e){}})()`; 

  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: restoreScript }} /></head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
