"use client";

import dynamic from "next/dynamic";

const CrosswordGame = dynamic(() => import("./CrosswordGame"), {
  ssr: false,
  loading: () => <p className="text-sm text-zinc-500">Armando el crucigrama…</p>,
});

export default function CrosswordGameLoader() {
  return <CrosswordGame />;
}
