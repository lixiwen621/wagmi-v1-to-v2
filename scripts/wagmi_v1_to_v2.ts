/// <reference path="../types/codemod-ast-grep.d.ts" />
import type { Codemod, Edit } from "codemod:ast-grep";
import type Tsx from "codemod:ast-grep/langs/tsx";

/**
 * wagmi v1 → v2 Migration Codemod
 *
 * Handles common documented breaking changes:
 * - Hook renames (useContractRead → useReadContract, etc.)
 * - Connector renames and API changes
 * - Component renames (WagmiConfig → WagmiProvider)
 * - Import path changes
 * - Removed hooks and APIs
 * - Config structure changes
 * - Type renames
 */
interface Replacement {
  regex: string;
  new: string;
}

// --- Hook renames ---
const HOOK_RENAMES: Replacement[] = [
  { regex: "useContractReads", new: "useReadContracts" },
  { regex: "useContractRead", new: "useReadContract" },
  { regex: "useContractWrite", new: "useWriteContract" },
  { regex: "useContractEvent", new: "useWatchContractEvent" },
  { regex: "useContractInfiniteReads", new: "useInfiniteReadContracts" },
  { regex: "useFeeData", new: "useEstimateFeesPerGas" },
  { regex: "useSwitchNetwork", new: "useSwitchChain" },
  { regex: "useWaitForTransaction", new: "useWaitForTransactionReceipt" },
  { regex: "usePrepareContractWrite", new: "useSimulateContract" },
  { regex: "useNetwork", new: "useAccount" },
];

// --- Connector renames ---
const CONNECTOR_RENAMES: Replacement[] = [
  { regex: "^WalletConnectConnector$", new: "walletConnect" },
  { regex: "^CoinbaseWalletConnector$", new: "coinbaseWallet" },
  { regex: "^InjectedConnector$", new: "injected" },
  { regex: "^SafeConnector$", new: "safe" },
  { regex: "^MetaMaskConnector$", new: "injected" },
];

// --- Component renames ---
const COMPONENT_RENAMES: Replacement[] = [
  { regex: "^WagmiConfig$", new: "WagmiProvider" },
];

// --- Type renames ---
const TYPE_RENAMES: Replacement[] = [
  { regex: "^UseAccountConfig$", new: "UseAccountParameters" },
  { regex: "^UseAccountResult$", new: "UseAccountReturnType" },
  { regex: "^WagmiConfigProps$", new: "WagmiProviderProps" },
];

// --- ABI and utility renames ---
const ABI_RENAMES: Replacement[] = [
  { regex: "^erc20ABI$", new: "erc20Abi" },
];

// --- Import path changes ---
// NOTE: wagmi/providers/* imports are handled separately in Phase 3
// because the imported functions (publicProvider, alchemyProvider, jsonRpcProvider, etc.)
// do NOT exist in viem. We replace the entire import with a TODO comment.
const IMPORT_PATH_RENAMES: Array<{ from: string; to: string }> = [];

const codemod: Codemod<any> = async (root: any) => {
  const rootNode = root.root();
  const edits: Edit[] = [];
  let hasChanges = false;
  let requiresUseAccountEffectImport = false;
  let requiresTanStackQueryImport = false;

  const isWagmiImportStatementText = (text: string): boolean =>
    /from\s+['"]wagmi(?:\/[^'"]*)?['"]/.test(text);

  const getImportAncestor = (node: any): any | null => {
    for (const ancestor of node.ancestors()) {
      if (ancestor.kind() === "import_statement" || ancestor.kind() === "import_declaration") {
        return ancestor;
      }
    }
    return null;
  };

  const normalizeImportSource = (source: string): string => {
    for (const pathRepl of IMPORT_PATH_RENAMES) {
      if (source === pathRepl.from) return pathRepl.to;
    }
    if (/^wagmi\/connectors\/\w+$/.test(source)) {
      return "wagmi/connectors";
    }
    return source;
  };

  const shouldDeferImportSourceRewrite = (importStmt: any | null): boolean => {
    if (!importStmt) return false;
    const importText = importStmt.text().trim();
    if (!/^import\s+/.test(importText)) return false;
    if (!isWagmiImportStatementText(importText)) return false;
    return importText.includes("{");
  };

  const importNodes = [
    ...rootNode.findAll({ rule: { kind: "import_statement" } }),
  ];

  // Track local bindings that come from wagmi imports so we only rename
  // identifiers that are actually tied to wagmi symbols.
  const wagmiLocalBindings = new Set<string>();
  const localShadowedNames = new Set<string>();
  for (const importNode of importNodes) {
    const importText = importNode.text();
    if (!isWagmiImportStatementText(importText)) continue;

    const defaultMatch = importText.match(/^import\s+([A-Za-z_$][\w$]*)\s*(,|\s+from)/);
    if (defaultMatch) {
      wagmiLocalBindings.add(defaultMatch[1]);
    }

    const namedMatch = importText.match(/\{([^}]*)\}/);
    if (!namedMatch) continue;
    for (const rawSpecifier of namedMatch[1].split(",")) {
      const spec = rawSpecifier.trim();
      if (!spec) continue;
      const aliasMatch = spec.match(
        /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/
      );
      if (aliasMatch) {
        wagmiLocalBindings.add(aliasMatch[2]);
      } else {
        const bareMatch = spec.match(/^([A-Za-z_$][\w$]*)$/);
        if (bareMatch) wagmiLocalBindings.add(bareMatch[1]);
      }
    }
  }

  const localDeclNodes = rootNode.findAll({ rule: { kind: "identifier" } });
  const isLocalDeclarationIdentifier = (node: any): boolean => {
    const parent = node.parent();
    if (!parent) return false;
    const k = parent.kind();
    if (k === "import_specifier" || k === "namespace_import") return false;
    return (
      k === "variable_declarator" ||
      k === "function_declaration" ||
      k === "class_declaration" ||
      k === "formal_parameter" ||
      k === "required_parameter" ||
      k === "optional_parameter" ||
      k === "rest_parameter"
    );
  };
  for (const node of localDeclNodes) {
    if (isLocalDeclarationIdentifier(node)) {
      localShadowedNames.add(node.text());
    }
  }

  const renameSymbolExact = (name: string): string => {
    for (const repl of [
      ...TYPE_RENAMES,
      ...HOOK_RENAMES,
      ...CONNECTOR_RENAMES,
      ...COMPONENT_RENAMES,
      ...ABI_RENAMES,
    ]) {
      const isExact = repl.regex.startsWith("^") && repl.regex.endsWith("$");
      const pattern = isExact ? repl.regex.slice(1, -1) : repl.regex;
      if (name === pattern) return repl.new;
    }
    return name;
  };

  // --- Phase 0: Special cases that must run before generic renames ---

  // --- Phase 0a: useNetwork with { chains } destructuring → useConfig ---
  // useNetwork({ chains }) should become useConfig(), not useAccount().
  // Everything else (e.g. { chain }) stays as useAccount via Phase 1 rename.
  const requiresUseConfigImport = new Set<string>();
  // Track start positions of useNetwork calls already transformed so Phase 1 skips them
  const transformedUseNetworkPositions = new Set<number>();
  const useNetworkCallNodesChains = rootNode.findAll({
    rule: {
      pattern: "useNetwork($$$)",
    },
  });
  for (const node of useNetworkCallNodesChains) {
    const parent = node.parent();
    if (!parent || parent.kind() !== "variable_declarator") continue;
    const nameNode = parent.field("name");
    if (!nameNode) continue;
    const nameText = nameNode.text();
    if (/\bchains\b/.test(nameText)) {
      // This is `const { chains, ... } = useNetwork(...)` → useConfig()
      const openParen = node.text().indexOf("(");
      const closeParen = node.text().lastIndexOf(")");
      const args =
        openParen >= 0 && closeParen > openParen
          ? node.text().slice(openParen + 1, closeParen)
          : "";
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().end.index,
        insertedText: `useConfig(${args})`,
      });
      hasChanges = true;
      requiresUseConfigImport.add("useConfig");
      transformedUseNetworkPositions.add(node.range().start.index);
    }
  }

  // MetaMaskConnector → injected({ target: 'metaMask' })
  const mmNodes = rootNode.findAll({
    rule: {
      pattern: "new MetaMaskConnector($$$)",
    },
  });
  for (const node of mmNodes) {
    edits.push({
      startPos: node.range().start.index,
      endPos: node.range().end.index,
      insertedText: "injected({ target: 'metaMask' })",
    });
    hasChanges = true;
  }

  // WalletConnectLegacyConnector → walletConnect({})
  const wcLegacyNodes = rootNode.findAll({
    rule: {
      pattern: "new WalletConnectLegacyConnector($$$)",
    },
  });
  for (const node of wcLegacyNodes) {
    edits.push({
      startPos: node.range().start.index,
      endPos: node.range().end.index,
      insertedText: "walletConnect({ })",
    });
    hasChanges = true;
  }

  // --- Phase 0.5: Connector new expressions: new XxxConnector(args) → xxx(args) ---
  // Must use ORIGINAL names (before Phase 1 renames)
  const CONN_MAP: Record<string, string> = {
    WalletConnectConnector: "walletConnect",
    CoinbaseWalletConnector: "coinbaseWallet",
    InjectedConnector: "injected",
    SafeConnector: "safe",
  };
  for (const [origName, newName] of Object.entries(CONN_MAP)) {
    const nodes = rootNode.findAll({
      rule: {
        pattern: `new ${origName}($$$)`,
      },
    });
    for (const node of nodes) {
      const text = node.text();
      const openParen = text.indexOf("(");
      const args = text.slice(openParen);
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().end.index,
        insertedText: newName + args,
      });
      hasChanges = true;
    }
  }

  // --- Phase 1: Simple identifier replacements ---
  // Order matters: TYPE_RENAMES first (longer patterns), then others
  // to avoid overlap (e.g., WagmiConfig matches inside WagmiConfigProps)
  const allReplacements: Replacement[] = [
    ...TYPE_RENAMES,
    ...HOOK_RENAMES,
    ...CONNECTOR_RENAMES,
    ...COMPONENT_RENAMES,
    ...ABI_RENAMES,
  ];
  // Helper: find all identifier and type_identifier nodes matching regex
  const findIdentifierNodes = (regex: string): any[] => {
    const idNodes = rootNode.findAll({ rule: { kind: "identifier", regex } });
    const typeNodes = rootNode.findAll({ rule: { kind: "type_identifier", regex } });
    return [...idNodes, ...typeNodes];
  };

  for (const repl of allReplacements) {
    const nodes = findIdentifierNodes(repl.regex);
    for (const node of nodes) {
      const nodeText = node.text();
      // Skip if already modified by Phase 0/0.5 (new expression)
      const parent = node.parent();
      if (parent && parent.kind() === "new_expression") {
        continue;
      }

      // Ensure exact identifier match to avoid substring replacements.
      const actualPattern = repl.regex.replace(/^\^/, "").replace(/\$$/, "");
      if (nodeText !== actualPattern) {
        continue;
      }

      const importAncestor = getImportAncestor(node);
      const isInWagmiImport = importAncestor
        ? isWagmiImportStatementText(importAncestor.text())
        : false;

      // Import declarations are normalized in the dedicated merge/dedupe phase.
      if (isInWagmiImport) {
        continue;
      }

      // Skip useNetwork identifiers already transformed in Phase 0a ({ chains } → useConfig).
      if (repl.regex === "^useNetwork$" && transformedUseNetworkPositions.has(node.range().start.index)) {
        continue;
      }

      // Only rename symbols that are imported from wagmi.
      if (!wagmiLocalBindings.has(nodeText)) {
        continue;
      }

      // Conservative safety check: if the same identifier is declared locally
      // anywhere in the file, skip rename to avoid scope-shadowing false positives.
      if (localShadowedNames.has(nodeText)) {
        continue;
      }

      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().end.index,
        insertedText: repl.new,
      });
      hasChanges = true;
    }
  }

  // --- Phase 1b: Context → WagmiContext ---
  // Only when imported from wagmi (wagmiLocalBindings guard) to avoid FP.
  {
    const nodes = findIdentifierNodes("^Context$");
    for (const node of nodes) {
      if (node.text() !== "Context") continue;
      if (!wagmiLocalBindings.has("Context")) continue;
      if (localShadowedNames.has("Context")) continue;
      const importAncestor = getImportAncestor(node);
      if (importAncestor && isWagmiImportStatementText(importAncestor.text())) continue;
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().end.index,
        insertedText: "WagmiContext",
      });
      hasChanges = true;
    }
  }

  // --- Phase 1c: useSwitchNetwork destructuring variable rename ---
  // v1: const { switchNetwork } = useSwitchNetwork()
  // v2: const { switchChain } = useSwitchChain()
  const switchNetworkPatternNodes = [
    ...rootNode.findAll({ rule: { kind: "identifier", regex: "^switchNetwork$" } }),
    ...rootNode.findAll({ rule: { kind: "property_identifier", regex: "^switchNetwork$" } }),
    ...rootNode.findAll({
      rule: { kind: "shorthand_property_identifier", regex: "^switchNetwork$" },
    }),
    ...rootNode.findAll({
      rule: { kind: "shorthand_property_identifier_pattern", regex: "^switchNetwork$" },
    }),
  ];
  for (const node of switchNetworkPatternNodes) {
    const declarator = node.ancestors().find((a) => a.kind() === "variable_declarator");
    if (!declarator) continue;
    const init = declarator.field("value");
    if (!init || !/^\s*useSwitchChain\(/.test(init.text())) continue;
    edits.push({
      startPos: node.range().start.index,
      endPos: node.range().end.index,
      insertedText: "switchChain",
    });
    hasChanges = true;
  }

  // --- Phase 2: Import path changes ---
  // Only match string literals in import paths, NOT import_specifier nodes
  for (const pathRepl of IMPORT_PATH_RENAMES) {
    const escaped = pathRepl.from.replace(/\//g, "\\/");
    const nodes = rootNode.findAll({
      rule: {
        kind: "string",
        regex: escaped,
      },
    });
    for (const node of nodes) {
      const importStmt = getImportAncestor(node);
      // Safety: only rewrite import source strings, never ordinary string literals.
      if (!importStmt) {
        continue;
      }
      // Defer named wagmi imports to Phase 16 source normalization.
      if (shouldDeferImportSourceRewrite(importStmt)) {
        continue;
      }
      const text = node.text();
      const newText = text.replace(pathRepl.from, pathRepl.to);
      if (newText !== text) {
        edits.push({
          startPos: node.range().start.index,
          endPos: node.range().end.index,
          insertedText: newText,
        });
        hasChanges = true;
      }
    }
  }

  // --- Phase 3: wagmi/providers/* imports → TODO comment ---
  // Provider functions (publicProvider, alchemyProvider, infuraProvider, etc.)
  // do NOT exist in viem. Replace the entire import statement with a TODO.
  const PROVIDER_IMPORT_PATTERNS = [
    "wagmi/providers/public",
    "wagmi/providers/alchemy",
    "wagmi/providers/infura",
    "wagmi/providers/jsonRpc",
  ];
  for (const importNode of importNodes) {
    const importText = importNode.text();
    if (!isWagmiImportStatementText(importText)) continue;
    for (const providerPath of PROVIDER_IMPORT_PATTERNS) {
      const escapedPath = providerPath.replace(/\//g, "\\/");
      if (new RegExp(escapedPath).test(importText)) {
        edits.push({
          startPos: importNode.range().start.index,
          endPos: importNode.range().end.index,
          insertedText: `// TODO: ${providerPath} removed in wagmi v2, use http() transport from viem instead`,
        });
        hasChanges = true;
        break;
      }
    }
  }

  // --- Phase 3b: useSigner and useProvider removal → TODO comments ---
  // Removed in wagmi v2: useSigner → useWalletClient / useConnectorClient,
  // useProvider → usePublicClient
  for (const { hookName, v2Replacement, reason } of [
    { hookName: "useSigner", v2Replacement: "useWalletClient", reason: "useSigner removed in wagmi v2, use useWalletClient or useConnectorClient for wallet interactions" },
    { hookName: "useProvider", v2Replacement: "usePublicClient", reason: "useProvider removed in wagmi v2, use usePublicClient for RPC calls" },
    { hookName: "usePrepareSendTransaction", v2Replacement: "useSimulateContract + useWriteContract / useEstimateGas", reason: "usePrepareSendTransaction removed in wagmi v2, use useSimulateContract + useWriteContract or useEstimateGas depending on context" },
  ]) {
    // Detect call expressions: const signer = useSigner()
    const callNodes = rootNode.findAll({
      rule: {
        pattern: `${hookName}($$$)`,
      },
    });
    const shouldHandleHook =
      wagmiLocalBindings.has(hookName) && !localShadowedNames.has(hookName);
    for (const node of callNodes) {
      if (!shouldHandleHook) continue;
      let targetNode: any = node;
      for (const ancestor of node.ancestors()) {
        if (ancestor.kind() === "lexical_declaration" || ancestor.kind() === "expression_statement") {
          targetNode = ancestor;
          break;
        }
      }
      if (targetNode === node) {
        const vd = node.ancestors().find((a) => a.kind() === "variable_declarator");
        if (vd) targetNode = vd;
        else continue;
      }
      edits.push({
        startPos: targetNode.range().start.index,
        endPos: targetNode.range().end.index,
        insertedText: `// TODO: ${reason}`,
      });
      hasChanges = true;
    }

    // Also handle import specifier removal
    const importSpecNodes = rootNode.findAll({
      rule: {
        kind: "import_specifier",
        regex: `^${hookName}$`,
      },
    });
    for (const node of importSpecNodes) {
      const importStmt = getImportAncestor(node);
      if (!importStmt || !isWagmiImportStatementText(importStmt.text())) continue;
      const parent = node.parent();
      if (!parent || parent.kind() !== "named_imports") continue;
      const siblings = parent.children().filter((c) => c.kind() === "import_specifier");
      if (siblings.length <= 1) {
        const stmtText = importStmt.text().trim();
        const defaultWithNamedMatch = stmtText.match(
          /^import\s+((?:type\s+)?[A-Za-z_$][\w$]*)\s*,\s*\{[^}]*\}\s*from\s*(['"]wagmi(?:\/[^'"]*)?['"]);?$/
        );
        if (defaultWithNamedMatch) {
          edits.push({
            startPos: importStmt.range().start.index,
            endPos: importStmt.range().end.index,
            insertedText: `import ${defaultWithNamedMatch[1]} from ${defaultWithNamedMatch[2]}\n// TODO: ${reason}`,
          });
        } else {
          edits.push({
            startPos: importStmt.range().start.index,
            endPos: importStmt.range().end.index,
            insertedText: `// TODO: ${reason}`,
          });
        }
        hasChanges = true;
      } else {
        // Multiple specifiers — defer to Phase 16 import normalization
        continue;
      }
    }
  }

  // --- Phase 3c: ENS hooks — name normalization requirement → TODO ---
  // In wagmi v2, useEnsAddress/useEnsAvatar/useEnsName/useEnsResolver require manual
  // UTS-46 normalization via normalize() from 'viem/ens'.
  const ENS_HOOKS = ["useEnsAddress", "useEnsAvatar", "useEnsName", "useEnsResolver"];
  for (const hookName of ENS_HOOKS) {
    const callNodes = rootNode.findAll({
      rule: {
        pattern: `${hookName}($$$)`,
      },
    });
    const shouldHandleHook =
      wagmiLocalBindings.has(hookName) && !localShadowedNames.has(hookName);
    for (const node of callNodes) {
      if (!shouldHandleHook) continue;
      // Check if already has normalize() call in args
      const fullText = node.text();
      if (fullText.includes("normalize(")) continue;
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().start.index,
        insertedText: "// TODO: wrap ENS name with normalize() from 'viem/ens' in wagmi v2 (UTS-46 normalization required)\n",
      });
      hasChanges = true;
    }
  }

  // --- Phase 3d: useDisconnect/useConnect return type changes → TODO ---
  // In wagmi v2, useDisconnect returns a function directly (not an object).
  // useConnect returns { accounts, chainId } instead of v1's { account, chain, connector }.
  for (const { hookName, reason } of [
    { hookName: "useDisconnect", reason: "useDisconnect returns a function directly in wagmi v2, not an object — update destructuring" },
    { hookName: "useConnect", reason: "useConnect returns { accounts, chainId } in wagmi v2, not { account, chain, connector }" },
  ]) {
    const callNodes = rootNode.findAll({
      rule: {
        pattern: `${hookName}($$$)`,
      },
    });
    const shouldHandleHook =
      wagmiLocalBindings.has(hookName) && !localShadowedNames.has(hookName);
    for (const node of callNodes) {
      if (!shouldHandleHook) continue;
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().start.index,
        insertedText: `// TODO: ${reason}\n`,
      });
      hasChanges = true;
    }
  }

  // --- Phase 3e: wagmi/actions parameter changes → TODO ---
  // In wagmi v2, all action functions in wagmi/actions require config as first param:
  // getAccount() → getAccount(config), getWalletClient() → getWalletClient(config)
  for (const actionName of ["getAccount", "getWalletClient"]) {
    const callNodes = rootNode.findAll({
      rule: {
        pattern: `${actionName}($$$)`,
      },
    });
    for (const node of callNodes) {
      const importStmt = getImportAncestor(node);
      // Only flag if imported from wagmi/actions
      if (!importStmt || !/from\s+['"]wagmi\/actions['"]/.test(importStmt.text())) continue;
      const fullText = node.text();
      // Skip if already has config param
      const openParen = fullText.indexOf("(");
      const closeParen = fullText.lastIndexOf(")");
      const args = openParen >= 0 && closeParen > openParen ? fullText.slice(openParen + 1, closeParen).trim() : "";
      if (!args || args === "{}") {
        edits.push({
          startPos: node.range().start.index,
          endPos: node.range().start.index,
          insertedText: `// TODO: ${actionName}(config) now requires config as first param in wagmi v2\n`,
        });
        hasChanges = true;
      }
    }
  }

  // --- Phase 3a: useWebSocketPublicClient → TODO comment ---
  // Removed in wagmi v2, use useClient or usePublicClient instead
  const useWSPCNodes = rootNode.findAll({
    rule: {
      pattern: "useWebSocketPublicClient($$$)",
    },
  });
  const shouldHandleUseWSPC =
    wagmiLocalBindings.has("useWebSocketPublicClient") && !localShadowedNames.has("useWebSocketPublicClient");
  for (const node of useWSPCNodes) {
    if (!shouldHandleUseWSPC) continue;
    let targetNode: any = node;
    for (const ancestor of node.ancestors()) {
      if (ancestor.kind() === "lexical_declaration" || ancestor.kind() === "expression_statement") {
        targetNode = ancestor;
        break;
      }
    }
    if (targetNode === node) {
      const vd = node.ancestors().find((a) => a.kind() === "variable_declarator");
      if (vd) targetNode = vd;
      else continue;
    }
    edits.push({
      startPos: targetNode.range().start.index,
      endPos: targetNode.range().end.index,
      insertedText: "// TODO: useWebSocketPublicClient removed in wagmi v2, use useClient or usePublicClient with webSocket transport instead",
    });
    hasChanges = true;
  }
  // Also handle useWebSocketPublicClient import specifier
  const wsPCCallNodes = rootNode.findAll({
    rule: {
      kind: "import_specifier",
      regex: "useWebSocketPublicClient",
    },
  });
  for (const node of wsPCCallNodes) {
    const importStmt = getImportAncestor(node);
    if (!importStmt || !isWagmiImportStatementText(importStmt.text())) continue;
    const parent = node.parent();
    if (!parent || parent.kind() !== "named_imports") continue;
    const siblings = parent.children().filter((c) => c.kind() === "import_specifier");
    if (siblings.length <= 1) {
      const stmtText = importStmt.text().trim();
      const defaultWithNamedMatch = stmtText.match(
        /^import\s+((?:type\s+)?[A-Za-z_$][\w$]*)\s*,\s*\{[^}]*\}\s*from\s*(['"]wagmi(?:\/[^'"]*)?['"]);?$/
      );
      if (defaultWithNamedMatch) {
        edits.push({
          startPos: importStmt.range().start.index,
          endPos: importStmt.range().end.index,
          insertedText: `import ${defaultWithNamedMatch[1]} from ${defaultWithNamedMatch[2]}\n// TODO: useWebSocketPublicClient removed in wagmi v2, use useClient or usePublicClient with webSocket transport instead`,
        });
      } else {
        edits.push({
          startPos: importStmt.range().start.index,
          endPos: importStmt.range().end.index,
          insertedText: "// TODO: useWebSocketPublicClient removed in wagmi v2, use useClient or usePublicClient with webSocket transport instead",
        });
      }
      hasChanges = true;
    } else {
      // Skip cleanup when other specifiers share the import — Phase 16 will handle it
      // But we need to skip this specifier in Phase 16
      continue;
    }
  }

  // --- Phase 4: Connector entrypoint: wagmi/connectors/* → wagmi/connectors ---
  // Only match string literals (the import path), NOT import_specifier nodes
  const connPathNodes = rootNode.findAll({
    rule: {
      kind: "string",
      regex: "wagmi/connectors/",
    },
  });
  for (const node of connPathNodes) {
    const importStmt = getImportAncestor(node);
    // Safety: only rewrite import source strings, never ordinary string literals.
    if (!importStmt) {
      continue;
    }
    // Defer named wagmi imports to Phase 16 source normalization.
    if (shouldDeferImportSourceRewrite(importStmt)) {
      continue;
    }
    const text = node.text();
    const newText = text.replace(/wagmi\/connectors\/\w+/, "wagmi/connectors");
    if (newText !== text) {
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().end.index,
        insertedText: newText,
      });
      hasChanges = true;
    }
  }

  // Handle useToken as a call expression (usage in code)
  const useTokenCallNodes = rootNode.findAll({
    rule: {
      pattern: "useToken($$$)",
    },
  });
  const shouldHandleUseToken =
    wagmiLocalBindings.has("useToken") && !localShadowedNames.has("useToken");
  for (const node of useTokenCallNodes) {
    if (!shouldHandleUseToken) continue;
    // Find the entire statement to replace
    let targetNode: any = node;
    for (const ancestor of node.ancestors()) {
      if (ancestor.kind() === "lexical_declaration" || ancestor.kind() === "expression_statement") {
        targetNode = ancestor;
        break;
      }
    }
    if (targetNode === node) {
      // Fall back to the variable_declarator if neither found
      const vd = node.ancestors().find((a) => a.kind() === "variable_declarator");
      if (vd) targetNode = vd;
      else continue;
    }
    edits.push({
      startPos: targetNode.range().start.index,
      endPos: targetNode.range().end.index,
      insertedText: "// TODO: useToken removed in wagmi v2, use useReadContracts instead",
    });
    hasChanges = true;
  }

  // Handle useToken in import specifiers
  const useTokenImportNodes = rootNode.findAll({
    rule: {
      kind: "import_specifier",
      regex: "useToken",
    },
  });
  for (const node of useTokenImportNodes) {
    const importStmt = getImportAncestor(node);
    if (!importStmt || !isWagmiImportStatementText(importStmt.text())) continue;
    const parent = node.parent();
    if (!parent || parent.kind() !== "named_imports") continue;

    // Count sibling import_specifiers
    const siblings = parent.children().filter((c) => c.kind() === "import_specifier");
    if (siblings.length <= 1) {
      // useToken is the only named specifier.
      // Preserve a default import if present (e.g. import wagmi, { useToken } from 'wagmi').
      const stmtText = importStmt.text().trim();
      const defaultWithNamedMatch = stmtText.match(
        /^import\s+((?:type\s+)?[A-Za-z_$][\w$]*)\s*,\s*\{[^}]*\}\s*from\s*(['"]wagmi(?:\/[^'"]*)?['"]);?$/
      );
      if (defaultWithNamedMatch) {
        edits.push({
          startPos: importStmt.range().start.index,
          endPos: importStmt.range().end.index,
          insertedText: `import ${defaultWithNamedMatch[1]} from ${defaultWithNamedMatch[2]}\n// TODO: useToken removed in wagmi v2, use useReadContracts instead`,
        });
      } else {
        edits.push({
          startPos: importStmt.range().start.index,
          endPos: importStmt.range().end.index,
          insertedText: "// TODO: useToken removed in wagmi v2, use useReadContracts instead",
        });
      }
      hasChanges = true;
    } else {
      // When useToken appears with other specifiers, defer cleanup to Phase 16
      // to avoid overlapping range edits in the same import statement.
      continue;
    }
  }

  // --- Phase 8: configureChains removal → TODO comment ---
  const configureChainsCallNodes = rootNode.findAll({
    rule: {
      pattern: "configureChains($$$)",
    },
  });
  const shouldHandleConfigureChains =
    wagmiLocalBindings.has("configureChains") &&
    !localShadowedNames.has("configureChains");
  for (const node of configureChainsCallNodes) {
    if (!shouldHandleConfigureChains) continue;
    // Walk up to find the lexical_declaration (const ... = configureChains(...))
    let targetNode: any = node;
    for (const ancestor of node.ancestors()) {
      if (ancestor.kind() === "lexical_declaration") {
        targetNode = ancestor;
        break;
      }
    }
    edits.push({
      startPos: targetNode.range().start.index,
      endPos: targetNode.range().end.index,
      insertedText: "// TODO: configureChains removed in wagmi v2, use createConfig with chains and transports directly",
    });
    hasChanges = true;
  }

  // --- Phase 9: autoConnect property in createConfig → TODO ---
  // Guard: only apply when the file imports wagmi symbols
  const hasWagmiCreateConfig = wagmiLocalBindings.has("createConfig") || wagmiLocalBindings.has("WagmiConfig");
  const autoConnectNodes = rootNode.findAll({
    rule: {
      regex: "\\bautoConnect\\b",
    },
  });
  for (const node of autoConnectNodes) {
    if (!hasWagmiCreateConfig) continue;
    const parent = node.parent();
    if (parent && parent.kind() === "pair") {
      const isInCreateConfig = node.ancestors().some(
        (a) => a.kind() === "call_expression" && a.text().includes("createConfig")
      );
      if (isInCreateConfig) {
        edits.push({
          startPos: parent.range().start.index,
          endPos: parent.range().end.index,
          insertedText: "    // TODO: autoConnect removed - use WagmiProvider reconnectOnMount or useReconnect",
        });
        hasChanges = true;
      }
    }
  }

  // --- Phase 10: publicClient / webSocketPublicClient in createConfig → TODO ---
  for (const prop of ["publicClient", "webSocketPublicClient"]) {
    const nodes = rootNode.findAll({ rule: { regex: `\\b${prop}\\b` } });
    for (const node of nodes) {
      if (!hasWagmiCreateConfig) continue;
      const isInCreateConfig = node.ancestors().some(
        (a) => a.kind() === "call_expression" && a.text().includes("createConfig")
      );
      if (!isInCreateConfig) continue;
      // Handle shorthand property (e.g., publicClient,)
      if (node.kind() === "shorthand_property_identifier") {
        edits.push({
          startPos: node.range().start.index,
          endPos: node.range().end.index,
          insertedText: `// TODO: ${prop} removed - use transports instead`,
        });
        hasChanges = true;
      }
      // Handle explicit pair (e.g., publicClient: something)
      else {
        const parent = node.parent();
        if (parent && parent.kind() === "pair") {
          edits.push({
            startPos: parent.range().start.index,
            endPos: parent.range().end.index,
            insertedText: `    // TODO: ${prop} removed - use transports instead`,
          });
          hasChanges = true;
        }
      }
    }
  }

  // --- Phase 11: config.setLastUsedConnector → config.storage?.setItem ---
  const setLastUsedNodes = rootNode.findAll({
    rule: {
      pattern: "$OBJ.setLastUsedConnector($$$)",
    },
  });
  for (const node of setLastUsedNodes) {
    const objName = node.getMatch("OBJ")?.text() ?? "config";
    // Extract the original arg from node text
    const text = node.text();
    const openParen = text.indexOf("(");
    const closeParen = text.lastIndexOf(")");
    const originalArg = text.slice(openParen + 1, closeParen);
    edits.push({
      startPos: node.range().start.index,
      endPos: node.range().end.index,
      insertedText: `${objName}.storage?.setItem('recentConnectorId', ${originalArg})`,
    });
    hasChanges = true;
  }

  // --- Phase 12: config.clearState() → TODO ---
  const clearStateNodes = rootNode.findAll({
    rule: {
      pattern: "$OBJ.clearState()",
    },
  });
  for (const node of clearStateNodes) {
    const objName = node.getMatch("OBJ")?.text() ?? "config";
    const stmt = node.ancestors().find(
      (a) => a.kind() === "expression_statement"
    );
    if (stmt) {
      edits.push({
        startPos: stmt.range().start.index,
        endPos: stmt.range().end.index,
        insertedText: `// TODO: ${objName}.clearState() removed - no longer needed`,
      });
      hasChanges = true;
    }
  }

  // --- Phase 13: config.autoConnect() → TODO ---
  const configAutoConnectNodes = rootNode.findAll({
    rule: {
      pattern: "$OBJ.autoConnect()",
    },
  });
  for (const node of configAutoConnectNodes) {
    const objName = node.getMatch("OBJ")?.text() ?? "config";
    const stmt = node.ancestors().find(
      (a) => a.kind() === "expression_statement"
    );
    if (stmt) {
      edits.push({
        startPos: stmt.range().start.index,
        endPos: stmt.range().end.index,
        insertedText: `// TODO: ${objName}.autoConnect() removed - use reconnect action instead`,
      });
      hasChanges = true;
    }
  }

  // --- Phase 14: useAccount with onConnect/onDisconnect → useAccountEffect ---
  const useAccountNodes = rootNode.findAll({
    rule: {
      pattern: "useAccount($$$)",
    },
  });
  for (const node of useAccountNodes) {
    const fullText = node.text();
    if (fullText.includes("onConnect") || fullText.includes("onDisconnect")) {
      const openParen = fullText.indexOf("(");
      const closeParen = fullText.lastIndexOf(")");
      const args =
        openParen >= 0 && closeParen > openParen
          ? fullText.slice(openParen + 1, closeParen)
          : "";
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().end.index,
        insertedText: `useAccountEffect(${args})`,
      });
      hasChanges = true;
      requiresUseAccountEffectImport = true;
    }
  }

  // --- Phase 14a: useBalance with token/unit parameter → TODO ---
  const useBalanceCallNodes = rootNode.findAll({
    rule: {
      pattern: "useBalance($$$)",
    },
  });
  const shouldHandleUseBalance =
    wagmiLocalBindings.has("useBalance") && !localShadowedNames.has("useBalance");
  for (const node of useBalanceCallNodes) {
    if (!shouldHandleUseBalance) continue;
    const fullText = node.text();
    if (fullText.includes("token") || fullText.includes("unit")) {
      let targetNode: any = node;
      for (const ancestor of node.ancestors()) {
        if (
          ancestor.kind() === "lexical_declaration" ||
          ancestor.kind() === "expression_statement"
        ) {
          targetNode = ancestor;
          break;
        }
      }
      if (targetNode === node) {
        const vd = node.ancestors().find((a) => a.kind() === "variable_declarator");
        if (vd) targetNode = vd;
        else continue;
      }
      edits.push({
        startPos: targetNode.range().start.index,
        endPos: targetNode.range().end.index,
        insertedText: "// TODO: useBalance token/unit deprecated in wagmi v2, use useReadContracts for ERC20 balances",
      });
      hasChanges = true;
    }
  }

  // --- Phase 14b: watch property in hooks → TODO ---
  // watch removed from all hooks except useBlock/useBlockNumber
  // Guard: only apply when the file imports wagmi hooks (wagmiLocalBindings).
  const hasWagmiHookBindings = wagmiLocalBindings.size > 0;
  const watchPropertyNodes = rootNode.findAll({
    rule: {
      regex: "\\bwatch\\s*:\\s*true\\b",
    },
  });
  for (const node of watchPropertyNodes) {
    if (!hasWagmiHookBindings) continue;
    const parent = node.parent();
    if (!parent || parent.kind() !== "pair") continue;
    // Check if this pair is inside a hook call (not useBlock/useBlockNumber)
    const hookCallAncestor = parent.ancestors().find(
      (a) =>
        a.kind() === "call_expression" &&
        !a.text().includes("useBlockNumber") &&
        !a.text().includes("useBlock(")
    );
    if (!hookCallAncestor) continue;
    // Replace the watch pair with TODO
    edits.push({
      startPos: parent.range().start.index,
      endPos: parent.range().end.index,
      insertedText: "// TODO: watch property removed in wagmi v2 (except useBlock/useBlockNumber), use useBlockNumber + useEffect + invalidateQueries/refetch instead",
    });
    hasChanges = true;
  }

  // --- Phase 14c: suspense property removal → TODO ---
  // suspense removed from all hooks since TanStack Query removed it from useQuery
  const suspenseKeyNodes = rootNode.findAll({
    rule: {
      kind: "property_identifier",
      regex: "^suspense$",
    },
  });
  for (const node of suspenseKeyNodes) {
    // Guard: only apply when the file imports wagmi hooks, to avoid FP on
    // non-wagmi TanStack Query or React Suspense usage with suspense: true
    if (!hasWagmiHookBindings) continue;
    const parent = node.parent();
    if (!parent || parent.kind() !== "pair") continue;
    const valueNode = parent.field("value");
    if (!valueNode || valueNode.text() !== "true") continue;
    const hookCallAncestor = parent.ancestors().find(
      (a) => a.kind() === "call_expression"
    );
    if (!hookCallAncestor) continue;
    edits.push({
      startPos: parent.range().start.index,
      endPos: parent.range().end.index,
      insertedText: "// TODO: suspense property removed in wagmi v2, use useSuspenseQuery from wagmi/query instead",
    });
    hasChanges = true;
  }

  // --- Phase 14e (before 14d): .data?.hash → .data ---
  // useSendTransaction/useWriteContract return type changed from { hash } to direct hash.
  // Only match when the base variable name looks like a hook result to avoid FP.
  const hashKeyNodes = rootNode.findAll({
    rule: {
      kind: "property_identifier",
      regex: "^hash$",
    },
  });
  // Track positions of transformed expressions so 14d skips them
  const transformedHashPositions = new Set<number>();
  // Heuristic: base var names that look like hook results from useSendTransaction/useWriteContract
  const isHookResultName = (name: string): boolean =>
    /(?:result|tx|send|write|transaction|response|writeContract|sendTransaction)$/i.test(name);
  for (const node of hashKeyNodes) {
    const parent = node.parent();
    if (!parent || parent.kind() !== "member_expression") continue;
    const objNode = parent.field("object");
    if (!objNode) continue;
    const objText = objNode.text();
    // Check if the object is `something.data` or `something?.data`
    const dataMatch = objText.match(/^(.+?)[?.]data$/);
    if (!dataMatch) continue;
    const baseVar = dataMatch[1];
    // Guard: only apply when base variable name looks like a hook result
    if (!isHookResultName(baseVar)) continue;
    edits.push({
      startPos: parent.range().start.index,
      endPos: parent.range().end.index,
      insertedText: baseVar + ".data",
    });
    transformedHashPositions.add(parent.range().start.index);
    hasChanges = true;
  }

  // --- Phase 14d: Config object removed properties → TODO ---
  // config.connector, config.data, config.error, config.lastUsedChainId,
  // config.publicClient, config.status, config.webSocketClient all removed
  // All properties require the config-name guard to avoid false positives
  // (e.g. api.publicClient, client.webSocketClient, user.lastUsedChainId).
  const configRemovedPropsNeedConfigName = [
    "connector",
    "data",
    "error",
    "status",
    "lastUsedChainId",
    "publicClient",
    "webSocketClient",
  ];
  const isConfigLikeName = (objText: string): boolean =>
    /\b\w*(?:config|wagmi|wagmiConfig)\w*\s*[.\[]/.test(objText) ||
    /(?:config|wagmi)\w*$/.test(objText);
  for (const prop of configRemovedPropsNeedConfigName) {
    const propKeyNodes = rootNode.findAll({
      rule: {
        kind: "property_identifier",
        regex: `^${prop}$`,
      },
    });
    for (const node of propKeyNodes) {
      const parent = node.parent();
      if (!parent || parent.kind() !== "member_expression") continue;
      if (transformedHashPositions.has(parent.range().start.index)) continue;
      const fieldNode = parent.field("property");
      if (!fieldNode || fieldNode.range().start.index !== node.range().start.index) continue;
      const objNode = parent.field("object");
      if (!objNode || objNode.kind() === "string") continue;
      if (!isConfigLikeName(objNode.text())) continue;
      const fullText = parent.text();
      const importStmt = getImportAncestor(node);
      if (importStmt && isWagmiImportStatementText(importStmt.text())) continue;
      edits.push({
        startPos: parent.range().start.index,
        endPos: parent.range().end.index,
        insertedText: `(null as any) /* TODO: ${fullText} removed in wagmi v2 */`,
      });
      hasChanges = true;
    }
  }

  // --- Phase 14f: formatUnits parameter deprecation → TODO ---
  // formatUnits parameter deprecated in useEstimateFeesPerGas and useToken
  const formatUnitsKeyNodes = rootNode.findAll({
    rule: {
      kind: "property_identifier",
      regex: "^formatUnits$",
    },
  });
  for (const node of formatUnitsKeyNodes) {
    // Guard: only when file has wagmi hook imports
    if (!hasWagmiHookBindings) continue;
    const parent = node.parent();
    if (!parent || parent.kind() !== "pair") continue;
    const hookCallAncestor = parent.ancestors().find(
      (a) =>
        a.kind() === "call_expression" &&
        (a.text().includes("useEstimateFeesPerGas") ||
          a.text().includes("useToken("))
    );
    if (!hookCallAncestor) continue;
    edits.push({
      startPos: parent.range().start.index,
      endPos: parent.range().end.index,
      insertedText: "// TODO: formatUnits parameter deprecated in wagmi v2, use formatUnits from viem instead",
    });
    hasChanges = true;
  }

  // --- Phase 14i: TanStack Query params moved to query property ---
  // In wagmi v2, TanStack Query params (enabled, staleTime, cacheTime, retry,
  // refetchInterval, refetchOnWindowFocus, refetchOnMount, refetchOnReconnect,
  // select) must be moved to a nested `query` property.
  // We add a TODO comment above the affected property since auto-nesting is complex.
  const TSQ_PARAMS = ["enabled", "staleTime", "cacheTime", "retry", "refetchInterval", "refetchOnWindowFocus", "refetchOnMount", "refetchOnReconnect", "select"];
  for (const param of TSQ_PARAMS) {
    const paramKeyNodes = rootNode.findAll({
      rule: {
        kind: "property_identifier",
        regex: `^${param}$`,
      },
    });
    for (const node of paramKeyNodes) {
      // Guard: only when file has wagmi hook imports
      if (!hasWagmiHookBindings) continue;
      const parent = node.parent();
      if (!parent || parent.kind() !== "pair") continue;
      const hookCallAncestor = parent.ancestors().find(
        (a) => a.kind() === "call_expression" && a.text().includes("use")
      );
      if (!hookCallAncestor) continue;
      const todoMsg = param === "cacheTime"
        ? "// TODO: move 'cacheTime' to 'gcTime' inside query property in wagmi v2 (TanStack Query v5 renamed cacheTime → gcTime)\n"
        : "// TODO: move '" + param + "' to query property in wagmi v2 (TanStack Query param)\n";
      edits.push({
        startPos: parent.range().start.index,
        endPos: parent.range().start.index,
        insertedText: todoMsg,
      });
      hasChanges = true;
    }
  }

  // --- Phase 14j: paginatedIndexesConfig removal → TODO ---
  // paginatedIndexesConfig utility was removed in wagmi v2
  const paginatedNodes = rootNode.findAll({
    rule: {
      regex: "\\bpaginatedIndexesConfig\\b",
    },
  });
  for (const node of paginatedNodes) {
    const importStmt = getImportAncestor(node);
    if (!importStmt || !isWagmiImportStatementText(importStmt.text())) continue;
    // Find the surrounding statement to replace
    const exprStmt = node.ancestors().find(
      (a) => a.kind() === "lexical_declaration" || a.kind() === "expression_statement"
    );
    if (exprStmt) {
      edits.push({
        startPos: exprStmt.range().start.index,
        endPos: exprStmt.range().end.index,
        insertedText: "// TODO: paginatedIndexesConfig removed in wagmi v2, use useInfiniteReadContracts with initialPageParam and getNextPageParam instead",
      });
      hasChanges = true;
    }
  }

  // --- Phase 14k: Mutation setup arguments removal → TODO ---
  // Mutation hooks no longer accept setup args in wagmi v2
  const MUTATION_HOOKS = ["useSignMessage", "useSignTypedData", "useSendTransaction"];
  for (const hookName of MUTATION_HOOKS) {
    const callNodes = rootNode.findAll({
      rule: {
        pattern: `${hookName}($$$)`,
      },
    });
    for (const node of callNodes) {
      // Only flag if args are passed (not just empty parens)
      const text = node.text();
      const openParen = text.indexOf("(");
      const closeParen = text.lastIndexOf(")");
      const args = openParen >= 0 && closeParen > openParen ? text.slice(openParen + 1, closeParen).trim() : "";
      if (!args || args === "{}") continue;
      let targetNode: any = node;
      for (const ancestor of node.ancestors()) {
        if (ancestor.kind() === "lexical_declaration" || ancestor.kind() === "expression_statement") {
          targetNode = ancestor;
          break;
        }
      }
      if (targetNode === node) {
        const vd = node.ancestors().find((a) => a.kind() === "variable_declarator");
        if (vd) targetNode = vd;
        else continue;
      }
      edits.push({
        startPos: targetNode.range().start.index,
        endPos: targetNode.range().end.index,
        insertedText: "// TODO: " + hookName + " no longer accepts setup arguments in wagmi v2, pass args to the mutation function instead",
      });
      hasChanges = true;
    }
  }

  // --- Phase 14g: config.setConnectors → config._internal.setConnectors ---
  // Renamed to internal API in wagmi v2
  const setConnectorsNodes = rootNode.findAll({
    rule: {
      pattern: "$OBJ.setConnectors($$$)",
    },
  });
  for (const node of setConnectorsNodes) {
    const objName = node.getMatch("OBJ")?.text() ?? "config";
    const text = node.text();
    const openParen = text.indexOf("(");
    const args = text.slice(openParen);
    edits.push({
      startPos: node.range().start.index,
      endPos: node.range().end.index,
      insertedText: objName + "._internal.setConnectors" + args,
    });
    hasChanges = true;
  }

  // --- Phase 14h: getConfig() removal → TODO ---
  // Global getConfig() removed in wagmi v2, config should be passed explicitly
  const getConfigNodes = rootNode.findAll({
    rule: {
      pattern: "getConfig($$$)",
    },
  });
  const shouldHandleGetConfig =
    wagmiLocalBindings.has("getConfig") && !localShadowedNames.has("getConfig");
  for (const node of getConfigNodes) {
    if (!shouldHandleGetConfig) continue;
    let targetNode: any = node;
    for (const ancestor of node.ancestors()) {
      if (ancestor.kind() === "lexical_declaration" || ancestor.kind() === "expression_statement") {
        targetNode = ancestor;
        break;
      }
    }
    if (targetNode === node) {
      const vd = node.ancestors().find((a) => a.kind() === "variable_declarator");
      if (vd) targetNode = vd;
      else continue;
    }
    edits.push({
      startPos: targetNode.range().start.index,
      endPos: targetNode.range().end.index,
      insertedText: "// TODO: getConfig() removed in wagmi v2, pass config explicitly to actions",
    });
    hasChanges = true;
  }

  // --- Phase 15: TanStack Query peer dependency setup detection ---
  // Detect files with WagmiProvider/WagmiConfig usage to flag TSQ setup need.
  // We only insert an import + TODO, avoiding JSX structural changes (high FP risk).
  const wagmiProviderNodes = rootNode.findAll({
    rule: {
      kind: "identifier",
      regex: "^(WagmiProvider|WagmiConfig)$",
    },
  });
  for (const node of wagmiProviderNodes) {
    // Only flag if the file imports from wagmi
    const importStmt = getImportAncestor(node);
    if (!importStmt || !isWagmiImportStatementText(importStmt.text())) continue;
    requiresTanStackQueryImport = true;
    break;
  }

  // --- Phase 15 disabled: .data?.hash can be context-sensitive ---
  // This rewrite was downgraded to preserve deterministic zero-FP behavior.
  // AI/manual follow-up should handle this edge case in real repositories.

  // --- Phase 16: Normalize wagmi imports (rename specifiers + dedupe/merge) ---
  type SpecInfo = { name: string; isType: boolean };
  type ImportGroup = {
    source: string;
    quote: string;
    prefix: string;
    specifiers: SpecInfo[];
    nodes: any[];
  };
  const importGroups = new Map<string, ImportGroup>();

  for (const importNode of importNodes) {
    const text = importNode.text().trim();
    const match = text.match(
      /^import\s+((?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?)\{([^}]*)\}\s*from\s*(['"])([^'"]+)\3;?$/
    );
    if (!match) continue;
    const prefix = match[1] ?? "";
    const namedSpecifiers = match[2];
    const source = normalizeImportSource(match[4]);
    if (!isWagmiImportStatementText(text)) continue;
    const groupKey = `${prefix}|${source}`;

    if (!importGroups.has(groupKey)) {
      importGroups.set(groupKey, {
        source,
        quote: match[3],
        prefix,
        specifiers: [],
        nodes: [],
      });
    }
    const group = importGroups.get(groupKey)!;
    group.nodes.push(importNode);

    for (const rawSpecifier of namedSpecifiers.split(",")) {
      const raw = rawSpecifier.trim();
      if (!raw) continue;

      // Strip inline 'type' modifier: "type UseAccountResult" → "UseAccountResult", track isType
      const isType = raw.startsWith("type ") || raw.startsWith("type	");
      const spec = isType ? raw.slice(5).trim() : raw;

      const aliasMatch = spec.match(
        /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/
      );
      if (aliasMatch) {
        if (aliasMatch[1] === "useToken") continue;
        if (aliasMatch[1] === "useWebSocketPublicClient") continue;
        let renamedImported = renameSymbolExact(aliasMatch[1]);
        if (aliasMatch[1] === "Context") renamedImported = "WagmiContext";
        group.specifiers.push({ name: `${renamedImported} as ${aliasMatch[2]}`, isType });
      } else {
        if (spec === "useToken") continue;
        if (spec === "useSigner") continue;
        if (spec === "useProvider") continue;
        if (spec === "usePrepareSendTransaction") continue;
        if (spec === "getConfig") continue;
        if (spec === "useWebSocketPublicClient") continue;
        let renamed = renameSymbolExact(spec);
        if (spec === "Context") renamed = "WagmiContext";
        group.specifiers.push({ name: renamed, isType });
      }
    }
  }

  if (requiresUseAccountEffectImport) {
    const wagmiGroup = importGroups.get("|wagmi");
    if (wagmiGroup) {
      wagmiGroup.specifiers.push({ name: "useAccountEffect", isType: false });
    } else {
      edits.push({
        startPos: 0,
        endPos: 0,
        insertedText: "import { useAccountEffect } from 'wagmi'\n",
      });
      hasChanges = true;
    }
  }

  for (const importName of requiresUseConfigImport) {
    const wagmiGroup = importGroups.get("|wagmi");
    if (wagmiGroup) {
      wagmiGroup.specifiers.push({ name: importName, isType: false });
    } else {
      edits.push({
        startPos: 0,
        endPos: 0,
        insertedText: `import { ${importName} } from 'wagmi'\n`,
      });
      hasChanges = true;
    }
  }

  // TanStack Query peer dependency import
  if (requiresTanStackQueryImport) {
    const tsqGroup = importGroups.get("|@tanstack/react-query");
    if (tsqGroup) {
      // Already imported, just mark
    } else {
      edits.push({
        startPos: 0,
        endPos: 0,
        insertedText: "import { QueryClient, QueryClientProvider } from '@tanstack/react-query'\n// TODO: Wrap <WagmiProvider> with <QueryClientProvider client={new QueryClient()}>\n",
      });
      hasChanges = true;
    }
  }

  // --- Phase 17: Extract chain imports and erc20Abi to their correct sources ---
  // mainnet/sepolia should come from 'wagmi/chains', erc20Abi from 'viem'.
  const CHAIN_NAMES = new Set(["mainnet", "sepolia", "goerli", "polygon", "optimism", "arbitrum", "base", "bsc", "avalanche", "fantom", "zksync", "scroll"]);
  const wagmiGroup = importGroups.get("|wagmi");
  if (wagmiGroup) {
    const chainSpecifiers: SpecInfo[] = [];
    const erc20Specifiers: SpecInfo[] = [];
    const remaining: SpecInfo[] = [];
    for (const spec of wagmiGroup.specifiers) {
      // Handle aliased imports: "mainnet as m"
      const aliasMatch = spec.name.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/);
      const baseName = aliasMatch ? aliasMatch[1] : spec.name;
      if (CHAIN_NAMES.has(baseName)) {
        chainSpecifiers.push(spec);
      } else if (baseName === "erc20Abi") {
        erc20Specifiers.push(spec);
      } else {
        remaining.push(spec);
      }
    }
    // Flag deprecated goerli testnet (replaced by sepolia)
    const hasGoerli = chainSpecifiers.some((s) => {
      const aliasMatch = s.name.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/);
      return (aliasMatch ? aliasMatch[1] : s.name) === "goerli";
    });
    if (hasGoerli) {
      edits.push({
        startPos: 0,
        endPos: 0,
        insertedText: "// TODO: goerli testnet deprecated in wagmi v2, use sepolia instead\n",
      });
      hasChanges = true;
    }

    // Extract chain imports to 'wagmi/chains'
    if (chainSpecifiers.length > 0) {
      const chainsGroup = importGroups.get("|wagmi/chains");
      if (chainsGroup) {
        for (const s of chainSpecifiers) chainsGroup.specifiers.push(s);
      } else {
        importGroups.set("|wagmi/chains", {
          source: "wagmi/chains",
          quote: wagmiGroup.quote,
          prefix: "",
          specifiers: chainSpecifiers,
          nodes: [],
        });
      }
    }
    // Extract erc20Abi import to 'viem'
    if (erc20Specifiers.length > 0) {
      const viemGroup = importGroups.get("|viem");
      if (viemGroup) {
        for (const s of erc20Specifiers) viemGroup.specifiers.push(s);
      } else {
        importGroups.set("|viem", {
          source: "viem",
          quote: wagmiGroup.quote,
          prefix: "",
          specifiers: erc20Specifiers,
          nodes: [],
        });
      }
    }
    // Keep remaining specifiers in the wagmi group
    if (chainSpecifiers.length > 0 || erc20Specifiers.length > 0) {
      wagmiGroup.specifiers = remaining;
    }
  }

  // Build insert position for new imports (no existing nodes)
  let lastImportEnd = 0;
  for (const node of importNodes) {
    const end = node.range().end.index;
    if (end > lastImportEnd) lastImportEnd = end;
  }

  for (const group of importGroups.values()) {
    // Deduplicate by specifier name (preserve first occurrence)
    const seen = new Set<string>();
    const unique: SpecInfo[] = [];
    for (const s of group.specifiers) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        unique.push(s);
      }
    }
    // Sort by name, then format with type prefix where needed
    const formatted = unique
      .map(s => s.isType ? `type ${s.name}` : s.name)
      .sort();
    if (formatted.length === 0) {
      for (const node of group.nodes) {
        edits.push({
          startPos: node.range().start.index,
          endPos: node.range().end.index,
          insertedText: "",
        });
        hasChanges = true;
      }
      continue;
    }
    const mergedLine = `import ${group.prefix}{ ${formatted.join(", ")} } from ${group.quote}${group.source}${group.quote}`;

    const firstNode = group.nodes[0];
    if (firstNode) {
      if (firstNode.text().trim() !== mergedLine) {
        edits.push({
          startPos: firstNode.range().start.index,
          endPos: firstNode.range().end.index,
          insertedText: mergedLine,
        });
        hasChanges = true;
      }

      for (let i = 1; i < group.nodes.length; i++) {
        const duplicateNode = group.nodes[i];
        edits.push({
          startPos: duplicateNode.range().start.index,
          endPos: duplicateNode.range().end.index,
          insertedText: "",
        });
        hasChanges = true;
      }
    } else {
      // No existing nodes for this group — insert after last import
      edits.push({
        startPos: lastImportEnd,
        endPos: lastImportEnd,
        insertedText: "\n" + mergedLine,
      });
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return null;
  }

  return rootNode.commitEdits(edits);
};

export default codemod;
