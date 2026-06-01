// ============================================
// VoxMind Mobile — Modules Screen
// ============================================
// Shows the 12 module grid matching the desktop workspace

import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from "react-native";

const modules = [
  { id: "chat", label: "Chat", emoji: "💬", color: "#06b6d4" },
  { id: "task", label: "Tasks", emoji: "📋", color: "#f59e0b" },
  { id: "write", label: "Write", emoji: "✨", color: "#8b5cf6" },
  { id: "search", label: "Search", emoji: "🔍", color: "#06b6d4" },
  { id: "health", label: "Health", emoji: "❤️", color: "#ef4444" },
  { id: "finance", label: "Finance", emoji: "💰", color: "#10b981" },
  { id: "learn", label: "Learn", emoji: "🎓", color: "#f59e0b" },
  { id: "home", label: "Home", emoji: "🏠", color: "#06b6d4" },
  { id: "travel", label: "Travel", emoji: "✈️", color: "#8b5cf6" },
  { id: "media", label: "Media", emoji: "🎬", color: "#f43f5e" },
  { id: "translate", label: "Translate", emoji: "🌐", color: "#10b981" },
  { id: "business", label: "Business", emoji: "💼", color: "#8b5cf6" },
];

export default function ModulesScreen() {
  const [selected, setSelected] = useState(null);
  const [input, setInput] = useState("");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workspace Modules</Text>
      <Text style={styles.subtitle}>12 intelligent modules for every task</Text>

      <View style={styles.grid}>
        {modules.map((mod) => (
          <TouchableOpacity
            key={mod.id}
            style={[
              styles.moduleCard,
              selected === mod.id && { borderColor: mod.color, backgroundColor: `${mod.color}15` },
            ]}
            onPress={() => setSelected(selected === mod.id ? null : mod.id)}
          >
            <Text style={styles.emoji}>{mod.emoji}</Text>
            <Text style={[styles.moduleLabel, selected === mod.id && { color: mod.color }]}>
              {mod.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selected && (
        <View style={styles.moduleDetail}>
          <Text style={styles.detailTitle}>
            {modules.find((m) => m.id === selected)?.emoji}{" "}
            {modules.find((m) => m.id === selected)?.label}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={`What would you like to do in ${selected}?`}
            placeholderTextColor="#64748b"
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity style={styles.goButton}>
            <Text style={styles.goText}>Send to AI →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a1a" },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: "800", color: "#e2e8f0", marginTop: 10 },
  subtitle: { fontSize: 13, color: "#94a3b8", marginTop: 4, marginBottom: 20 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moduleCard: {
    width: "30%",
    aspectRatio: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emoji: { fontSize: 24 },
  moduleLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },

  moduleDetail: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  detailTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  input: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    color: "#e2e8f0",
    fontSize: 14,
    marginBottom: 12,
  },
  goButton: {
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  goText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
