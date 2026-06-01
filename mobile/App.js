// ============================================
// VoxMind Mobile — App Entry Point
// ============================================

import React from "react";
import { StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import TabNavigator from "./src/navigation/TabNavigator";

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />
      <TabNavigator />
    </NavigationContainer>
  );
}
