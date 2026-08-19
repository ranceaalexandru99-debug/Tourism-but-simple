// Trip memory gallery for native. Photos are captured with expo-image-picker,
// then COPIED into the app's document directory before we store the path —
// the picker hands back a cache URI, and the OS is free to purge that (or an
// app update wipes it), which turned saved memories into broken tiles.
// Metadata lives in the localStorage polyfill (AsyncStorage-backed).

import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

const PHOTO_DIR = FileSystem.documentDirectory + "memories/";

// Move a picked photo out of the volatile cache into permanent app storage.
// Falls back to the original URI if the copy fails — a temporary photo beats
// no photo, and the caller can't do anything better.
async function persistPhotoFile(uri) {
  try {
    const info = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    const ext = (uri.split("?")[0].match(/\.(\w{3,4})$/) || [, "jpg"])[1];
    const dest = `${PHOTO_DIR}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

const KEY = "vai_gallery_meta";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const persist = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };

// Launch the camera (or library) and return a durable photo path.
// Returns null when the user cancels, or "denied" when permission is refused —
// distinct so the caller can explain itself instead of appearing to do nothing.
export async function pickPhoto(fromCamera = true) {
  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return "denied";
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  return persistPhotoFile(res.assets[0].uri);
}

export function listMemories() {
  return load().sort((a, b) => b.ts - a.ts);
}

export function addMemory(memory) {
  const list = load();
  list.unshift(memory);
  persist(list);
  return memory;
}

export function deleteMemory(id) {
  persist(load().filter((m) => m.id !== id));
}

// Wipe every stored photo memory. Used by "erase all data on this device".
export function clearAllMemories() {
  try { localStorage.removeItem(KEY); } catch {}
}
