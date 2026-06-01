// ============================================
// VoxMind Mobile — Home Screen
// ============================================
// Main voice interaction screen:
// Record → Transcribe → Intent → Plan → Execute

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { extractIntent, generatePlan, executePlan } from "../services/api";

const STAGES = ["idle", "recording", "transcribing", "extracting", "planning", "executing", "done"];

export default function HomeScreen() {
  const [stage, setStage] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState(null);
  const [plan, setPlan] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const reset = () => {
    setStage("idle");
    setTranscript("");
    setIntent(null);
    setPlan([]);
    setResult(null);
    setError(null);
  };

  // Simulated recording (real impl needs react-native-audio-recorder-player)
  const handleRecord = async () => {
    try {
      setStage("recording");
      setError(null);

      // Simulate recording for 2 seconds
      await new Promise((r) => setTimeout(r, 2000));
      setStage("transcribing");

      // For now, use a demo transcript
      // Real implementation:
      // const filePath = await recorder.stopRecorder();
      // const { transcript } = await transcribeAudio(filePath);
      const demoTranscript = "Schedule a meeting with Sarah next Tuesday at 3pm";
      setTranscript(demoTranscript);

      // Extract intent
      setStage("extracting");
      const intentResult = await extractIntent(demoTranscript);
      setIntent(intentResult.intent);

      // Generate plan
      setStage("planning");
      const planResult = await generatePlan(intentResult.intent);
      const planSteps = planResult.plan || planResult.steps || [];
      setPlan(planSteps);

      setStage("done");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Something went wrong");
      setStage("idle");
    }
  };

  const handleExecute = async () => {
    try {
      setStage("executing");
      const execResult = await executePlan(plan);
      setResult(execResult);
      setStage("done");
      Alert.alert("Done!", execResult.message || "Plan executed successfully.");
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setStage("done");
    }
  };

  const handleTextInput = async (text) => {
    try {
      setStage("extracting");
      setTranscript(text);
      setError(null);

      const intentResult = await extractIntent(text);
      setIntent(intentResult.intent);

      setStage("planning");
      const planResult = await generatePlan(intentResult.intent);
      setPlan(planResult.plan || planResult.steps || []);

      setStage("done");
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setStage("idle");
    }
  };

  const isProcessing = ["recording", "transcribing", "extracting", "planning", "executing"].includes(stage);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>✦ VoxMind</Text>
        <Text style={styles.subtitle}>Autonomous AI Assistant</Text>
      </View>

      {/* Status */}
      {isProcessing && (
        <View style={styles.statusBar}>
          <ActivityIndicator size="small" color="#a78bfa" />
          <Text style={styles.statusText}>
            {stage === "recording" && "Recording..."}
            {stage === "transcribing" && "Transcribing audio..."}
            {stage === "extracting" && "Understanding your request..."}
            {stage === "planning" && "Creating a plan..."}
            {stage === "executing" && "Executing plan..."}
          </Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Voice Button */}
      <TouchableOpacity
        style={[styles.voiceButton, stage === "recording" && styles.voiceButtonActive]}
        onPress={stage === "idle" || stage === "done" ? handleRecord : null}
        disabled={isProcessing && stage !== "recording"}
      >
        <Text style={styles.voiceIcon}>{stage === "recording" ? "⏹" : "🎤"}</Text>
        <Text style={styles.voiceLabel}>
          {stage === "recording" ? "Recording..." : "Tap to speak"}
        </Text>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {["Schedule a meeting", "Search for news", "Translate hello to Spanish"].map((text) => (
          <TouchableOpacity
            key={text}
            style={styles.quickButton}
            onPress={() => handleTextInput(text)}
            disabled={isProcessing}
          >
            <Text style={styles.quickText}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transcript */}
      {transcript ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transcript</Text>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>
      ) : null}

      {/* Intent */}
      {intent ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intent</Text>
          <View style={styles.intentRow}>
            <Text style={styles.intentLabel}>Goal:</Text>
            <Text style={styles.intentValue}>{intent.goal}</Text>
          </View>
          <View style={styles.intentRow}>
            <Text style={styles.intentLabel}>Module:</Text>
            <Text style={styles.intentBadge}>{intent.module}</Text>
          </View>
          <View style={styles.intentRow}>
            <Text style={styles.intentLabel}>Action:</Text>
            <Text style={styles.intentBadge}>{intent.action_type}</Text>
          </View>
        </View>
      ) : null}

      {/* Plan */}
      {plan.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan ({plan.length} steps)</Text>
          {plan.map((step, i) => (
            <View key={step.id || i} style={styles.planStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step.description}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.executeButton}
            onPress={handleExecute}
            disabled={stage === "executing"}
          >
            <Text style={styles.executeButtonText}>
              {stage === "executing" ? "Executing..." : "▶ Execute Plan"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Reset */}
      {(stage === "done" || error) && (
        <TouchableOpacity style={styles.resetButton} onPress={reset}>
          <Text style={styles.resetText}>Start Over</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a1a" },
  content: { padding: 20, paddingBottom: 60 },
  header: { alignItems: "center", marginBottom: 30, marginTop: 20 },
  logo: { fontSize: 28, fontWeight: "800", color: "#a78bfa" },
  subtitle: { fontSize: 13, color: "#94a3b8", marginTop: 4 },

  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(139,92,246,0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
  },
  statusText: { color: "#a78bfa", fontSize: 13, fontWeight: "600" },

  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  errorText: { color: "#f87171", fontSize: 13 },

  voiceButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.3)",
    alignSelf: "center",
    marginBottom: 24,
  },
  voiceButtonActive: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.4)",
  },
  voiceIcon: { fontSize: 36 },
  voiceLabel: { color: "#94a3b8", fontSize: 11, marginTop: 4, fontWeight: "600" },

  quickActions: { marginBottom: 24 },
  quickButton: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  quickText: { color: "#e2e8f0", fontSize: 13, fontWeight: "500" },

  section: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { color: "#a78bfa", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },

  transcriptText: { color: "#e2e8f0", fontSize: 14, fontStyle: "italic", lineHeight: 22 },

  intentRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  intentLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "600", width: 60 },
  intentValue: { color: "#e2e8f0", fontSize: 13, flex: 1 },
  intentBadge: {
    color: "#a78bfa",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(139,92,246,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },

  planStep: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(139,92,246,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  stepNumberText: { color: "#a78bfa", fontSize: 11, fontWeight: "800" },
  stepText: { color: "#e2e8f0", fontSize: 13, flex: 1, lineHeight: 20 },

  executeButton: {
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  executeButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  resetButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  resetText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
});
