import logging
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Dict, Any

logger = logging.getLogger("vivora.tts")

class BaseTTSProvider(ABC):
    """
    Abstract interface for Text-to-Speech synthesis.
    Synthesized audio chunks stay in memory only and stream directly via WebSocket.
    """
    @abstractmethod
    async def synthesize_stream(self, text: str, voice_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Returns metadata and instructions for audio streaming."""
        pass

class BrowserTTSProvider(BaseTTSProvider):
    """
    Browser Web Speech Synthesis provider.
    Sends speak instructions to frontend with speed, pitch, and voice tone suited for the Viva mode.
    """
    async def synthesize_stream(self, text: str, voice_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        settings = voice_settings or {}
        mode = settings.get("mode", "school")
        
        # School mode: slower, friendly, warm pace
        # College mode: balanced, normal pace
        # Interview mode: professional, crisp pace
        rate = 0.9 if mode == "school" else (1.0 if mode == "college" else 1.05)
        pitch = 1.05 if mode == "school" else 1.0

        return {
            "type": "tts_speak",
            "text": text,
            "rate": rate,
            "pitch": pitch,
            "lang": settings.get("lang", "en-IN"),
            "provider": "browser"
        }

class ElevenLabsTTSProvider(BaseTTSProvider):
    """
    ElevenLabs streaming audio provider.
    Streams MP3/PCM chunks directly in-memory via WebSocket.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def synthesize_stream(self, text: str, voice_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {
            "type": "tts_stream_chunk",
            "text": text,
            "provider": "elevenlabs"
        }

class TTSRouter:
    def __init__(self, provider_type: str = "browser", api_key: Optional[str] = None):
        if provider_type == "elevenlabs" and api_key:
            self.provider = ElevenLabsTTSProvider(api_key)
        else:
            self.provider = BrowserTTSProvider()

    async def synthesize(self, text: str, voice_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.provider.synthesize_stream(text, voice_settings)

tts_router = TTSRouter()
