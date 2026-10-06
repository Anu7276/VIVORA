import time
from collections import defaultdict
from typing import Dict, List, Optional
import os
from fastapi import Request, HTTPException, status

class SimpleRateLimiter:
    """
    In-memory sliding window rate limiter with automatic stale key eviction (F-BE-06).
    """
    def __init__(self, max_requests: int = 10, window_sec: int = 60, max_keys: int = 1000):
        self.max_requests = max_requests
        self.window_sec = window_sec
        self.max_keys = max_keys
        self._records: Dict[str, List[float]] = defaultdict(list)
        self._last_cleanup = time.monotonic()

    def check_and_record(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_sec

        # Periodic cleanup to prevent unbounded dict growth
        if len(self._records) > self.max_keys or (now - self._last_cleanup > 300):
            self.cleanup(now)

        timestamps = [t for t in self._records.get(key, []) if t > cutoff]
        if len(timestamps) >= self.max_requests:
            self._records[key] = timestamps
            return False

        timestamps.append(now)
        self._records[key] = timestamps
        return True

    def cleanup(self, now: Optional[float] = None) -> None:
        if now is None:
            now = time.monotonic()
        cutoff = now - self.window_sec
        keys_to_delete = []
        for k, timestamps in list(self._records.items()):
            valid = [t for t in timestamps if t > cutoff]
            if not valid:
                keys_to_delete.append(k)
            else:
                self._records[k] = valid
        for k in keys_to_delete:
            self._records.pop(k, None)
        self._last_cleanup = now

# Global rate limiters
session_start_limiter = SimpleRateLimiter(max_requests=10, window_sec=60)
upload_limiter = SimpleRateLimiter(max_requests=10, window_sec=60)
doubt_limiter = SimpleRateLimiter(max_requests=5, window_sec=60)
