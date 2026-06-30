import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  FileText,
  Heart,
  Leaf,
  Phone,
  Scale,
  ShieldAlert,
  Sprout,
  Stethoscope,
  Wind,
} from "lucide-react";
import {
  novaEmergencyContacts,
  novaEmergencyDisaster,
  novaEmergencyFirstAid,
  novaFarmAdvice,
  novaFarmPestId,
  novaLegalAsk,
  novaLegalDocument,
  novaWellnessBreathing,
  novaWellnessJournal,
  novaWellnessMood,
} from "@/api/client";

const MODULES = [
  {
    id: "wellness",
    title: "Mental Wellness",
    label: "Wellness",
    icon: Heart,
    color: "text-rose-400",
    summary: "Mood check-ins, breathing exercises, journaling, and crisis-aware support.",
  },
  {
    id: "legal",
    title: "Legal Aid",
    label: "Legal",
    icon: Scale,
    color: "text-blue-400",
    summary: "Plain-language legal information and simple document templates.",
  },
  {
    id: "farm",
    title: "Farm & Agriculture",
    label: "Farm",
    icon: Leaf,
    color: "text-green-400",
    summary: "Crop planning, pest triage, soil notes, and practical growing advice.",
  },
  {
    id: "emergency",
    title: "Emergency",
    label: "Emergency",
    icon: ShieldAlert,
    color: "text-red-400",
    summary: "Offline-capable first aid, disaster guides, and emergency contacts.",
  },
];

const MOODS = [
  { value: 1, icon: "1", label: "Very low" },
  { value: 2, icon: "2", label: "Low" },
  { value: 3, icon: "3", label: "Okay" },
  { value: 4, icon: "4", label: "Good" },
  { value: 5, icon: "5", label: "Great" },
];

const getBody = (response) => response?.data || response || {};

function LoadingButton({ loading, children, loadingText, className = "", ...props }) {
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={`nova-btn-primary ${className}`}
      {...props}
    >
      {loading ? loadingText : children}
    </button>
  );
}

function ResponseCard({ tone = "aqua", title, children }) {
  const toneClass = {
    aqua: "border-aqua/15 bg-aqua/[0.04]",
    rose: "border-rose-500/20 bg-rose-500/[0.06]",
    amber: "border-amber/20 bg-amber/[0.07]",
    green: "border-leaf/20 bg-leaf/[0.06]",
    red: "border-red-500/25 bg-red-500/[0.08]",
    blue: "border-blue-400/20 bg-blue-400/[0.06]",
  }[tone];

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-4 ${toneClass}`}
    >
      {title ? <h3 className="mb-2 text-sm font-bold text-text">{title}</h3> : null}
      <div className="text-sm leading-relaxed text-text">{children}</div>
    </motion.article>
  );
}

function WellnessView() {
  const [mood, setMood] = useState(3);
  const [note, setNote] = useState("");
  const [response, setResponse] = useState(null);
  const [breathing, setBreathing] = useState([]);
  const [journals, setJournals] = useState([]);
  const [selectedBreath, setSelectedBreath] = useState(null);
  const [loading, setLoading] = useState({ mood: false, breath: false, journal: false });

  const submitMood = async () => {
    setLoading((state) => ({ ...state, mood: true }));
    try {
      const result = await novaWellnessMood(mood, note);
      setResponse(getBody(result));
    } catch {
      setResponse({ response: "Connection error. Your mood note stayed on this screen for now." });
    } finally {
      setLoading((state) => ({ ...state, mood: false }));
    }
  };

  const loadBreathing = async () => {
    setLoading((state) => ({ ...state, breath: true }));
    try {
      const result = await novaWellnessBreathing();
      setBreathing(getBody(result).exercises || []);
    } catch {
      setBreathing([]);
    } finally {
      setLoading((state) => ({ ...state, breath: false }));
    }
  };

  const loadJournals = async () => {
    setLoading((state) => ({ ...state, journal: true }));
    try {
      const result = await novaWellnessJournal(mood, "self-reflection");
      setJournals(getBody(result).prompts || []);
    } catch {
      setJournals(["What is one small thing that helped today?"]);
    } finally {
      setLoading((state) => ({ ...state, journal: false }));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
      <section className="nova-card">
        <h3 className="nova-card-title">
          <Heart className="h-4 w-4 text-rose-400" />
          Daily check-in
        </h3>
        <div className="grid grid-cols-5 gap-2 py-3">
          {MOODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMood(item.value)}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border text-center transition ${
                mood === item.value
                  ? "border-rose-400/35 bg-rose-500/15 text-text"
                  : "border-line bg-white/[0.03] text-text-muted hover:text-text"
              }`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-sm font-bold">
                {item.icon}
              </span>
              <span className="text-[11px] font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="How are you feeling? Add context if you want."
          className="nova-input h-24 w-full resize-none"
        />
        <LoadingButton
          loading={loading.mood}
          loadingText="Saving..."
          onClick={submitMood}
          className="mt-3 w-full"
        >
          Check in
        </LoadingButton>

        {response ? (
          <div className="mt-4">
            <ResponseCard tone={response.crisis_detected ? "red" : "rose"}>
              <p className="whitespace-pre-wrap">{response.response || response.message}</p>
              {response.disclaimer ? (
                <p className="mt-3 border-t border-white/10 pt-3 text-xs text-text-muted">
                  {response.disclaimer}
                </p>
              ) : null}
              {response.resources?.length ? (
                <div className="mt-3 grid gap-2">
                  {response.resources.map((resource) => (
                    <a
                      key={resource.name}
                      href={resource.url || `tel:${resource.phone}`}
                      className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {resource.name}: {resource.phone || resource.url}
                    </a>
                  ))}
                </div>
              ) : null}
            </ResponseCard>
          </div>
        ) : null}
      </section>

      <aside className="space-y-4">
        <section className="nova-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="nova-card-title mb-0">
              <Wind className="h-4 w-4 text-sky-400" />
              Breathing
            </h3>
            <button type="button" onClick={loadBreathing} className="nova-btn-sm">
              {loading.breath ? "Loading" : "Load"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {breathing.map((exercise) => (
              <button
                key={exercise.name}
                type="button"
                onClick={() =>
                  setSelectedBreath(selectedBreath?.name === exercise.name ? null : exercise)
                }
                className="w-full rounded-lg border border-line bg-white/[0.03] p-3 text-left transition hover:border-sky-400/25"
              >
                <p className="text-sm font-bold text-text">{exercise.name}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {exercise.cycles} cycles, about {exercise.total_seconds}s
                </p>
              </button>
            ))}
            {!breathing.length ? (
              <p className="text-xs leading-relaxed text-text-muted">
                Load simple guided breathing exercises from the backend.
              </p>
            ) : null}
          </div>
          {selectedBreath ? (
            <div className="mt-3 rounded-lg border border-sky-400/15 bg-sky-400/[0.05] p-3">
              {selectedBreath.steps.map((step, index) => (
                <div key={`${step.action}-${index}`} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-text">{step.instruction}</span>
                  <span className="font-mono font-bold text-sky-300">{step.duration}s</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="nova-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="nova-card-title mb-0">
              <BookOpen className="h-4 w-4 text-amber" />
              Journaling
            </h3>
            <button type="button" onClick={loadJournals} className="nova-btn-sm">
              {loading.journal ? "Loading" : "Prompts"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {journals.map((prompt) => (
              <p key={prompt} className="rounded-lg border border-amber/15 bg-amber/[0.06] p-3 text-sm italic text-text">
                "{prompt}"
              </p>
            ))}
            {!journals.length ? (
              <p className="text-xs leading-relaxed text-text-muted">
                Generate gentle prompts based on the selected mood.
              </p>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
  );
}

function LegalView() {
  const [mode, setMode] = useState("ask");
  const [country, setCountry] = useState("India");
  const [question, setQuestion] = useState("");
  const [docType, setDocType] = useState("Rental notice");
  const [details, setDetails] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (mode === "ask" && !question.trim()) return;
    if (mode === "document" && !docType.trim()) return;

    setLoading(true);
    try {
      const result =
        mode === "ask"
          ? await novaLegalAsk(question, country)
          : await novaLegalDocument(docType, details, country);
      setAnswer(getBody(result));
    } catch {
      setAnswer({
        answer: "Connection error. Please try again when the backend is reachable.",
        disclaimer: "This is general information only, not legal advice.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="nova-card">
        <h3 className="nova-card-title">
          <Scale className="h-4 w-4 text-blue-400" />
          Legal workspace
        </h3>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            ["ask", "Ask"],
            ["document", "Document"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                mode === id
                  ? "border-blue-400/35 bg-blue-400/15 text-text"
                  : "border-line bg-white/[0.03] text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select value={country} onChange={(event) => setCountry(event.target.value)} className="nova-input mb-2 w-full">
          <option>India</option>
          <option>United States</option>
          <option>United Kingdom</option>
          <option>Canada</option>
          <option>Australia</option>
          <option>General</option>
        </select>

        {mode === "ask" ? (
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Example: Can my landlord evict me without notice?"
            className="nova-input h-28 w-full resize-none"
          />
        ) : (
          <div className="space-y-2">
            <input
              value={docType}
              onChange={(event) => setDocType(event.target.value)}
              placeholder="Document type"
              className="nova-input w-full"
            />
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Add names, dates, clauses, or the situation to cover."
              className="nova-input h-28 w-full resize-none"
            />
          </div>
        )}

        <LoadingButton loading={loading} loadingText="Working..." onClick={submit} className="mt-3 w-full">
          {mode === "ask" ? "Ask" : "Generate template"}
        </LoadingButton>
      </section>

      <section className="min-h-[360px]">
        {answer ? (
          <ResponseCard tone="blue" title={answer.type || answer.country || "Legal information"}>
            <p className="whitespace-pre-wrap">{answer.answer || answer.template}</p>
            {answer.disclaimer ? (
              <p className="mt-4 border-t border-white/10 pt-3 text-xs text-amber">
                {answer.disclaimer}
              </p>
            ) : null}
          </ResponseCard>
        ) : (
          <div className="nova-card flex min-h-full flex-col justify-center">
            <FileText className="mb-3 h-8 w-8 text-blue-400" />
            <h3 className="text-base font-bold text-text">Ask for information or draft a template.</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              NOVA will localize to the selected country and include a clear legal disclaimer.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function FarmView() {
  const [mode, setMode] = useState("advice");
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState("");
  const [region, setRegion] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (mode === "advice" && !query.trim() && !crop.trim()) return;
    if (mode === "pest" && !symptoms.trim()) return;

    setLoading(true);
    try {
      const response =
        mode === "advice"
          ? await novaFarmAdvice({ question: query, crop, region })
          : await novaFarmPestId(symptoms, crop, symptoms);
      setResult(getBody(response));
    } catch {
      setResult({ advice: "Connection error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="nova-card">
        <h3 className="nova-card-title">
          <Sprout className="h-4 w-4 text-green-400" />
          Farm assistant
        </h3>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            ["advice", "Crop advice"],
            ["pest", "Pest triage"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                mode === id
                  ? "border-leaf/35 bg-leaf/15 text-text"
                  : "border-line bg-white/[0.03] text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={crop} onChange={(event) => setCrop(event.target.value)} placeholder="Crop" className="nova-input" />
          <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Region" className="nova-input" />
        </div>
        {mode === "advice" ? (
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Example: When should I plant rice in Tamil Nadu for Kharif season?"
            className="nova-input mt-2 h-28 w-full resize-none"
          />
        ) : (
          <textarea
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder="Describe visible pests, leaf spots, wilting, color changes, or crop damage."
            className="nova-input mt-2 h-28 w-full resize-none"
          />
        )}
        <LoadingButton loading={loading} loadingText="Working..." onClick={submit} className="mt-3 w-full">
          {mode === "advice" ? "Get advice" : "Identify issue"}
        </LoadingButton>
      </section>

      <section>
        {result ? (
          <ResponseCard tone="green" title={result.crop || "Farm result"}>
            <p className="whitespace-pre-wrap">{result.advice || result.analysis || result.identification}</p>
            {result.emergency_steps?.length ? (
              <ul className="mt-3 grid gap-2">
                {result.emergency_steps.map((step) => (
                  <li key={step} className="rounded-lg border border-leaf/15 bg-leaf/[0.05] px-3 py-2 text-xs">
                    {step}
                  </li>
                ))}
              </ul>
            ) : null}
          </ResponseCard>
        ) : (
          <div className="nova-card">
            <Leaf className="mb-3 h-8 w-8 text-green-400" />
            <h3 className="text-base font-bold text-text">Plan crops or triage field issues.</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Add a crop and region for more useful, local advice.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function EmergencyView() {
  const [guides, setGuides] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [view, setView] = useState("guides");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [guideResult, contactResult] = await Promise.all([
          novaEmergencyFirstAid(),
          novaEmergencyContacts(),
        ]);
        if (!mounted) return;
        setGuides(getBody(guideResult).guides || []);
        setContacts(getBody(contactResult).global || []);
      } catch {
        if (!mounted) return;
        setGuides([]);
        setContacts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const openGuide = async (id) => {
    try {
      const result = await novaEmergencyFirstAid(id);
      setActive(getBody(result).guide);
      setView("detail");
    } catch {
      setActive(null);
    }
  };

  const openDisaster = async (type) => {
    try {
      const result = await novaEmergencyDisaster(type);
      const guide = getBody(result).guide;
      setActive({
        title: guide.title,
        steps: [...(guide.during || []), ...(guide.after || [])],
        warning: "Follow local authority instructions first.",
      });
      setView("detail");
    } catch {
      setActive(null);
    }
  };

  if (view === "detail" && active) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <button
          type="button"
          onClick={() => setView("guides")}
          className="flex items-center gap-2 text-xs font-semibold text-text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to emergency
        </button>
        <ResponseCard tone="red" title={active.title}>
          <ol className="space-y-2">
            {active.steps.map((step, index) => (
              <li key={`${step}-${index}`} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-500/15 text-xs font-bold text-red-300">
                  {index + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
          {active.warning ? (
            <div className="mt-4 flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {active.warning}
            </div>
          ) : null}
          {active.call ? <p className="mt-3 font-bold text-red-200">{active.call}</p> : null}
        </ResponseCard>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["guides", "First aid", ShieldAlert],
            ["contacts", "Contacts", Phone],
            ["disaster", "Disaster", AlertTriangle],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded-lg border p-4 text-left transition ${
                view === id
                  ? "border-red-400/35 bg-red-500/15 text-text"
                  : "border-line bg-white/[0.03] text-text-muted hover:text-text"
              }`}
            >
              <Icon className="mb-3 h-5 w-5 text-red-400" />
              <span className="text-sm font-bold">{label}</span>
            </button>
          ))}
        </div>

        {loading ? <p className="text-sm text-text-muted">Loading emergency data...</p> : null}

        {view === "guides" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {guides.map((guide) => (
              <button
                key={guide.id}
                type="button"
                onClick={() => openGuide(guide.id)}
                className="rounded-lg border border-line bg-white/[0.03] p-3 text-left transition hover:border-red-400/25"
              >
                <p className="text-sm font-bold text-text">{guide.title}</p>
                <p className="mt-1 text-xs text-text-muted">Offline-capable guide</p>
              </button>
            ))}
          </div>
        ) : null}

        {view === "contacts" ? (
          <div className="nova-card">
            <h3 className="nova-card-title text-amber">Emergency contacts</h3>
            <div className="grid gap-2">
              {contacts.map((contact) => (
                <div key={contact.name} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2">
                  <span className="text-sm text-text">{contact.name}</span>
                  <a href={contact.url || `tel:${contact.number}`} className="font-mono text-xs font-bold text-amber">
                    {contact.number || "Open"}
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {view === "disaster" ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {["earthquake", "flood", "fire"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => openDisaster(type)}
                className="rounded-lg border border-line bg-white/[0.03] p-4 text-left text-sm font-bold capitalize text-text transition hover:border-red-400/25"
              >
                {type}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <aside className="nova-card border-red-500/20">
        <Stethoscope className="mb-3 h-7 w-7 text-red-400" />
        <h3 className="text-sm font-bold text-text">Use emergency services first.</h3>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          These guides help with immediate orientation, but they do not replace local responders,
          doctors, or official disaster alerts.
        </p>
      </aside>
    </div>
  );
}

const VIEW_MAP = {
  wellness: WellnessView,
  legal: LegalView,
  farm: FarmView,
  emergency: EmergencyView,
};

export default function NovaModules({ activeModule, onClose, onSelectModule }) {
  const active = MODULES.find((module) => module.id === activeModule) || MODULES[0];
  const ActiveIcon = active.icon;
  const ActiveView = VIEW_MAP[active.id];
  const moduleMeta = useMemo(() => MODULES, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={active.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.18 }}
        className="flex h-full min-h-0 flex-col"
      >
        <header className="shrink-0 border-b border-[var(--vox-border)] px-4 py-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-aqua/15 bg-aqua/[0.07]">
              <ActiveIcon className={`h-5 w-5 ${active.color}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-text">{active.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{active.summary}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-xs font-bold text-text-muted transition hover:text-text"
            >
              Back
            </button>
          </div>

          <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {moduleMeta.map((module) => {
              const Icon = module.icon;
              const selected = module.id === active.id;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => onSelectModule?.(module.id)}
                  className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 text-left text-xs font-bold transition ${
                    selected
                      ? "border-aqua/35 bg-aqua/10 text-text"
                      : "border-line bg-white/[0.025] text-text-muted hover:text-text"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${selected ? module.color : ""}`} />
                  {module.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <ActiveView />
        </main>
      </motion.div>
    </AnimatePresence>
  );
}
