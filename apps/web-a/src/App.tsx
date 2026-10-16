import { useState } from "react";
import { Button } from "@tsuuru/shared-ui";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

function Home() {
  const [count, setCount] = useState(0);

  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-5xl content-center px-6 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Independent app · web-a
        </p>
        <h1 className="mt-5 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
          A clean start for your next idea.
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          This app has its own Vite build, React Router routes, and shared tsuuru components. It can
          be developed and built without building the other apps first.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button onClick={() => setCount((current) => current + 1)}>
            Try the shared button · {count}
          </Button>
          <Link className="font-semibold text-cyan-800 hover:text-cyan-600" to="/about">
            About this app <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

function About() {
  return (
    <main className="mx-auto min-h-[calc(100vh-73px)] max-w-3xl px-6 py-16">
      <Link className="font-semibold text-cyan-800 hover:text-cyan-600" to="/">
        ← Home
      </Link>
      <h1 className="mt-8 text-4xl font-bold tracking-tight text-slate-950">Built independently</h1>
      <p className="mt-4 text-lg leading-8 text-slate-600">
        Run this app with <span className="font-mono text-base">pnpm dev:web-a</span>, or build
        only this package with <span className="font-mono text-base">pnpm --filter @tsuuru/web-a build</span>.
      </p>
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto min-h-[calc(100vh-73px)] max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-950">Page not found</h1>
      <Link className="mt-4 inline-flex font-semibold text-cyan-800" to="/">Return home</Link>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link className="font-bold tracking-tight text-slate-950" to="/">tsuuru / web-a</Link>
            <Link className="text-sm font-medium text-slate-600 hover:text-cyan-800" to="/about">
              About
            </Link>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}