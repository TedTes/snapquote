import { useCallback, useEffect, useRef } from "react";
import { router } from "expo-router";
import { NativeModules, Platform } from "react-native";
import { snapquoteApi } from "../api/client";
import { useAuthStore } from "../state/authStore";

type NotificationsModule = typeof import("expo-notifications");
type NotificationResponse = import("expo-notifications").NotificationResponse;
type ExpoNativeGlobal = typeof globalThis & {
  expo?: {
    modules?: Record<string, unknown>;
  };
};
type LegacyNativeProxy = {
  exportedMethods?: Record<string, unknown>;
  modulesConstants?: Record<string, unknown>;
};

const easProjectId = "cc2bb629-9196-43f6-8a6d-4612eb3ae09e";

export function usePushNotifications() {
  const status = useAuthStore((state) => state.status);
  const handledResponseId = useRef<string | null>(null);
  const openNotification = useCallback((response: NotificationResponse) => {
    const request = response.notification.request;
    if (handledResponseId.current === request.identifier) return;
    handledResponseId.current = request.identifier;
    if (request.content.data["type"] === "website_request") router.push("/requests");
  }, []);

  useEffect(() => {
    if (status !== "signed_in" || (Platform.OS !== "ios" && Platform.OS !== "android")) return;

    let active = true;
    let responseSubscription: { remove: () => void } | null = null;
    const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";

    async function setup() {
      const Notifications = await loadNotifications();
      if (!Notifications || !active) return;

      Notifications.setNotificationHandler({
        handleNotification: () => Promise.resolve({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true
        })
      });
      responseSubscription = Notifications.addNotificationResponseReceivedListener(openNotification);

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse && active) openNotification(lastResponse);

      try {
        if (platform === "android") {
          await Notifications.setNotificationChannelAsync("requests", {
            name: "Quote requests",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 150, 250]
          });
        }

        const existing = await Notifications.getPermissionsAsync();
        const permission = existing.status === Notifications.PermissionStatus.GRANTED
          ? existing
          : await Notifications.requestPermissionsAsync();
        if (permission.status !== Notifications.PermissionStatus.GRANTED || !active) return;

        const token = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId });
        if (!active) return;
        await snapquoteApi.registerPushToken({ token: token.data, platform });
      } catch (error) {
        console.warn("QuoteVan push registration failed", error);
      }
    }

    void setup();
    return () => {
      active = false;
      responseSubscription?.remove();
    };
  }, [openNotification, status]);
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!hasNativeExpoModule("ExpoPushTokenManager")) return null;

  try {
    return await import("expo-notifications");
  } catch (error) {
    console.warn("QuoteVan notifications unavailable in this app build", error);
    return null;
  }
}

function hasNativeExpoModule(moduleName: string) {
  const expoModules = (globalThis as ExpoNativeGlobal).expo?.modules;

  if (expoModules?.[moduleName]) return true;

  const nativeProxy = NativeModules.NativeUnimoduleProxy as LegacyNativeProxy | undefined;
  return Boolean(
    nativeProxy?.exportedMethods?.[moduleName] ||
    nativeProxy?.modulesConstants?.[moduleName]
  );
}
