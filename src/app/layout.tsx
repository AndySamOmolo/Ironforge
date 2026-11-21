import type { Metadata, Viewport } from "next";
import { Inter, Outfit, DM_Sans, Nunito, Sora, Poppins, Raleway, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import "./globals.css";

// Pre-download all fonts at build time — only default fonts preloaded at startup
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap', preload: false });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap', preload: false });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap', preload: false });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap', preload: false });
const poppins = Poppins({ weight: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'], variable: '--font-poppins', display: 'swap', preload: false });
const raleway = Raleway({ subsets: ['latin'], variable: '--font-raleway', display: 'swap', preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap', preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

const APP_TITLE = "IronForge — Forge Your Best Self";
const APP_DESCRIPTION = "World-class offline workout tracker with 2,240+ exercises, animated GIF demos, 25 pro programs, and a 3D anatomical muscle heatmap.";

export const metadata: Metadata = {
  metadataBase: new URL('https://ironforge.app'),
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    url: '/',
    siteName: 'IronForge',
    type: 'website',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'IronForge Workout Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: ['/icon-512.png'],
  },
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
  viewportFit: "cover",
  themeColor: "#070710",
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

  // Zero-FOUC synchronous theme + light/dark mode + font + UI settings restore script
  const restoreScript = `(function(){var LT={daylight:'#F8FAFC',sand:'#FAF6F0',snow:'#FFFFFF',mint:'#F2FBF7',blossom:'#FFF5F8',sky:'#F0F7FF',lilac:'#F7F4FF',paper:'#F9F8F4',citrus:'#FFFBF0',matcha:'#F4F7F0',peach:'#FFF6F0',oceanic:'#EFFBFA',linen:'#FBF8F3',berry:'#FAF5FF',slate_light:'#F1F5F9'};function a(r){if(!r)return;var h=document.documentElement;var t=r.theme||'dark';if(t!=='dark')h.setAttribute('data-theme',t);var isL=Boolean(LT[t]);h.setAttribute('data-theme-mode',isL?'light':'dark');h.style.colorScheme=isL?'light':'dark';if(isL){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',LT[t]);try{window.IronForgeNative&&window.IronForgeNative.setSystemBarTheme&&window.IronForgeNative.setSystemBarTheme(LT[t],true)}catch(x){}}var ca={crimson:['#FF3D5A','#FF8A3D'],electric:['#0EA5E9','#6366F1'],emerald:['#10E89A','#06B6D4'],violet:['#A855F7','#EC4899'],amber:['#F59E0B','#EF4444'],magenta:['#EC4899','#8B5CF6'],cyan:['#22D3EE','#3B82F6'],lime:['#84CC16','#10B981'],coral:['#FB7185','#FBBF24']}[r.customAccent];if(ca){h.style.setProperty('--accent-red',ca[0]);h.style.setProperty('--accent-orange',ca[1]);h.style.setProperty('--glow-red',ca[0]+'44');h.style.setProperty('--border-active',ca[0]+'55');h.style.setProperty('--gradient-fire','linear-gradient(135deg, '+ca[0]+' 0%, '+ca[1]+' 100%)');h.style.setProperty('--gradient-hero','linear-gradient(135deg, '+ca[0]+' 0%, '+ca[1]+' 60%, var(--accent-yellow) 100%)')}if(r.font&&r.font!=='inter')h.setAttribute('data-font',r.font);if(r.fontSize&&r.fontSize!=='normal')h.setAttribute('data-fontsize',r.fontSize);if(r.fontWeightScale&&r.fontWeightScale!=='normal')h.setAttribute('data-font-weight',r.fontWeightScale);if(r.numberFont&&r.numberFont!=='mono')h.setAttribute('data-num-font',r.numberFont);if(r.headerStyle&&r.headerStyle!=='gradient')h.setAttribute('data-header-style',r.headerStyle);var den=r.density||(r.compactMode?'compact':'normal');if(den&&den!=='normal')h.setAttribute('data-density',den);if(den==='compact')h.setAttribute('data-compact','true');if(r.gridColumns&&r.gridColumns!=='2')h.setAttribute('data-grid-cols',r.gridColumns);if(r.buttonStyle&&r.buttonStyle!=='default')h.setAttribute('data-buttons',r.buttonStyle);if(r.cardStyle&&r.cardStyle!=='glass')h.setAttribute('data-cards',r.cardStyle);if(r.cardBlur&&r.cardBlur!=='normal')h.setAttribute('data-card-blur',r.cardBlur);if(r.surfaceTint&&r.surfaceTint!=='none')h.setAttribute('data-surface-tint',r.surfaceTint);if(r.borderRadius&&r.borderRadius!=='default')h.setAttribute('data-radius',r.borderRadius);if(r.animationLevel&&r.animationLevel!=='normal')h.setAttribute('data-anim',r.animationLevel);if(r.navStyle&&r.navStyle!=='default')h.setAttribute('data-nav',r.navStyle);if(r.bgStyle&&r.bgStyle!=='mesh')h.setAttribute('data-bg-style',r.bgStyle);if(r.accentIntensity&&r.accentIntensity!=='normal')h.setAttribute('data-accent-intensity',r.accentIntensity);if(r.colorMode&&r.colorMode!=='normal')h.setAttribute('data-color-mode',r.colorMode);if(r.textShadow)h.setAttribute('data-text-shadow','true');if(r.glowIntensity&&r.glowIntensity!=='normal')h.setAttribute('data-glow',r.glowIntensity);if(r.borderThickness&&r.borderThickness!=='normal')h.setAttribute('data-border-width',r.borderThickness);if(r.glassOpacity&&r.glassOpacity!=='medium')h.setAttribute('data-glass-opacity',r.glassOpacity);if(r.contrastMode&&r.contrastMode!=='normal')h.setAttribute('data-contrast',r.contrastMode)}try{var c=localStorage.getItem('ironforge_appearance_v1');if(c){a(JSON.parse(c));return}}catch(e){}try{var req=indexedDB.open('IronForgeDB');req.onsuccess=function(e){var db=e.target.result;if(!db)return;db.onversionchange=function(){db.close()};try{if(!db.objectStoreNames.contains('userProfile')){db.close();return}var tx=db.transaction('userProfile','readonly');var getAll=tx.objectStore('userProfile').getAll();getAll.onsuccess=function(){try{var r=getAll.result&&getAll.result[0];if(r)a(r)}finally{db.close()}};getAll.onerror=function(){db.close()}}catch(x){db.close()}}}catch(e){}})()`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'IronForge',
    url: 'https://ironforge.app',
    description: APP_DESCRIPTION,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Android, iOS, Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self';"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script dangerouslySetInnerHTML={{ __html: restoreScript }} />
      </head>
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
