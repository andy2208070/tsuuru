import { useState } from "react";
import { Button } from "@tsuuru/shared-ui";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

function Home() {
  const [checked, setChecked] = useState(false);

  return (
    <main className="mx-auto min-h-[calc(100vh-73px)] max-w-5xl px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">
          Container-ready app · web-b
        </p>
        <h1 className="mt-5 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
          Ship a focused experience.
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          This standalone React app is built with Vite and served from an Nginx container. Its
          Dockerfile uses the shared pnpm workspace and keeps client-side routes working on refresh.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button onClick={() => setChecked(true)}>
            {checked ? "Ready to build" : "Check deployment status"}
          </Button>
          <Link className="font-semibold text-violet-800 hover:text-violet-600" to="/about">
            Deployment notes <span aria-hidden="true">→</span>
          </Link>
        </div>
        {checked && (
          <p className="mt-4 text-sm font-medium text-emerald-700" role="status">
            Frontend container configuration is in place.
          </p>
        )}
      </div>
    </main>
  );
}

function About() {
  return (
    <main className="mx-auto min-h-[calc(100vh-73px)] max-w-3xl px-6 py-16">
      <Link className="font-semibold text-violet-800 hover:text-violet-600" to="/">
        ← Home
      </Link>
      <h1 className="mt-8 text-4xl font-bold tracking-tight text-slate-950">Container deployment</h1>
      <p className="mt-4 text-lg leading-8 text-slate-600">
        Build from the monorepo root with Docker to install workspace dependencies, compile this
        app, and serve its static assets with Nginx.
      </p>
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto min-h-[calc(100vh-73px)] max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-950">Page not found</h1>
      <Link className="mt-4 inline-flex font-semibold text-violet-800" to="/">Return home</Link>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link className="font-bold tracking-tight text-slate-950" to="/">tsuuru / web-b</Link>
            <Link className="text-sm font-medium text-slate-600 hover:text-violet-800" to="/about">
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