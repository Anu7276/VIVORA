from dataclasses import dataclass
from typing import Optional

@dataclass
class ModeConfig:
    mode: str
    question_source_default: str  # "fixed" or "generated"
    allow_followups: bool
    allow_doubts: bool
    voice_rate: float
    silence_threshold_sec: float
    communication_scoring: bool
    time_limit_min: int

class ModeStrategy:
    CONFIGS = {
        "school": ModeConfig(
            mode="school",
            question_source_default="fixed",
            allow_followups=False,
            allow_doubts=True,
            voice_rate=0.9,
            silence_threshold_sec=2.5,
            communication_scoring=False,
            time_limit_min=15
        ),
        "college": ModeConfig(
            mode="college",
            question_source_default="generated",
            allow_followups=True,
            allow_doubts=False,
            voice_rate=1.0,
            silence_threshold_sec=1.8,
            communication_scoring=False,
            time_limit_min=20
        ),
        "interview": ModeConfig(
            mode="interview",
            question_source_default="generated",
            allow_followups=True,
            allow_doubts=False,
            voice_rate=1.05,
            silence_threshold_sec=1.4,
            communication_scoring=True,
            time_limit_min=30
        )
    }

    @classmethod
    def get_config(cls, mode: str) -> ModeConfig:
        return cls.CONFIGS.get(mode.lower(), cls.CONFIGS["school"])
