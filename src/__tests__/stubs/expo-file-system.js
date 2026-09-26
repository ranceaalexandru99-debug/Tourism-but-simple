// Stand-in for the ROOT entry point of expo-file-system — the one that stopped
// working in SDK 54 and that this app imported anyway for months.
//
// What the real package does there:
//   • documentDirectory, cacheDirectory and EncodingType are simply GONE, so
//     reading them gives undefined. `documentDirectory + "memories/"` becomes
//     the string "undefinedmemories/".
//   • copyAsync, getInfoAsync, makeDirectoryAsync, readAsStringAsync and
//     writeAsStringAsync are still exported, and THROW when called. The package
//     says so itself: "@deprecated … This method will throw in runtime."
//
// The old stub made all of it work, which is precisely why the suite stayed
// green while the album, the short renderer and photo storage were broken on a
// real phone. This stub tells the truth instead. Anything that needs the working
// API imports "expo-file-system/legacy", which has its own stub.
//
// The new File/Directory API is deliberately not stubbed here: nothing in the
// app uses it yet, and inventing a shape for it would be guessing.

const deprecated = (name) => () => {
  throw new Error(
    `Method ${name} imported from "expo-file-system" is deprecated and throws at ` +
    `runtime. Import it from "expo-file-system/legacy", or migrate to the ` +
    `File/Directory API.`,
  );
};

export const copyAsync = deprecated("copyAsync");
export const getInfoAsync = deprecated("getInfoAsync");
export const makeDirectoryAsync = deprecated("makeDirectoryAsync");
export const readAsStringAsync = deprecated("readAsStringAsync");
export const writeAsStringAsync = deprecated("writeAsStringAsync");
export const deleteAsync = deprecated("deleteAsync");
export const moveAsync = deprecated("moveAsync");
export const readDirectoryAsync = deprecated("readDirectoryAsync");
export const downloadAsync = deprecated("downloadAsync");
export const uploadAsync = deprecated("uploadAsync");
export const getContentUriAsync = deprecated("getContentUriAsync");
