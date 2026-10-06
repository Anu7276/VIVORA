import pytest
from app.llm.router import (
    get_shared_http_client,
    close_shared_http_client,
    TASK_MAX_TOKENS,
    SmartRuleFallbackProvider,
)
from app.agents.question_agent import question_agent

@pytest.mark.anyio
async def test_singleton_shared_http_client():
    client1 = get_shared_http_client()
    client2 = get_shared_http_client()
    assert client1 is client2, "get_shared_http_client must return the singleton instance"
    assert not client1.is_closed

    await close_shared_http_client()
    assert client1.is_closed

    # Re-acquisition creates a fresh open client
    client3 = get_shared_http_client()
    assert not client3.is_closed
    await close_shared_http_client()

def test_task_max_tokens_configuration():
    assert TASK_MAX_TOKENS.get("live_turn") == 250
    assert TASK_MAX_TOKENS.get("evaluation") == 600
    assert TASK_MAX_TOKENS.get("question_generation") == 1500
    assert TASK_MAX_TOKENS.get("report") == 2500

@pytest.mark.anyio
async def test_fallback_generates_at_least_five_interview_questions():
    provider = SmartRuleFallbackProvider()
    res = await provider.generate_json(
        prompt='Target Job Role: "Full Stack Engineer"\nExperience Level: "Senior"',
        system_prompt="You are an interviewer."
    )
    assert "questions" in res
    assert len(res["questions"]) >= 5
