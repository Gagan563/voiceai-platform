// ============================================
// VoxMind Mobile — Settings Screen
// ============================================

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from "react-native";
import { healthCheck, getConnectors } from "../services/api";

export default function SettingsScreen() {
  const [health, setHealth] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [h, c] = await Promise.allSettled([healthCheck(), getConnectors()]);
      if (h.status === "fulfilled") setHealth(h.value);
      if (c.status === "fulfilled") setConnectors(c.value?.connectors || []);
    } catch {}
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Server Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Server Status</Text>
        {health ? (
          <>
            <Row label="Status" value={health.status} color="#10b981" />
            <Row label="AI Engine" value={health.ai_engine} color="#a78bfa" />
            <Row label="Version" value={health.version} />
          </>
        ) : (
          <Text style={styles.offline}>⚠️ Backend not reachable</Text>
        )}
        <TouchableOpacity style={styles.refreshBtn} onPress={loadStatus}>
          <Text style={styles.refreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* TTS */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Text-to-Speech</Text>
          <Switch
            value={ttsEnabled}
            onValueChange={setTtsEnabled}
            trackColor={{ false: "#334155", true: "#8b5cf6" }}
            thumbColor={ttsEnabled ? "#fff" : "#94a3b8"}
          />
        </View>
      </View>

      {/* Connectors */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>MCP Connectors</Text>
        {connectors.length > 0 ? (
          connectors.map((c) => (
            <View key={c.id} style={styles.connectorRow}>
              <View style={[styles.dot, c.configured ? styles.dotGreen : styles.dotRed]} />
              <Text style={styles.connectorName}>{c.name}</Text>
              <Text style={styles.connectorStatus}>{c.configured ? "Connected" : "Not configured"}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No connectors found</Text>
        )}
      </View>

      {/* About */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.muted}>VoxMind v1.0.0</Text>
        <Text style={styles.muted}>Autonomous AI Voice Platform</Text>
        <Text style={styles.muted}>Built with Gemini AI</Text>
      </View>
    </ScrollView>
  );
}

function Row({ label, value, color }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a1a" },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: "800", color: "#e2e8f0", marginTop: 10, marginBottom: 20 },

  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { color: "#a78bfa", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  detailLabel: { color: "#94a3b8", fontSize: 13 },
  detailValue: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },

  offline: { color: "#f87171", fontSize: 13, marginBottom: 8 },
  muted: { color: "#64748b", fontSize: 12, marginBottom: 4 },

  refreshBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
  },
  refreshText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },

  connectorRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  dotGreen: { backgroundColor: "#10b981" },
  dotRed: { backgroundColor: "#ef4444" },
  connectorName: { color: "#e2e8f0", fontSize: 13, fontWeight: "600", flex: 1 },
  connectorStatus: { color: "#64748b", fontSize: 11 },
});
