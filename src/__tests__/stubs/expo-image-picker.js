// Stand-in for expo-image-picker. Tests set `next` to decide what the picker
// returns; by default it behaves as though the user cancelled.
export const next = { permission: { granted: true }, result: { canceled: true } };

export const requestCameraPermissionsAsync = async () => next.permission;
export const requestMediaLibraryPermissionsAsync = async () => next.permission;
export const launchCameraAsync = async () => next.result;
export const launchImageLibraryAsync = async () => next.result;
