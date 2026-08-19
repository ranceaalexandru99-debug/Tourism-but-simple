import { Component } from "react";
import { View, Text, Pressable } from "react-native";
import { report } from "../lib/monitor.js";

// Last-resort catch for render-time errors: instead of a dead white screen,
// the user gets a friendly recovery card and a retry button that re-mounts
// the tree. Sits OUTSIDE the theme/i18n providers (an error inside a provider
// must still render this), so colors and copy are self-contained — porcelain +
// antique gold to match the default theme, RO first with an EN echo.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    report("render", error?.message || String(error), info?.componentStack || error?.stack);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{
        flex: 1, backgroundColor: "#FBFAF7",
        alignItems: "center", justifyContent: "center", padding: 32,
      }}>
        <Text style={{ fontSize: 44, marginBottom: 14 }}>🧭</Text>
        <Text style={{ color: "#2A2C31", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
          Ceva n-a mers bine
        </Text>
        <Text style={{ color: "#777163", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 4 }}>
          Aplicația a întâmpinat o eroare neașteptată. Datele tale sunt în siguranță pe dispozitiv.
        </Text>
        <Text style={{ color: "#98917F", fontSize: 12, textAlign: "center", marginBottom: 24 }}>
          Something went wrong — your data is safe. Tap below to retry.
        </Text>
        <Pressable
          onPress={this.retry}
          style={({ pressed }) => ({
            backgroundColor: "#8B6E27", opacity: pressed ? 0.85 : 1,
            borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13,
          })}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Încearcă din nou</Text>
        </Pressable>
      </View>
    );
  }
}
