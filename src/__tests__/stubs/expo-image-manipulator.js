// Stand-in for expo-image-manipulator. Reports a fixed source size so the
// resize decisions can be tested; `fail` makes it throw like a bad image.
export const SaveFormat = { JPEG: "jpeg", PNG: "png" };
export const state = { width: 4000, height: 3000, fail: false, resizes: [] };

const ref = (w, h) => ({
  width: w,
  height: h,
  saveAsync: async () => ({ base64: "AAAA", uri: "file:///x.jpg" }),
});

export const ImageManipulator = {
  manipulate(uri) {
    if (state.fail) throw new Error("bad image");
    const chain = {
      resize({ width }) { state.resizes.push(width); return { renderAsync: async () => ref(width, Math.round(width * state.height / state.width)) }; },
      renderAsync: async () => ({ ...ref(state.width, state.height), resize: chain.resize }),
    };
    return chain;
  },
};
