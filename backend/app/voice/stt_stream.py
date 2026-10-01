import logging
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger("vivora.stt")

# STT Provider implementation status:
#   browser   — ✅ Implemented (Web Speech API, client-side, Chrome/Edge only)
#   deepgram  — ⚠️ Stub: interface wired, HTTP connection not yet implemented;
#               audio would stream through VIVORA server RAM → Deepgram cloud
#   whisper   — 🔧 Planned: self-hosted option (audio stays fully in-infrastructure);
#               not yet implemented


class BaseSTTProvider(ABC):
    """
    Abstract interface for Speech-to-Text streaming.
    All audio must be processed in memory and NEVER written to disk.
    """
    @abstractmethod
    async def process_audio_chunk(self, chunk: bytes) -> Optional[Dict[str, Any]]:
        """Process incoming raw audio bytes in memory."""
        pass

    @abstractmethod
    async def process_transcript_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process streaming partial/final transcript events (e.g. from browser or proxy)."""
        pass


class BrowserSTTProvider(BaseSTTProvider):
    """
    ✅ Implemented — Web Speech API (client-side, Chrome/Edge only).
    Recognition happens inside the browser engine. Audio MAY be sent to
    the browser vendor (e.g. Google) but never reaches VIVORA servers.
    """
    async def process_audio_chunk(self, chunk: bytes) -> Optional[Dict[str, Any]]:
        # In browser mode the browser handles transcription locally or via its vendor
        return None

    async def process_transcript_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        transcript = event_data.get("transcript", "").strip()
        is_final = event_data.get("is_final", False)
        confidence = event_data.get("confidence", 0.95)
        return {
            "transcript": transcript,
            "is_final": is_final,
            "confidence": confidence,
            "provider": "browser"
        }


class DeepgramSTTProvider(BaseSTTProvider):
    """
    ⚠️ Stub — interface wired, real WebSocket connection NOT yet implemented.
    When implemented: audio streams through VIVORA server RAM and is forwarded
    to Deepgram's cloud API for recognition. Audio never touches disk.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        logger.warning(
            "DeepgramSTTProvider selected but real streaming is not yet implemented. "
            "Falling back to stub behaviour (empty transcripts)."
        )

    async def process_audio_chunk(self, chunk: bytes) -> Optional[Dict[str, Any]]:
        # TODO: open Deepgram streaming WebSocket and forward chunk
        return {
            "transcript": "",
            "is_final": False,
            "provider": "deepgram"
        }

    async def process_transcript_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "transcript": event_data.get("transcript", ""),
            "is_final": event_data.get("is_final", False),
            "confidence": 0.98,
            "provider": "deepgram"
        }


class STTRouter:
    def __init__(
        self,
        provider_type: Optional[str] = None,
        api_key: Optional[str] = None,
        allow_fallback: Optional[bool] = None
    ):
        ptype = (provider_type or settings.STT_PROVIDER).lower()
        key = api_key if api_key is not None else settings.DEEPGRAM_API_KEY
        fallback_allowed = allow_fallback if allow_fallback is not None else settings.ALLOW_STT_FALLBACK

        if ptype == "whisper":
            # 🔧 Planned — fail at startup/init with clear error, not NotImplementedError mid-session
            raise ValueError(
                "STT_PROVIDER=whisper is planned but not yet implemented. "
                "Use STT_PROVIDER=browser (default) or STT_PROVIDER=deepgram."
            )
        elif ptype == "deepgram":
            if key:
                self.provider = DeepgramSTTProvider(key)
            elif fallback_allowed:
                logger.warning(
                    "STT_PROVIDER=deepgram requested but DEEPGRAM_API_KEY is missing. "
                    "ALLOW_STT_FALLBACK=True; falling back to browser STT."
                )
                self.provider = BrowserSTTProvider()
            else:
                raise ValueError(
                    "STT_PROVIDER is set to 'deepgram' but DEEPGRAM_API_KEY is missing and "
                    "ALLOW_STT_FALLBACK is False. Set DEEPGRAM_API_KEY or set ALLOW_STT_FALLBACK=true "
                    "to allow fallback to browser STT."
                )
        elif ptype == "browser":
            self.provider = BrowserSTTProvider()
        else:
            raise ValueError(
                f"Unknown STT provider '{ptype}'. Supported providers are: browser, deepgram."
            )

    async def handle_transcript(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        return await self.provider.process_transcript_event(event_data)


stt_router = STTRouter()
