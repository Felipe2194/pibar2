import CrosswordGameLoader from "@/components/CrosswordGameLoader";

export default function Home() {
  return (
    <div className="min-h-screen bg-violet-50 px-4 py-8 dark:bg-[#1a1230]">
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-violet-950 dark:text-violet-50">⚽ Crucigrama de Fútbol</h1>
          <p className="mt-1 text-sm text-violet-500 dark:text-violet-300">Completá la grilla, sumá puntos y competí con tus amigos.</p>
        </header>
        <CrosswordGameLoader />
      </main>
    </div>
  );
}
