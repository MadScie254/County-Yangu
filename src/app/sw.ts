/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "COUNTY_YANGU_SYNC_READY") {
    self.registration.showNotification("County Yangu", {
      body: "Saved actions will sync when the connection returns.",
      icon: "/icons/county-yangu.svg",
    });
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "County Yangu",
    body: "Your ward has a new public update.",
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/county-yangu.svg",
      badge: "/icons/county-yangu.svg",
      data: { url: data.url ?? "/en/pulse" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/en";
  event.waitUntil(self.clients.openWindow(url));
});

serwist.addEventListeners();
