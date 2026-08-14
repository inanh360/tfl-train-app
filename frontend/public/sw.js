// This runs in the background, separate from the page itself, which is
// what lets a notification appear even when no tab has the site open.

self.addEventListener("push", (event) => {
  let data = { title: "Line Status", body: "Something you're tracking has updated." };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // Fall back to the default above if the payload isn't valid JSON for
    // some reason — better to show a generic notification than none at all.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.png",
      badge: "/icon.png",
    })
  );
});

// Clicking the notification focuses an existing tab if one's open, or
// opens a new one, rather than just dismissing silently.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
