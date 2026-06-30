import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import useAppStore from "@/store/appStore";
import VoxLogo from "@/components/VoxLogo";

const quickRoles = [
  "Founder",
  "Developer",
  "Operator",
];

export default function LoginPage() {
  const login = useAppStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(quickRoles[0]);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    const cleanEmail = email.trim();
    return cleanEmail.includes("@") && password.trim().length >= 4;
  }, [email, password]);

  const submit = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      setError("Use an email and at least 4 password characters for this local session.");
      return;
    }

    try {
      await login({
        email,
        password,
        name: name || role,
        mode: "local-password",
      });
    } catch (err) {
      setError(err.message || "Login failed");
    }
  };

  const continueDemo = () => {
    login({
      email: "demo@voxmind.local",
      name: "Demo Owner",
      mode: "demo",
    });
  };

  return (
    <main className="flex h-full min-h-0 items-center justify-center bg-[var(--vox-bg)] p-4 text-text">
      <div className="flex h-full w-full max-w-[1440px] overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[var(--vox-bg)] shadow-2xl shadow-black/45">
      <section className="hidden min-h-0 flex-1 flex-col justify-between border-r border-[rgba(255,255,255,0.06)] bg-[var(--vox-sidebar)] px-10 py-8 lg:flex">
        <VoxLogo size={46} />

        <div className="max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-aqua/25 bg-aqua/10 px-3 py-1.5 text-xs font-bold text-aqua">
            <Sparkles className="h-3.5 w-3.5" />
            Autonomous voice workspace
          </div>
          <h1 className="font-display text-5xl font-semibold leading-tight text-text">
            Give one command. Get the finished result.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-8 text-text-muted">
            Voice, file, or typed requirements enter one secure workspace that plans,
            builds, previews, remembers, and packages the work.
          </p>
        </div>

        <div className="grid max-w-3xl grid-cols-3 gap-3">
          {[
            ["Plan", "Intent to execution"],
            ["Build", "Preview-ready output"],
            ["Remember", "Persistent context"],
          ].map(([title, text]) => (
            <div key={title} className="nova-card rounded-lg p-4">
              <p className="text-sm font-bold text-text">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 w-full items-center justify-center px-4 py-6 lg:w-[520px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-7 flex items-center justify-center lg:hidden">
            <VoxLogo size={44} />
          </div>

          <div className="nova-card rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-text">
                  Sign in
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Start a private local workspace session.
                </p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/25">
                <LockKeyhole className="h-5 w-5" />
              </div>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="h-11 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-brand/40"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                  Email
                </span>
                <div className="flex h-11 items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 focus-within:border-brand/40">
                  <Mail className="h-4 w-4 text-text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                  />
                </div>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                  Password
                </span>
                <div className="flex h-11 items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 focus-within:border-brand/40">
                  <KeyRound className="h-4 w-4 text-text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Local session password"
                    autoComplete="current-password"
                    className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                  />
                </div>
              </label>

              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Workspace role">
                {quickRoles.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRole(item)}
                    className={`h-10 rounded-lg border px-2 text-xs font-bold transition ${
                      role === item
                        ? "border-brand/40 bg-brand/15 text-brand"
                        : "border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] text-text-muted hover:text-text"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {error ? (
                <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-[var(--vox-bg)] transition hover:brightness-110 disabled:opacity-50"
                disabled={!canSubmit}
              >
                Open workspace
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <button
              type="button"
              onClick={continueDemo}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-surface-1)] px-4 text-sm font-bold text-text-soft transition hover:border-brand/30 hover:text-text"
            >
              <Fingerprint className="h-4 w-4" />
              Continue as demo
            </button>

            <div className="mt-5 flex items-start gap-2 rounded-lg border border-leaf/20 bg-leaf/10 px-3 py-3 text-xs leading-relaxed text-text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
              Passwords are used only to unlock this browser session and are not persisted.
            </div>
          </div>
        </motion.div>
      </section>
      </div>
    </main>
  );
}
