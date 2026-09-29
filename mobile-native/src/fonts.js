// Font family names as registered by @expo-google-fonts, plus the loader map
// consumed by useFonts() in App. RN needs the exact PostScript-ish key, unlike
// the web app's CSS font-family stacks.

// One import per weight, not one per family.
//
// Importing from the package root pulls in its index, which `require`s every
// weight it ships — and Metro bundles what it can see, not what is used. The
// two packages hold 32 files between them; this app loads 8. Measured in an
// export: 2706 KB of fonts in the app, 675 KB of them ever read.
//
// The subdirectories exist for exactly this. Adding a weight means adding a
// line here, which is the right amount of friction for something that costs
// 70-90 KB of download each.
import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";

export const FONT_MAP = {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

// Semantic aliases used throughout the RN UI.
export const FONT = {
  display: "Fraunces_700Bold",       // editorial headings
  displaySemi: "Fraunces_600SemiBold",
  body: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
};
