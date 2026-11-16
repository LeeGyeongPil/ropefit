# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-11-16

### Added
- Browser app (React + Vite + TypeScript) that turns a model config and a target length into
  per-engine RoPE/YaRN settings for llama.cpp, vLLM (four version bands), SGLang, transformers and Ollama guidance.
- Static check of existing commands with 11 rules, each with a source or docs link and a checked date.
- Model input from built-in samples, a Hugging Face model ID (config.json only), pasted config.json, or a local GGUF header.
- YaRN, linear and dynamic NTK wavelength chart; KV cache estimate.
- English and Korean UI with a language menu (`ropefit.lang` in localStorage, `?lang=` query for screenshots).

### Fixed
- Error messages (paste, check, GGUF) follow the UI language.
