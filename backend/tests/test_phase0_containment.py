"""
Phase 0 Containment Tests
==========================
All tests in this file target the bugs listed in PHASE 0.
Run BEFORE fixes to confirm they fail, then again after to confirm they pass.
"""
import os
import logging
import importlib
import unittest.mock as mock

import pytest
import httpx
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helper: import app fresh (config is read at import time)
# ---------------------------------------------------------------------------
def _import_app():
    # Wipe cached modules so config picks up patched env vars
    import sys
    for mod in list(sys.modules.keys()):
        if mod.startswith("app"):
            del sys.modules[mod]
    from app.main import app
    return app


# ---------------------------------------------------------------------------
# T0-1: API key must NOT appear in the URL sent by GeminiProvider
# ---------------------------------------------------------------------------
class TestGeminiKeyNotInURL:
    """API key must travel in the x-goog-api-key header, never the URL."""

    def test_gemini_key_not_in_request_url(self, monkeypatch):
        fake_key = "FAKE_GEMINI_KEY_XYZ"
        monkeypatch.setenv("GEMINI_API_KEY", fake_key)

        import sys
        for mod in list(sys.modules.keys()):
            if mod.startswith("app"):
                del sys.modules[mod]

        from app.llm.router import GeminiProvider
        provider = GeminiProvider(api_key=fake_key)

        captured_requests = []

        async def _run():
            async def mock_post(self_client, url, **kwargs):
                captured_requests.append(url)
                raise httpx.ConnectError("mocked")

            with mock.patch("httpx.AsyncClient.post", mock_post):
                try:
                    await provider.generate_text("hello")
                except Exception:
                    pass

        import asyncio
        asyncio.run(_run())

        assert captured_requests, "No HTTP call was made"
        url_used = captured_requests[0]
        assert fake_key not in url_used, (
            f"API key leaked into URL: {url_used!r}"
        )

    def test_gemini_key_sent_in_header(self, monkeypatch):
        """The x-goog-api-key header must be present."""
        fake_key = "FAKE_GEMINI_HEADER_KEY"
        monkeypatch.setenv("GEMINI_API_KEY", fake_key)

        import sys
        for mod in list(sys.modules.keys()):
            if mod.startswith("app"):
                del sys.modules[mod]

        from app.llm.router import GeminiProvider
        provider = GeminiProvider(api_key=fake_key)

        captured_headers: dict = {}

        async def _run():
            async def mock_post(self_client, url, *, headers=None, **kwargs):
                captured_headers.update(headers or {})
                raise httpx.ConnectError("mocked")

            with mock.patch("httpx.AsyncClient.post", mock_post):
                try:
                    await provider.generate_text("hello")
                except Exception:
                    pass

        import asyncio
        asyncio.run(_run())

        header_keys_lower = {k.lower() for k in captured_headers}
        assert "x-goog-api-key" in header_keys_lower, (
            f"x-goog-api-key header missing. Got headers: {list(captured_headers.keys())}"
        )
        got_value = captured_headers.get("x-goog-api-key") or captured_headers.get("X-Goog-Api-Key")
        assert got_value == fake_key, (
            f"Header value wrong: got {got_value!r}, expected {fake_key!r}"
        )


# ---------------------------------------------------------------------------
# T0-2: httpx logger must be at WARNING level (not INFO) so keys don't appear
# ---------------------------------------------------------------------------
class TestHttpxLogLevel:
    def test_httpx_logger_not_at_info(self):
        import sys
        for mod in list(sys.modules.keys()):
            if mod.startswith("app"):
                del sys.modules[mod]

        import app.main  # noqa – triggers logging setup
        httpx_logger = logging.getLogger("httpx")
        assert httpx_logger.level >= logging.WARNING, (
            f"httpx logger is set to level {httpx_logger.level} ({logging.getLevelName(httpx_logger.level)}); "
            "should be WARNING (30) or higher to avoid leaking request URLs in logs."
        )


# ---------------------------------------------------------------------------
# T0-3: Model names must come from config, not be hard-coded strings
# ---------------------------------------------------------------------------
class TestModelNamesFromConfig:
    def test_gemini_model_uses_config_default(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "fake")
        import sys
        for mod in list(sys.modules.keys()):
            if mod.startswith("app"):
                del sys.modules[mod]

        from app.llm.router import GeminiProvider
        from app.core.config import settings
        provider = GeminiProvider(api_key="fake")
        assert provider.model == settings.GEMINI_MODEL, (
            f"GeminiProvider.model ({provider.model!r}) does not match "
            f"settings.GEMINI_MODEL ({settings.GEMINI_MODEL!r}). "
            "Model name must come from config, not be hard-coded."
        )

    def test_gemini_model_not_retired(self, monkeypatch):
        """gemini-1.5-flash is retired; the configured default must not be that string."""
        monkeypatch.setenv("GEMINI_API_KEY", "fake")
        import sys
        for mod in list(sys.modules.keys()):
            if mod.startswith("app"):
                del sys.modules[mod]

        from app.core.config import settings
        assert settings.GEMINI_MODEL != "gemini-1.5-flash", (
            "settings.GEMINI_MODEL defaults to the retired 'gemini-1.5-flash'. "
            "Change the default to 'gemini-2.5-flash' or read from GEMINI_MODEL env var."
        )

    def test_groq_model_from_config(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "fake")
        import sys
        for mod in list(sys.modules.keys()):
            if mod.startswith("app"):
                del sys.modules[mod]

        from app.llm.router import GroqProvider
        from app.core.config import settings
        provider = GroqProvider(api_key="fake")
        assert provider.model == settings.GROQ_MODEL, (
            f"GroqProvider.model ({provider.model!r}) does not match "
            f"settings.GROQ_MODEL ({settings.GROQ_MODEL!r})."
        )


# ---------------------------------------------------------------------------
# T0-4: Startup WARNING when preferred provider has no key
# ---------------------------------------------------------------------------
class TestStartupProviderWarning:
    def test_missing_key_logs_warning(self, monkeypatch, caplog):
        """
        When QUESTION_GEN_PROVIDER=gemini but GEMINI_API_KEY is absent,
        the router init must emit a WARNING naming the affected task.
        """
        import types
        import logging
        from app.llm.router import LLMRouter, logger

        mock_cfg = types.SimpleNamespace(
            GEMINI_API_KEY=None,
            GROQ_API_KEY="fake-groq",
            OPENAI_API_KEY=None,
            QUESTION_GEN_PROVIDER="gemini",
            LIVE_PROVIDER="groq",
            EVALUATION_PROVIDER="groq",
            REPORT_PROVIDER="gemini"
        )

        records = []
        class ListHandler(logging.Handler):
            def emit(self, record):
                records.append(record)

        handler = ListHandler(level=logging.WARNING)
        logger.addHandler(handler)
        logger.disabled = False
        orig_level = logger.level
        logger.setLevel(logging.WARNING)
        try:
            LLMRouter(cfg=mock_cfg)
        finally:
            logger.removeHandler(handler)
            logger.setLevel(orig_level)

        all_text = " ".join([r.getMessage() for r in records]).lower()
        assert "question_generation" in all_text or "gemini" in all_text, (
            "No WARNING about missing GEMINI_API_KEY for question_generation task. "
            f"Captured log:\n{all_text}"
        )


# ---------------------------------------------------------------------------
# T0-5: CORS must not use wildcard '*' with allow_credentials=True
# ---------------------------------------------------------------------------
class TestCORSNotWildcard:
    def test_cors_origins_not_wildcard(self):
        import sys
        for mod in list(sys.modules.keys()):
            if mod.startswith("app"):
                del sys.modules[mod]

        from app.main import app
        cors_middleware = None
        for mw in app.user_middleware:
            if "CORSMiddleware" in str(mw.cls):
                cors_middleware = mw
                break

        assert cors_middleware is not None, "CORSMiddleware not found in app middleware stack"
        origins = cors_middleware.kwargs.get("allow_origins", [])
        assert "*" not in origins, (
            "CORS allow_origins contains '*' which, combined with allow_credentials=True, "
            "is a security vulnerability (browsers block this combination). "
            "Use explicit origins from settings.BACKEND_CORS_ORIGINS."
        )


# ---------------------------------------------------------------------------
# T0-6: /docs, /openapi.json and / must be disabled outside development
# ---------------------------------------------------------------------------
class TestDocsDisabledInProduction:
    def _make_client(self, env_value: str, monkeypatch):
        monkeypatch.setenv("ENV", env_value)
        monkeypatch.setenv("QUESTION_GEN_PROVIDER", "mock")
        monkeypatch.setenv("LIVE_PROVIDER", "mock")
        monkeypatch.setenv("EVALUATION_PROVIDER", "mock")
        monkeypatch.setenv("REPORT_PROVIDER", "mock")
        import sys
        for mod in list(sys.modules.keys()):
            if mod.startswith("app"):
                del sys.modules[mod]
        from app.main import app
        return TestClient(app, raise_server_exceptions=False)

    def test_docs_disabled_in_production(self, monkeypatch):
        client = self._make_client("production", monkeypatch)
        resp = client.get("/docs")
        assert resp.status_code == 404, (
            f"/docs returned {resp.status_code} in production; expected 404. "
            "API documentation must be disabled outside development."
        )

    def test_openapi_disabled_in_production(self, monkeypatch):
        client = self._make_client("production", monkeypatch)
        resp = client.get("/api/openapi.json")
        assert resp.status_code == 404, (
            f"/openapi.json returned {resp.status_code} in production; expected 404."
        )

    def test_root_config_endpoint_disabled_in_production(self, monkeypatch):
        """The / endpoint must not expose provider config in production."""
        client = self._make_client("production", monkeypatch)
        resp = client.get("/")
        assert resp.status_code == 404, (
            f"/ returned {resp.status_code} in production; expected 404. "
            "Root endpoint exposes internal LLM config and must be disabled outside development."
        )

    def test_docs_enabled_in_development(self, monkeypatch):
        client = self._make_client("development", monkeypatch)
        resp = client.get("/docs")
        assert resp.status_code == 200, (
            f"/docs returned {resp.status_code} in development mode; expected 200."
        )
