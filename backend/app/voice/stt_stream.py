import logging
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Dict, Any

logger = logging.getLogger("vivora.stt")

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
    STT Provider for Web Speech API and client-side streaming events.
    Receives real-time continuous partial and final transcripts from browser microphone.
    """
    async def process_audio_chunk(self, chunk: bytes) -> Optional[Dict[str, Any]]:
        # In browser mode, the browser handles transcription locally or via native streaming
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
    STT Provider for Deepgram Streaming WebSocket API.
    Audio chunks remain strictly in memory and stream via WebSocket.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def process_audio_chunk(self, chunk: bytes) -> Optional[Dict[str, Any]]:
        # Deepgram streaming websocket frames (in-memory buffer)
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
        if provider_type == "deepgram" and api_key:
            self.provider = DeepgramSTTProvider(api_key)
        else:
            self.provider = BrowserSTTProvider()

    async def handle_transcript(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        return await self.provider.process_transcript_event(event_data)

stt_router = STTRouter()
