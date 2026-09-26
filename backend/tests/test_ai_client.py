"""Cliente de IA — testado com mock (nunca chama o OpenRouter de verdade).

`scripts/ai_smoke.py` é o caminho pra exercitar a chamada real, quando há
`OPENROUTER_API_KEY` de verdade no `.env`.
"""

import pytest

from api.services.ai import ai_client


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict, text: str = ""):
        self.status_code = status_code
        self._payload = payload
        self.text = text or str(payload)

    def json(self) -> dict:
        return self._payload


class _FakeSession:
    """Substitui `curl_cffi.requests.AsyncSession` — sem rede nenhuma."""

    def __init__(self, response: _FakeResponse):
        self._response = response
        self.last_call: dict | None = None

    async def __aenter__(self) -> "_FakeSession":
        return self

    async def __aexit__(self, *exc_info) -> bool:
        return False

    async def post(self, url: str, **kwargs) -> _FakeResponse:
        self.last_call = {"url": url, **kwargs}
        return self._response


def _install_fake_session(monkeypatch: pytest.MonkeyPatch, response: _FakeResponse) -> _FakeSession:
    fake_session = _FakeSession(response)
    monkeypatch.setattr(ai_client, "AsyncSession", lambda *args, **kwargs: fake_session)
    return fake_session


async def test_complete_returns_content_and_usage(monkeypatch: pytest.MonkeyPatch):
    fake_session = _install_fake_session(
        monkeypatch,
        _FakeResponse(
            200,
            {
                "choices": [{"message": {"content": "Laticínios"}}],
                "usage": {"prompt_tokens": 42, "completion_tokens": 3},
            },
        ),
    )

    result = await ai_client.complete(
        "categorize_product",
        system_prompt="Categorize o produto.",
        user_text="Leite integral 1L",
    )

    assert result.content == "Laticínios"
    assert result.prompt_tokens == 42
    assert result.completion_tokens == 3
    assert result.cost_usd > 0
    assert result.model == "google/gemini-3.1-flash-lite"
    assert fake_session.last_call["url"].endswith("/chat/completions")
    assert fake_session.last_call["json"]["model"] == "google/gemini-3.1-flash-lite"


async def test_complete_sends_image_when_provided(monkeypatch: pytest.MonkeyPatch):
    fake_session = _install_fake_session(
        monkeypatch,
        _FakeResponse(
            200,
            {
                "choices": [{"message": {"content": '{"nome": "Arroz", "preco": "5.99"}'}}],
                "usage": {"prompt_tokens": 100, "completion_tokens": 10},
            },
        ),
    )

    result = await ai_client.complete(
        "price_tag_ocr",
        system_prompt="Extraia nome e preço da etiqueta.",
        user_text="Etiqueta em anexo.",
        image_base64="ZmFrZS1pbWFnZS1ieXRlcw==",
        json_output=True,
    )

    sent_messages = fake_session.last_call["json"]["messages"]
    user_content = sent_messages[1]["content"]
    assert isinstance(user_content, list)
    assert user_content[1]["type"] == "image_url"
    assert "base64" in user_content[1]["image_url"]["url"]
    assert fake_session.last_call["json"]["response_format"] == {"type": "json_object"}
    assert "Arroz" in result.content


async def test_complete_raises_on_provider_error(monkeypatch: pytest.MonkeyPatch):
    _install_fake_session(monkeypatch, _FakeResponse(500, {}, text="internal error"))

    with pytest.raises(ai_client.AiProviderError):
        await ai_client.complete(
            "categorize_product",
            system_prompt="Categorize.",
            user_text="Arroz",
        )


async def test_complete_raises_on_unknown_task():
    with pytest.raises(ai_client.AiTaskNotConfiguredError):
        await ai_client.complete(
            "tarefa_que_nao_existe",
            system_prompt="x",
            user_text="y",
        )
