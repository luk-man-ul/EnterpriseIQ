export default function AppPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-black text-white font-sans">
      <div className="text-center max-w-md border border-zinc-800 bg-zinc-950 px-8 py-10 rounded-2xl shadow-xl">
        <h2 className="text-2xl font-bold mb-4 tracking-tight">
          Welcome to EnterpriseIQ
        </h2>
        <p className="text-sm text-zinc-400">
          Authorized workspace session active.
        </p>
      </div>
    </div>
  );
}
