import { Slot } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Archivo400Regular from "../../assets/fonts/Archivo_400Regular.ttf";
import Archivo500Medium from "../../assets/fonts/Archivo_500Medium.ttf";
import Archivo600SemiBold from "../../assets/fonts/Archivo_600SemiBold.ttf";
import Archivo700Bold from "../../assets/fonts/Archivo_700Bold.ttf";
import Archivo800ExtraBold from "../../assets/fonts/Archivo_800ExtraBold.ttf";
import { AuthGate } from "../screens/auth/AuthGate";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular: Archivo400Regular,
    Archivo_500Medium: Archivo500Medium,
    Archivo_600SemiBold: Archivo600SemiBold,
    Archivo_700Bold: Archivo700Bold,
    Archivo_800ExtraBold: Archivo800ExtraBold
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Slot />
      </AuthGate>
    </SafeAreaProvider>
  );
}
