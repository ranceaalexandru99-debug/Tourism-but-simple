// Stand-in for expo-sharing. `available` decides whether the OS offers a share
// sheet — the "saved" rather than "shared" path the app has to report.
export const state = { available: true, shared: [] };
export const isAvailableAsync = async () => state.available;
export const shareAsync = async (uri, opts) => { state.shared.push({ uri, opts }); };
