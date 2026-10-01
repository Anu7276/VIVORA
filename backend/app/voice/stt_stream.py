import logging
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Dict, Any

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
    def __init__(self, provider_type: str = "browser", api_key: Optional[str] = None):
        if provider_type == "whisper":
            # 🔧 Planned — not yet implemented
            raise NotImplementedError(
                "STT_PROVIDER=whisper is planned but not yet implemented. "
                "Use STT_PROVIDER=browser (default) or STT_PROVIDER=deepgram."
            )
        elif provider_type == "deepgram" and api_key:
            self.provider = DeepgramSTTProvider(api_key)
        else:
            if provider_type == "deepgram" and not api_key:
                logger.warning(
                    "STT_PROVIDER=deepgram requested but DEEPGRAM_API_KEY is missing. "
                    "Falling back to browser STT."
                )
            self.provider = BrowserSTTProvider()

    async def handle_transcript(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        return await self.provider.process_transcript_event(event_data)


stt_router = STTRouter()
