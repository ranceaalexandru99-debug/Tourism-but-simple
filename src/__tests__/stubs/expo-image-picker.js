// Stand-in for expo-image-picker. Tests set `next` to decide what the picker
// returns; by default it behaves as though the user cancelled.
//
// `calls` records which functions were reached, so a test can assert that the
// library path asks for no permission at all — the kind of thing that is
// invisible in a return value.
export const next = { permission: { granted: true }, result: { canceled: true }, throws: null };
export const calls = [];

const record = (name) => { calls.push(name); };

export const requestCameraPermissionsAsync = async () => {
  record("requestCameraPermissionsAsync");
  return next.permission;
};
export const requestMediaLibraryPermissionsAsync = async () => {
  record("requestMediaLibraryPermissionsAsync");
  return next.permission;
};
export const launchCameraAsync = async () => {
  record("launchCameraAsync");
  if (next.throws) throw next.throws;
  return next.result;
};
export const launchImageLibraryAsync = async () => {
  record("launchImageLibraryAsync");
  if (next.throws) throw next.throws;
  return next.result;
};
