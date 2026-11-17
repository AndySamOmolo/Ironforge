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
  description: "World-class workout tracker with 2,200+ exercises, real-time tracking, and intelligent training suggestions.",
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
  viewportFit: "cover",
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
  const restoreScript = `(function(){try{var d=indexedDB.open('IronForgeDB');d.onsuccess=function(e){try{var t=e.target.result.transaction('userProfile','readonly').objectStore('userProfile').getAll();t.onsuccess=function(){var r=t.result&&t.result[0];if(!r)return;var h=document.documentElement;if(r.theme&&r.theme!=='dark')h.setAttribute('data-theme',r.theme);if(r.font&&r.font!=='inter')h.setAttribute('data-font',r.font);if(r.fontSize&&r.fontSize!=='normal')h.setAttribute('data-fontsize',r.fontSize);if(r.numberFont&&r.numberFont!=='mono')h.setAttribute('data-num-font',r.numberFont);if(r.headerStyle&&r.headerStyle!=='gradient')h.setAttribute('data-header-style',r.headerStyle);var den=r.density||(r.compactMode?'compact':'normal');if(den&&den!=='normal')h.setAttribute('data-density',den);if(den==='compact')h.setAttribute('data-compact','true');if(r.gridColumns&&r.gridColumns!=='2')h.setAttribute('data-grid-cols',r.gridColumns);if(r.buttonStyle&&r.buttonStyle!=='default')h.setAttribute('data-buttons',r.buttonStyle);if(r.cardStyle&&r.cardStyle!=='glass')h.setAttribute('data-cards',r.cardStyle);if(r.borderRadius&&r.borderRadius!=='default')h.setAttribute('data-radius',r.borderRadius);if(r.animationLevel&&r.animationLevel!=='normal')h.setAttribute('data-anim',r.animationLevel);if(r.navStyle&&r.navStyle!=='default')h.setAttribute('data-nav',r.navStyle);if(r.bgStyle&&r.bgStyle!=='mesh')h.setAttribute('data-bg-style',r.bgStyle);if(r.accentIntensity&&r.accentIntensity!=='normal')h.setAttribute('data-accent-intensity',r.accentIntensity);if(r.colorMode&&r.colorMode!=='normal')h.setAttribute('data-color-mode',r.colorMode);if(r.textShadow)h.setAttribute('data-text-shadow','true');if(r.glowIntensity&&r.glowIntensity!=='normal')h.setAttribute('data-glow',r.glowIntensity);if(r.borderThickness&&r.borderThickness!=='normal')h.setAttribute('data-border-width',r.borderThickness);if(r.glassOpacity&&r.glassOpacity!=='medium')h.setAttribute('data-glass-opacity',r.glassOpacity);if(r.contrastMode&&r.contrastMode!=='normal')h.setAttribute('data-contrast',r.contrastMode)}}catch(x){}}}catch(e){}})()`;

  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: restoreScript }} /></head>
      <body suppressHydrationWarning>
        {/* SVG Color Vision Filters */}
        <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
          <defs>
            <filter id="protanopia-filter">
              <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0  0.558, 0.442, 0, 0, 0  0, 0.242, 0.758, 0, 0  0, 0, 0, 1, 0" />
            </filter>
            <filter id="deuteranopia-filter">
              <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0  0.7, 0.3, 0, 0, 0  0, 0.3, 0.7, 0, 0  0, 0, 0, 1, 0" />
            </filter>
            <filter id="tritanopia-filter">
              <feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0  0, 0.433, 0.567, 0, 0  0, 0.475, 0.525, 0, 0  0, 0, 0, 1, 0" />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
