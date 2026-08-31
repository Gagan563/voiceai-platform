/**
 * NOVA VoiceAI — Browser Notification Manager
 */

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission !== "denied") {
    const perm = await Notification.requestPermission();
    return perm === "granted";
  }
  return false;
}

export function sendLocalNotification(title, options = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  const notification = new Notification(title, {
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    silent: false,
    ...options,
  });

  notification.onclick = () => {
    window.focus();
    if (options.onClick) options.onClick();
    notification.close();
  };

  return notification;
}
