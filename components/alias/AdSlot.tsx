"use client";
import { useEffect, useRef, useState } from "react";
import type { Placement } from "@/lib/alias/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface PublicAd {
  id: string;
  text: string;
  imageUrl?: string;
  cta?: string;
}
interface Active {
  ads: PublicAd[];
  adsense: { client: string; slot: string } | null;
}

function loadAdSense(client: string) {
  if (document.querySelector("script[data-alias-adsense]")) return;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.dataset.aliasAdsense = "1";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

function SponsorBanner({ ad }: { ad: PublicAd }) {
  useEffect(() => {
    try {
      void fetch("/api/alias/ads/impression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ad.id }),
        keepalive: true,
      });
    } catch {}
  }, [ad.id]);
  return (
    <a
      // every visit goes through our own link so it can be counted
      href={`/api/alias/ads/go?id=${encodeURIComponent(ad.id)}`}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="block rounded-xl overflow-hidden border border-gray-200 bg-white"
    >
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.imageUrl} alt={ad.text} className="w-full h-auto block" referrerPolicy="no-referrer" />
      )}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-sm font-bold text-gray-800">{ad.text}</span>
        {ad.cta && <span className="shrink-0 text-xs bg-blue-600 text-white rounded-full px-3 py-1">{ad.cta}</span>}
      </div>
    </a>
  );
}

function AdSenseUnit({ client, slot }: { client: string; slot: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    loadAdSense(client);
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [client]);
  return (
    <ins
      className="adsbygoogle block"
      style={{ display: "block", minHeight: 60 }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

// Renders nothing (and takes no space) unless the owner has enabled ads and approved one.
export default function AdSlot({ placement }: { placement: Placement }) {
  const [active, setActive] = useState<Active | null>(null);
  const [pick, setPick] = useState(0);

  useEffect(() => {
    let stop = false;
    fetch(`/api/alias/ads/active?placement=${placement}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Active | null) => {
        if (stop || !d) return;
        setActive(d);
        setPick(Math.floor(Math.random() * Math.max(1, d.ads.length)));
      })
      .catch(() => {});
    return () => { stop = true; };
  }, [placement]);

  const ad = active?.ads[pick];
  if (!ad && !active?.adsense) return null;
  return (
    <aside className="bg-white/90 rounded-2xl p-2" aria-label="פרסומת">
      <div className="text-[10px] text-gray-400 text-center mb-1">פרסומת</div>
      {ad ? <SponsorBanner ad={ad} /> : <AdSenseUnit client={active!.adsense!.client} slot={active!.adsense!.slot} />}
    </aside>
  );
}
