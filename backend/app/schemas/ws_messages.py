from typing import Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator


class AuthMessage(BaseModel):
    type: Literal["auth"]
    token: str = Field(..., min_length=1)


class SttPartialMessage(BaseModel):
    type: Literal["stt_partial"]
    transcript: Optional[str] = ""


class SubmitAnswerMessage(BaseModel):
    type: Literal["submit_answer"]
    transcript: str = Field(..., max_length=5000)
    duration_sec: Optional[int] = None
    filler_count: Optional[int] = None

    @field_validator("transcript")
    def validate_transcript(cls, v):
        if v is None or not isinstance(v, str):
            raise ValueError("transcript must be a non-null string")
        if len(v) > 5000:
            raise ValueError("transcript exceeds max length of 5000 characters")
        return v


class RepeatQuestionMessage(BaseModel):
    type: Literal["repeat_question"]


class SkipQuestionMessage(BaseModel):
    type: Literal["skip_question"]


class AskDoubtMessage(BaseModel):
    type: Literal["ask_doubt"]
    doubt: str = Field(..., min_length=1, max_length=500)

    @field_validator("doubt", mode="before")
    def validate_doubt(cls, v):
        if not v or not isinstance(v, str) or not v.strip():
            raise ValueError("doubt cannot be empty")
        if len(v) > 500:
            raise ValueError("doubt exceeds max length of 500 characters")
        return v.strip()


class EndSessionMessage(BaseModel):
    type: Literal["end_session"]


class RetryEvaluationMessage(BaseModel):
    type: Literal["retry_evaluation"]
    question_id: Optional[str] = None


ClientMessage = Union[
    AuthMessage,
    SttPartialMessage,
    SubmitAnswerMessage,
    RepeatQuestionMessage,
    SkipQuestionMessage,
    AskDoubtMessage,
    EndSessionMessage,
    RetryEvaluationMessage,
]
