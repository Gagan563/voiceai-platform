import { useEffect, useState } from "react";
import { Clock3, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import SlidePanel from "@/components/SlidePanel";
import {
  createRoutine,
  deleteRoutine,
  getRoutines,
  runRoutine,
  updateRoutine,
} from "@/api/client";

export default function RoutinesPanel({ isOpen, onClose }) {
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "Morning brief",
    prompt: "Check my calendar, summarize important email, and tell me the weather.",
    schedule: "daily",
    time: "09:00",
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;

    getRoutines()
      .then((result) => {
        if (active) setRoutines(result.routines || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const addRoutine = async () => {
    if (!form.prompt.trim()) return;
    const result = await createRoutine(form);
    setRoutines((current) => [result.routine, ...current]);
  };

  const toggleRoutine = async (routine) => {
    const result = await updateRoutine(routine.id, { enabled: !routine.enabled });
    setRoutines((current) =>
      current.map((item) => (item.id === routine.id ? result.routine : item))
    );
  };

  const runNow = async (routine) => {
    const result = await runRoutine(routine.id);
    setRoutines((current) =>
      current.map((item) => (item.id === routine.id ? result.routine || item : item))
    );
  };

  const removeRoutine = async (routine) => {
    await deleteRoutine(routine.id);
    setRoutines((current) => current.filter((item) => item.id !== routine.id));
  };

  return (
    <SlidePanel open={isOpen} onClose={onClose} side="right" title="Routines" subtitle="Saved background agents">
      <div className="flex h-full min-h-0 flex-col bg-ink-950 text-text">
        <div className="space-y-3 border-b border-line p-4">
          <input
            value={form.name}
            onChange={(event) => setForm((next) => ({ ...next, name: event.target.value }))}
            className="h-10 w-full rounded-xl border border-line bg-white/[0.04] px-3 text-sm outline-none focus:border-aqua/45"
            placeholder="Routine name"
          />
          <textarea
            value={form.prompt}
            onChange={(event) => setForm((next) => ({ ...next, prompt: event.target.value }))}
            className="min-h-24 w-full resize-none rounded-xl border border-line bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-aqua/45"
            placeholder="What should this agent do?"
          />
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <select
              value={form.schedule}
              onChange={(event) => setForm((next) => ({ ...next, schedule: event.target.value }))}
              className="h-10 rounded-xl border border-line bg-ink-950 px-3 text-sm outline-none focus:border-aqua/45"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="interval">Interval</option>
            </select>
            <input
              value={form.time}
              onChange={(event) => setForm((next) => ({ ...next, time: event.target.value }))}
              type="time"
              className="h-10 rounded-xl border border-line bg-white/[0.04] px-3 text-sm outline-none focus:border-aqua/45"
            />
          </div>
          <button
            type="button"
            onClick={addRoutine}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-leaf text-sm font-bold text-ink-950"
          >
            <Plus className="h-4 w-4" />
            Save routine
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading routines
            </div>
          ) : null}

          {routines.map((routine) => (
            <div key={routine.id} className="rounded-2xl border border-line bg-white/[0.035] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{routine.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">
                    {routine.prompt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleRoutine(routine)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                    routine.enabled
                      ? "border-leaf/25 bg-leaf/10 text-leaf"
                      : "border-line bg-white/[0.04] text-text-muted"
                  }`}
                >
                  {routine.enabled ? "On" : "Off"}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {routine.nextRunAt ? new Date(routine.nextRunAt).toLocaleString() : "Paused"}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => runNow(routine)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white/[0.04] text-text-muted hover:text-leaf"
                    aria-label="Run routine"
                    title="Run routine"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRoutine(routine)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white/[0.04] text-text-muted hover:text-danger"
                    aria-label="Delete routine"
                    title="Delete routine"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!loading && !routines.length ? (
            <p className="rounded-2xl border border-line bg-white/[0.035] p-4 text-sm text-text-muted">
              No routines yet.
            </p>
          ) : null}
        </div>
      </div>
    </SlidePanel>
  );
}
