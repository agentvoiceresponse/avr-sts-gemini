# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-05-28

### Added

- Vertex AI (Google Cloud Console) authentication via `GOOGLE_GENAI_USE_VERTEXAI` with `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and Application Default Credentials.
- AVR-prefixed Vertex env aliases: `GEMINI_USE_VERTEXAI`, `GEMINI_VERTEX_PROJECT`, `GEMINI_VERTEX_LOCATION`.
- `GOOGLE_API_KEY` fallback for Google AI Studio mode (Google GenAI SDK convention).
- Optional `GEMINI_API_VERSION` for both auth modes.

### Changed

- Google GenAI client construction centralized in `createGoogleGenAIClient()` with fail-fast validation for missing Vertex project/location or API key.

### Fixed

- WebSocket `error` responses now include the underlying initialization message (e.g. missing env vars) instead of a generic failure string.
