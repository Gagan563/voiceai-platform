import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, FileUp, ImagePlus, MonitorUp } from "lucide-react";
import { VoiceButton } from "@/components/VoiceButton";
import { analyzeContextImage } from "@/api/client";
import { useAppStore } from "@/store/appStore";

export const InputBar = () => {
  const [text, setText] = useState("");
  const [contextBusy, setContextBusy] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const isLoading = useAppStore((state) => state.isLoading);
  const viewingSessionId = useAppStore((state) => state.viewingSessionId);
  const submitInput = useAppStore((state) => state.submitInput);
  const settings = useAppStore((state) => state.settings);
  const toggleAutopilot = useAppStore((state) => state.toggleAutopilot);

  const disabled = isLoading || contextBusy || Boolean(viewingSessionId);

  const send = () => {
    if (disabled || !text.trim()) return;

    submitInput(text);
    setText("");
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const handleFile = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";

    if (!file || disabled) return;

    try {
      const content = await file.text();
      submitInput(
        `Requirements file: ${file.name}\n\n${content.slice(0, 12000)}`
      );
    } catch {
      submitInput(
        `Requirements file: ${file.name}\n\nBuild an autonomous AI product from this uploaded requirement.`
      );
    }
  };

  const submitImageContext = async (file, type = "image") => {
    if (!file || disabled) return;

    setContextBusy(true);
    try {
      const result = await analyzeContextImage(
        file,
        type === "screen"
          ? "Summarize this screen and identify what action the user may want next."
          : "Summarize this image for my next voice command.",
        type
      );
      submitInput(
        `${type === "screen" ? "Screen" : "Image"} context from ${file.name}:\n\n${result.analysis}`
      );
    } catch (error) {
      submitInput(
        `${type === "screen" ? "Screen" : "Image"} context upload failed: ${error.message || "unknown error"}`
      );
    } finally {
      setContextBusy(false);
    }
  };

  const handleImage = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    await submitImageContext(file, "image");
  };

  const captureScreen = async () => {
    if (disabled || !navigator.mediaDevices?.getDisplayMedia) return;

    setContextBusy(true);
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not capture screen image.");

      const file = new File([blob], `screen-${Date.now()}.png`, { type: "image/png" });
      await submitImageContext(file, "screen");
    } catch (error) {
      if (error?.name !== "NotAllowedError") {
        submitInput(`Screen context capture failed: ${error.message || "unknown error"}`);
      }
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setContextBusy(false);
    }
  };

  return (
    <div
      className="sticky bottom-0 z-40 w-full bg-gradient-to-t from-vox-bg via-vox-bg to-transparent px-4 pb-6 pt-10 md:px-6"
      data-testid="input-bar"
    >
      <div className="relative mx-auto max-w-3xl">
        <AnimatePresence>
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -top-2 left-0 right-0 h-[3px] overflow-hidden rounded-full bg-vox-s2"
              data-testid="input-progress"
            >
              <motion.div
                className="h-full w-1/3 rounded-full bg-vox-primary"
                animate={{ x: ["-120%", "320%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex items-center gap-3 rounded-2xl border border-vox-border bg-vox-s1/90 p-3 shadow-2xl backdrop-blur-xl">
          <VoiceButton />

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.markdown,.json,.csv,.yaml,.yml"
            onChange={handleFile}
          />

          <input
            ref={imageInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleImage}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-vox-border bg-white/[0.04] text-vox-muted transition hover:border-aqua/35 hover:bg-aqua/10 hover:text-aqua disabled:opacity-50"
            aria-label="Upload requirements"
            title="Upload requirements"
          >
            <FileUp size={19} />
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-vox-border bg-white/[0.04] text-vox-muted transition hover:border-brand/35 hover:bg-brand/10 hover:text-brand disabled:opacity-50"
            aria-label="Attach image context"
            title="Attach image context"
          >
            <ImagePlus size={19} />
          </button>

          <button
            type="button"
            onClick={captureScreen}
            disabled={disabled || !navigator.mediaDevices?.getDisplayMedia}
            className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border border-vox-border bg-white/[0.04] text-vox-muted transition hover:border-aqua/35 hover:bg-aqua/10 hover:text-aqua disabled:opacity-50 sm:grid"
            aria-label="Capture screen context"
            title="Capture screen context"
          >
            <MonitorUp size={19} />
          </button>

          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={
              viewingSessionId ? "Viewing a past conversation..." : "Or type here..."
            }
            className="flex-1 bg-transparent px-2 text-base text-vox-text outline-none placeholder:text-vox-muted disabled:opacity-50"
            data-testid="text-input"
          />

          <button
            type="button"
            onClick={send}
            disabled={disabled || !text.trim()}
            className={[
              "grid h-11 w-11 place-items-center rounded-xl transition-all duration-200",
              disabled || !text.trim()
                ? "cursor-not-allowed bg-vox-s2 text-vox-muted"
                : "bg-vox-primary text-white hover:scale-105 hover:brightness-110",
            ].join(" ")}
            data-testid="send-button"
            aria-label="Send"
          >
            <ArrowUp size={20} />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={toggleAutopilot}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
              settings.autopilotEnabled
                ? "border-leaf/25 bg-leaf/10 text-leaf"
                : "border-vox-border bg-white/[0.04] text-vox-muted"
            }`}
            aria-pressed={settings.autopilotEnabled}
            title="Toggle autopilot"
          >
            <Bot className="h-3.5 w-3.5" />
            Autopilot {settings.autopilotEnabled ? "on" : "off"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputBar;
