import { Button } from "@tsuuru/shared-ui";
import { BrowserRouter, Link, Route, Routes, useNavigate } from "react-router-dom";

const projects = [
  {
    name: "web-a",
    description: "An independently buildable React application.",
    port: "5174",
  },
  {
    name: "web-b",
    description: "A React application prepared for container deployment.",
    port: "5175",
  },
];

function Home() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <section className="max-w-3xl">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          One workspace, many possibilities
        </p>
        <h1 className="text-5xl font-bold tracking-tight text-slate-950 sm:text-7xl">
          Welcome to <span className="text-indigo-600">tsuuru</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          A home for the products and services in this workspace. Explore the apps below or use
          the shared UI package to build something new.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            onClick={() => document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" })}
          >
            Explore projects
          </Button>
          <Button variant="secondary" onClick={() => navigate("/about")}>
            About this workspace
          </Button>
        </div>
      </section>

      <section id="projects" className="mt-20 scroll-mt-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Applications
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Built for different journeys
            </h2>
          </div>
          <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 sm:inline-flex">
            {projects.length} projects
          </span>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((project, index) => (
            <article
              key={project.name}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                  0{index + 1}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  React · Vite
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900">{project.name}</h3>
              <p className="mt-2 min-h-12 leading-6 text-slate-600">{project.description}</p>
              <p className="mt-4 text-sm text-slate-500">Development port {project.port}</p>
              <Link
                className="mt-5 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-500"
                to="/about"
              >
                Project details <span aria-hidden="true" className="ml-1">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function About() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Link className="text-sm font-semibold text-indigo-700 hover:text-indigo-500" to="/">
        ← Back to portal
      </Link>
      <h1 className="mt-8 text-4xl font-bold tracking-tight text-slate-950">About tsuuru</h1>
      <p className="mt-5 text-lg leading-8 text-slate-600">
        This monorepo keeps the portal, independently buildable web applications, shared React
        components, and the TTS API together while letting each app have its own build and
        deployment path.
      </p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Shared foundations</h2>
        <p className="mt-2 leading-7 text-slate-600">
          Frontend apps share TypeScript settings and components from @tsuuru/shared-ui. The API
          is managed separately with uv.
        </p>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-bold text-slate-950">Page not found</h1>
      <Link className="mt-4 inline-flex font-semibold text-indigo-700" to="/">
        Return to the portal
      </Link>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link className="text-xl font-bold tracking-tight text-slate-950" to="/">
              tsuuru<span className="text-indigo-600">.</span>
            </Link>
            <nav aria-label="Main navigation" className="flex gap-6 text-sm font-medium text-slate-600">
              <Link className="hover:text-indigo-700" to="/">Home</Link>
              <Link className="hover:text-indigo-700" to="/about">About</Link>
            </nav>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-500">
            tsuuru monorepo · Frontend workspace
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}