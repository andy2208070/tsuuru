import base64

import httpx
import pytest

from app.main import app


@pytest.mark.anyio
async def test_health_check() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_voice_catalog_returns_supported_mandarin_voices() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/voices")

    assert response.status_code == 200
    voices = response.json()
    assert len(voices) == 8
    assert voices[0]["name"] == "zh-CN-XiaoxiaoNeural"
    assert {voice["name"] for voice in voices} == {
        "zh-CN-XiaoxiaoNeural",
        "zh-CN-XiaoyiNeural",
        "zh-CN-YunjianNeural",
        "zh-CN-YunxiNeural",
        "zh-CN-YunxiaNeural",
        "zh-CN-YunyangNeural",
        "zh-CN-liaoning-XiaobeiNeural",
        "zh-CN-shaanxi-XiaoniNeural",
    }


@pytest.mark.anyio
async def test_synthesis_returns_audio_and_optional_subtitles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    parameters: dict[str, str] = {}

    class FakeCommunicate:
        def __init__(self, text: str, voice: str, *, rate: str, pitch: str) -> None:
            parameters.update(text=text, voice=voice, rate=rate, pitch=pitch)

        async def stream(self):
            yield {"type": "audio", "data": b"test-mp3"}
            yield {
                "type": "WordBoundary",
                "offset": 0,
                "duration": 2_500_000,
                "text": "Hello",
            }

    monkeypatch.setattr("app.main.edge_tts.Communicate", FakeCommunicate)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/tts",
            json={
                "text": "  Hello  ",
                "voice": "zh-CN-shaanxi-XiaoniNeural",
                "subtitle": True,
                "speed": 1.5,
                "pitch": 0.8,
            },
        )

    assert response.status_code == 200
    result = response.json()
    assert base64.b64decode(result["audio_base64"]) == b"test-mp3"
    assert result["mime_type"] == "audio/mpeg"
    assert result["subtitle_srt"] == "1\n00:00:00,000 --> 00:00:00,250\nHello"
    assert parameters == {
        "text": "Hello",
        "voice": "zh-CN-shaanxi-XiaoniNeural",
        "rate": "+50%",
        "pitch": "-10Hz",
    }


@pytest.mark.anyio
async def test_synthesis_rejects_invalid_input() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/tts",
            json={"text": "   ", "voice": "zh-CN-XiaoxiaoNeural"},
        )

    assert response.status_code == 422


@pytest.mark.anyio
async def test_synthesis_rejects_unknown_voice() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/tts",
            json={"text": "Hello", "voice": "not-a-real-voice"},
        )

    assert response.status_code == 422
