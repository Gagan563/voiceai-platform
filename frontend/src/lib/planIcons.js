import { Bell, Calendar, Search, Send, Sparkles } from "lucide-react";

export const actionIcon = (type) => {
  const map = {
    schedule: Calendar,
    remind: Bell,
    search: Search,
    message: Send,
    general: Sparkles,
  };

  return map[type] || Sparkles;
};

export const actionLabel = (type) =>
  ({
    schedule: "Schedule",
    remind: "Reminder",
    search: "Search",
    message: "Message",
    general: "Task",
  })[type] || "Task";
