import CrosswordGame from "@/components/CrosswordGame";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-black">
      <main className="mx-auto flex max-w-4xl flex-col items-center gap-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">⚽ Crucigrama de Fútbol</h1>
          <p className="mt-1 text-sm text-zinc-500">Completá la grilla, sumá puntos y competí con tus amigos.</p>
        </header>
        <CrosswordGame />
      </main>
    </div>
  );
}
