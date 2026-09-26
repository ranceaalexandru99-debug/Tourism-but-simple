// Stand-in for expo-file-system/legacy — the entry point that still WORKS.
// Records what was asked of it so tests can assert on the calls, and lets a test
// make any of them fail.
//
// Its sibling, expo-file-system.js, stubs the root entry point and throws, the
// way the real package has since SDK 54. Keeping them apart is what makes a
// wrong import visible to a test instead of only on a phone.
export const cacheDirectory = "file:///cache/";
export const documentDirectory = "file:///docs/";
export const EncodingType = { Base64: "base64", UTF8: "utf8" };

export const calls = [];
export const failures = new Map();   // method name -> Error to throw

const record = async (name, ...args) => {
  calls.push({ name, args });
  const err = failures.get(name);
  if (err) throw err;
};

export const getInfoAsync = async (uri) => {
  await record("getInfoAsync", uri);
  return { exists: true, uri };
};
export const makeDirectoryAsync = (...a) => record("makeDirectoryAsync", ...a);
export const copyAsync = (...a) => record("copyAsync", ...a);
export const writeAsStringAsync = (...a) => record("writeAsStringAsync", ...a);
export const readAsStringAsync = async (...a) => { await record("readAsStringAsync", ...a); return "ZmFrZQ=="; };
export const deleteAsync = (...a) => record("deleteAsync", ...a);
