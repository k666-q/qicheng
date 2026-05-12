export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-lg px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          启程
        </h1>
        <p className="mt-3 text-stone-500">
          你的 AI 学习规划战略搭档
        </p>
        <div className="mt-10">
          <p className="text-lg text-stone-700">
            你最近脑子里转得最多的一件想做或想学的事是什么？
          </p>
          <input
            type="text"
            placeholder="比如：我想做一个健身记录 app"
            className="mt-4 w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          <button className="mt-4 w-full rounded-lg bg-stone-800 px-4 py-3 text-sm font-medium text-white hover:bg-stone-700 transition-colors">
            开始
          </button>
        </div>
      </div>
    </main>
  );
}
