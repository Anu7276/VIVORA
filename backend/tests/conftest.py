"""
conftest.py — pytest session-level fixtures and hooks for VIVORA backend tests.

Key concern: test_phase0_containment.py deletes `app.*` modules from sys.modules
to test module-import-time behaviour with patched env vars. This can leave modules
in a stale state for subsequent test files (e.g., TASK_PROVIDER_MAP is rebuilt
without API keys).

Mitigation: After each test, restore any `app.*` module that was deleted by
clearing the whole `app.*` cache so the next test gets a fresh import.
The _make_router() helper in test_task_routing.py patches settings correctly and
patches TASK_PROVIDER_MAP directly — so isolation is guaranteed.
"""
import sys
from pathlib import Path
import pytest

# Ensure backend root is on sys.path for test discovery and module resolution
_backend_root = str(Path(__file__).resolve().parent.parent)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)


@pytest.fixture(autouse=True)
def _restore_app_modules():
    """
    Save and restore the `app` module namespace around each test.

    Tests that deliberately delete `app.*` to force re-import (with monkeypatched
    env vars) are isolated: their deletions don't bleed into sibling tests.
    """
    # Snapshot the set of loaded app.* modules before the test
    before = {k: v for k, v in sys.modules.items() if k.startswith("app")}
    yield
    # After the test, restore the original set.
    # 1. Remove any app.* modules the test added or replaced.
    for key in list(sys.modules.keys()):
        if key.startswith("app"):
            del sys.modules[key]
    # 2. Reinstate the pre-test modules so subsequent tests get the original objects.
    sys.modules.update(before)
