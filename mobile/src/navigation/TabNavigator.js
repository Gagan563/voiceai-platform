// ============================================
// VoxMind Mobile — Tab Navigation
// ============================================

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import ModulesScreen from "../screens/ModulesScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0f0f1a",
          borderTopColor: "rgba(255,255,255,0.06)",
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#a78bfa",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: "Voice", tabBarIcon: () => null }}
      />
      <Tab.Screen
        name="Modules"
        component={ModulesScreen}
        options={{ tabBarLabel: "Modules", tabBarIcon: () => null }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: "Settings", tabBarIcon: () => null }}
      />
    </Tab.Navigator>
  );
}
