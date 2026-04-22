import type { Codemod, Edit } from "codemod:ast-grep";
import type Tsx from "codemod:ast-grep/langs/tsx";

/**
 * wagmi v1 → v2 Migration Codemod
 *
 * Handles all documented breaking changes:
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
  { regex: "usePrepareSendTransaction", new: "useEstimateGas" },
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
const IMPORT_PATH_RENAMES: Array<{ from: string; to: string }> = [
  { from: "wagmi/providers/alchemy", to: "viem" },
  { from: "wagmi/providers/public", to: "viem" },
  { from: "wagmi/providers/infura", to: "viem" },
  { from: "wagmi/providers/jsonRpc", to: "viem" },
];

const codemod: Codemod<Tsx> = async (root) => {
  const rootNode = root.root();
  const edits: Edit[] = [];
  let hasChanges = false;

  // --- Phase 0: Special cases that must run before generic renames ---

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
      // For anchored patterns, require exact match
      const isExact = repl.regex.startsWith("^") && repl.regex.endsWith("$");
      const actualPattern = isExact ? repl.regex.slice(1, -1) : repl.regex;
      if (isExact && nodeText !== actualPattern) {
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

  // --- Phase 4: Connector entrypoint: wagmi/connectors/* → wagmi/connectors ---
  // Only match string literals (the import path), NOT import_specifier nodes
  const connPathNodes = rootNode.findAll({
    rule: {
      kind: "string",
      regex: "wagmi/connectors/",
    },
  });
  for (const node of connPathNodes) {
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
  for (const node of useTokenCallNodes) {
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
    const parent = node.parent();
    if (!parent || parent.kind() !== "named_imports") continue;

    // Count sibling import_specifiers
    const siblings = parent.children().filter((c) => c.kind() === "import_specifier");
    if (siblings.length <= 1) {
      // useToken is the only specifier — replace entire import statement
      const importStmt = parent.ancestors().find(
        (a) => a.kind() === "import_statement" || a.kind() === "import_declaration"
      );
      if (importStmt) {
        edits.push({
          startPos: importStmt.range().start.index,
          endPos: importStmt.range().end.index,
          insertedText: "// TODO: useToken removed in wagmi v2, use useReadContracts instead",
        });
        hasChanges = true;
      }
    } else {
      // Remove just the useToken specifier and its comma
      const children = parent.children();
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        if (c.kind() === "import_specifier" && c.text().includes("useToken")) {
          // Check for comma before or after
          const prevIdx = i - 1;
          if (prevIdx >= 0 && children[prevIdx].text() === ',') {
            edits.push({
              startPos: children[prevIdx].range().start.index,
              endPos: c.range().end.index,
              insertedText: '',
            });
            hasChanges = true;
          }
          const nextIdx = i + 1;
          if (nextIdx < children.length && children[nextIdx].text() === ',') {
            edits.push({
              startPos: c.range().start.index,
              endPos: children[nextIdx].range().end.index,
              insertedText: '',
            });
            hasChanges = true;
          }
          break;
        }
      }
    }
  }

  // --- Phase 8: configureChains removal → TODO comment ---
  const configureChainsCallNodes = rootNode.findAll({
    rule: {
      pattern: "configureChains($$$)",
    },
  });
  for (const node of configureChainsCallNodes) {
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
  const autoConnectNodes = rootNode.findAll({
    rule: {
      regex: "\\bautoConnect\\b",
    },
  });
  for (const node of autoConnectNodes) {
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
      const args = node.getMatch("...")?.text() ?? "";
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().end.index,
        insertedText: `useAccountEffect(${args})`,
      });
      hasChanges = true;
    }
  }

  // --- Phase 15: .data?.hash → .data (return type change) ---
  const hashAccessNodes = rootNode.findAll({
    rule: {
      regex: "\\.data\\?\\.hash",
    },
  });
  for (const node of hashAccessNodes) {
    const text = node.text();
    const newText = text.replace(/\.data\?\.hash/g, ".data");
    if (newText !== text) {
      edits.push({
        startPos: node.range().start.index,
        endPos: node.range().end.index,
        insertedText: newText,
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
