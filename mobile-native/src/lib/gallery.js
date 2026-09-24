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
// Reports whether the write actually happened. Swallowing this meant a photo
// could be taken, appear in the grid, and then be gone on the next launch with
// nothing ever having said so — the same silent loss the web app was fixed for,
// which had never reached here.
const persist = (list) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
};

// Launch the camera, or the photo library, and return a durable photo path.
// Returns null when the user cancels, or "denied" when permission is refused —
// distinct so the caller can explain itself instead of appearing to do nothing.
//
// Only the camera asks for anything. The library deliberately does NOT call
// requestMediaLibraryPermissionsAsync: read the module's own Android source and
// launchImageLibraryAsync checks no permission at all, while the request
// resolves to an empty permission set on Android 13 and above. Below that it
// would ask for READ/WRITE_EXTERNAL_STORAGE — permissions this app blocks,
// because the picker hands back a URI it has already granted access to and
// nothing here ever reads the storage directly.
//
// So asking would have achieved one thing: a refusal on old phones for a
// permission the operation does not need.
export async function pickPhoto(fromCamera = true) {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return "denied";
  }
  let res;
  try {
    res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false });
  } catch {
    // No picker activity, or the OS refused to open one. Treated as a cancel:
    // the caller has nothing better to offer than letting the user try again.
    return null;
  }
  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  return persistPhotoFile(res.assets[0].uri);
}

export function listMemories() {
  return load().sort((a, b) => b.ts - a.ts);
}

// Returns false when the photo could not be stored, so the caller can say so.
export function addMemory(memory) {
  const list = load();
  list.unshift(memory);
  return persist(list);
}

export function deleteMemory(id) {
  persist(load().filter((m) => m.id !== id));
}

// Wipe every stored photo memory. Used by "erase all data on this device".
export function clearAllMemories() {
  try { localStorage.removeItem(KEY); } catch {}
}
