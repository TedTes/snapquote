import { useCallback, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { Platform } from "react-native";
import { snapquoteApi } from "../api/client";
import { useAuthStore } from "../state/authStore";

const easProjectId = "cc2bb629-9196-43f6-8a6d-4612eb3ae09e";

Notifications.setNotificationHandler({
  handleNotification: () => Promise.resolve({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export function usePushNotifications() {
  const status = useAuthStore((state) => state.status);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseId = useRef<string | null>(null);
  const openNotification = useCallback((response: Notifications.NotificationResponse) => {
    const request = response.notification.request;
    if (handledResponseId.current === request.identifier) return;
    handledResponseId.current = request.identifier;
    if (request.content.data["type"] === "website_request") router.push("/requests" as Href);
  }, []);

  useEffect(() => {
    if (status !== "signed_in" || (Platform.OS !== "ios" && Platform.OS !== "android")) return;

    let active = true;
    const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";

    async function register() {
      try {
        if (Platform.OS === "android") {
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

    void register();
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);

    return () => subscription.remove();
  }, [openNotification]);

  useEffect(() => {
    if (lastResponse) openNotification(lastResponse);
  }, [lastResponse, openNotification]);
}
