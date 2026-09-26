module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated 4 moveu o plugin do worklets pra fora do próprio pacote.
    plugins: ["react-native-worklets/plugin"],
  };
};
