const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo: watchFolders precisa alcançar o node_modules da raiz (bun instala num store
// content-addressed e linka por symlink — sem isso o Metro não indexa o alvo real do link).
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;

// `expo-sqlite` no web carrega o wa-sqlite via `.wasm` (worker.ts faz `import "./wa-sqlite.wasm"`)
// — sem isso no `assetExts`, o Metro tenta resolver como módulo JS e `expo export --platform web`
// quebra em qualquer tela que toque `expo-sqlite` (Onda 5: histórico e nota, além do carrinho).
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

module.exports = withNativeWind(config, { input: "./global.css" });
