# REA (Reverse Engineer Anything) — Capability Inventory & Architecture

> **Document Status:** Complete & Verified
> **Target System:** REA Core CLI (`rea@6.5.0`), REA MCP Server (207 tools), Ghidra Provider (v12.1.4)
> **Workspace:** `/Users/devrajput/DEV RAJPUT/PROJECT-K`
> **Project Context:** TeamOS — Delivery Risk Intelligence Platform

---

## 1. Executive Summary

Reverse Engineer Anything (**REA**) is an evidence-first reverse-engineering, binary analysis, and runtime reconstruction engine. It operates both as an interactive developer CLI (`rea`) and as a model-context-protocol (**MCP**) server exposing 207 lazy-loaded tools to AI agents.

This inventory documents the actual verified capabilities of REA on the current macOS workstation, reports its provider status (specifically the active Ghidra installation), maps its analytical modalities, and explains how TeamOS adopts REA's core engineering principles while strictly preserving product boundaries.

---

## 2. REA System Topography & Verified Environment

### 2.1 Tooling & Versions
| Component | Verified Version | Path / Reference | Status |
| :--- | :--- | :--- | :--- |
| **REA CLI** | `rea@6.5.0` | `/Users/devrajput/.nvm/versions/node/v20.20.1/bin/rea` | **Active & Functional** |
| **REA MCP Server** | `207` tools | Registered in `~/.gemini/config/mcp_config.json` | **Aligned** |
| **Ghidra Engine** | `12.1.4_PUBLIC` | `/Applications/ghidra_12.1.4_PUBLIC` | **Verified Functional** |
| **Java Runtime** | OpenJDK `25-ea` | `/Users/devrajput/Library/Java/JavaVirtualMachines/openjdk-25/Contents/Home` | **Compatible** |
| **Platform Target** | Darwin arm64 | Apple M-Series (macOS Sonoma / Sequoia) | **Native Execution** |

### 2.2 MCP Configuration Diagnostics
Execution of `rea doctor --provider ghidra --client antigravity` confirms:
- **Registration**: Aligned with Antigravity agent configuration.
- **Provider Status**: Ghidra detected at `/Applications/ghidra_12.1.4_PUBLIC/ghidraRun`.
- **Support Matrix**: Native Mach-O arm64 decompiler and headless disassembler verified.

---

## 3. REA Provider Ecosystem

REA abstracts analysis through dedicated providers that specialize by artifact format and execution runtime:

```
                      ┌─────────────────────────────────┐
                      │            REA Core             │
                      │   (Evidence Digest & Graph)     │
                      └────────────────┬────────────────┘
                                       │
         ┌───────────────┬─────────────┴───┬────────────────┐
         ▼               ▼                 ▼                ▼
   ┌───────────┐   ┌───────────┐     ┌───────────┐    ┌───────────┐
   │  ghidra   │   │  native-  │     │rea-dotnet-│    │rea-       │
   │ (Decompile│   │   macos   │     │  static   │    │artifact-  │
   │ & Xrefs)  │   │  (Mach-O) │     │ (CLR/.NET)│    │   graph   │
   └───────────┘   └───────────┘     └───────────┘    └───────────┘
```

### 3.1 Provider Matrix
1. **`ghidra` (Native Decompiler & Binary Analysis)**
   - Headless analysis engine using the NSA Ghidra software reverse engineering suite.
   - Decompilation of stripped Mach-O, ELF, and PE executables into high-level C representations.
   - Cross-reference (`xrefs`) tracing from callers to callees.
   - Symbol recovery, segment disassembly, and data-flow analysis.

2. **`native-macos` (Apple Silicon & Mach-O Runtime)**
   - Deep inspection of Mach-O headers, segments, dylibs, code signatures, and entitlements.
   - Objective-C class hierarchy extraction (`get_objc_classes`, `get_objc_protocols`).
   - Swift type demangling and runtime reflection mapping.

3. **`rea-artifact-graph` (Topological Evidence & Reconstruction)**
   - Relationship mapping between modules, functions, and evidence nodes.
   - Evidence ledger tracking (`build_reconstruction_obligation_ledger`, `evaluate_reconstruction_coverage`).
   - Differential analysis comparing binary builds or bundle versions.

4. **`rea-dotnet-static` (Managed CLR Engine)**
   - Intermediate Language (IL) parsing, metadata token recovery, and native boundary checks.

---

## 4. Comprehensive MCP Tool & Command Taxonomy

REA's 207 MCP tools span 8 primary operational domains:

### 4.1 Native Binary & Disassembly
- `inspect_native_load_image`: Parse binary headers, load commands, architecture slices.
- `search_procedures` / `list_procedures`: Discover declared and stripped function entries.
- `procedure_pseudo_code`: Invoke Ghidra's decompiler to emit structured C representation.
- `procedure_assembly`: Emit raw architecture instructions (ARM64 / x86_64).
- `xrefs`: Identify all inbound and outbound cross-references for addresses or symbols.
- `search_strings`: Locate ASCII, UTF-8, and UTF-16 string constants in rodata.

### 4.2 Web & JavaScript Runtime Analysis
- `analyze_javascript_application`: Parse AST across bundled applications to find framework roots and entrypoints.
- `trace_web_module_imports`: Map dynamic and static import trees across Webpack/Vite chunks.
- `recover_javascript_sources`: Reconstruct source maps and clean module hierarchies from minified web bundles.

### 4.3 Mobile & Embedded Platforms
- Android: `inspect_android_package`, `search_android_classes`, `decompile_jeb_item`, `read_adb_logcat`.
- Flutter / Dart: `identify_flutter_build`, `inspect_dart_aot`.
- Firmware: `inspect_firmware_regions`, `extract_firmware`.

### 4.4 Dynamic Instrumentation & Debugging
- Frida: `start_frida_session`, `load_frida_script`, `instrument_with_frida`.
- Rizin / GDB: `start_rizin_debug_session`, `rizin_debug_command`, `gdb_console`.

### 4.5 Evidence Bundles & Integrity Ledgers
- `export_evidence_bundle`: Package verified findings into signed, hash-verified archive.
- `record_unknown`: Formulate falsifiable hypotheses for unresolved binary structures.
- `verify_unknown_resolution`: Verify hypotheses against dynamic execution traces.

---

## 5. Architectural Alignment: How TeamOS Adopts REA Principles

TeamOS is a **Delivery Risk Intelligence SaaS**, not a native binary debugger. We adopt REA's **epistemological and algorithmic strengths** while strictly avoiding bloat:

| REA Principle | TeamOS Implementation | Reason & Product Value |
| :--- | :--- | :--- |
| **Evidence Digests (SHA-256)** | SHA-256 snapshot seals on all Health Reports (`@teamos/risk-engine`) | Immutable proof that report claims reflect real task states at a point in time. |
| **Strict Citation Ledger** | Citation verifier (`task:<id>`, `dep:<id>`, `gh:<pr>`) | Eliminates AI hallucination; claims without citations fail closed. |
| **Directed Acyclic Graph (DAG)** | CPM schedule engine (`@teamos/risk-engine`) | Deterministic topological sort with finish-to-start constraints. |
| **Confidence Classification** | `observed` (db), `derived` (CPM math), `inferred` (forecast) | Clear epistemic distinction between hard facts and schedule forecasts. |
| **Binary Decompilation** | **Excluded from TeamOS Web Runtime** | Prevents architectural bloat; TeamOS manages engineering schedules, not firmware. |

---

## 6. Verification Summary

- **CLI Tests**: `rea inspect`, `rea search`, `rea decompile`, `rea xrefs` executed against test Mach-O arm64 binary.
- **Provider Accuracy**: Ghidra 12.1.4 successfully reversed C logic matching source condition `uVar1 = 2; if (param_2 < 4 || param_1 < 0xb) ...`.
- **Status**: Production-ready reference for TeamOS evidence validation.
