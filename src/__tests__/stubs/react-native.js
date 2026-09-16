// Stand-in for react-native, enough for the logic modules. The real package is
// Flow-typed source that vitest cannot parse, and none of what is tested here
// needs a renderer.
export const Platform = { OS: "android", select: (o) => o.android ?? o.default };
export const StyleSheet = {
  create: (s) => s,
  absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  flatten: (s) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s || {}),
};
export const Alert = { alert: () => {} };
export const Share = { share: async () => ({ action: "sharedAction" }) };
export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
