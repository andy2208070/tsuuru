import base64
import json

import httpx
import pytest

from app.main import app, configure_edge_tts_ssl_context


def test_edge_tts_ssl_context_loads_system_and_additional_ca(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, str | None]] = []

    class FakeSSLContext:
        def load_default_certs(self) -> None:
            calls.append(("system", None))

        def load_verify_locations(self, *, cafile: str) -> None:
            calls.append(("bundle", cafile))

    monkeypatch.setattr("app.main.edge_tts_communicate._SSL_CTX", FakeSSLContext())
    monkeypatch.setenv("TTS_CA_BUNDLE", "C:/certs/proxy-ca.pem")

    configure_edge_tts_ssl_context()

    assert calls == [("system", None), ("bundle", "C:/certs/proxy-ca.pem")]


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
async def test_synthesis_progress_stream_reports_progress_and_audio(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeCommunicate:
        def __init__(self, text: str, voice: str, *, rate: str, pitch: str) -> None:
            pass

        async def stream(self):
            yield {"type": "audio", "data": b"preview-audio"}
            yield {"type": "WordBoundary", "text": "Hello"}

    monkeypatch.setattr("app.main.edge_tts.Communicate", FakeCommunicate)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/tts/stream",
            json={"text": "Hello", "voice": "zh-CN-XiaoxiaoNeural"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    events = [json.loads(line) for line in response.text.splitlines()]
    progress_events = [event for event in events if event["type"] == "progress"]
    assert progress_events
    assert [event["progress"] for event in progress_events] == sorted(
        event["progress"] for event in progress_events
    )
    assert events[-1]["type"] == "complete"
    assert events[-1]["progress"] == 100
    assert base64.b64decode(events[-1]["result"]["audio_base64"]) == b"preview-audio"


@pytest.mark.anyio
async def test_synthesis_splits_unlimited_text_into_3000_character_tasks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    task_texts: list[str] = []

    class FakeCommunicate:
        def __init__(self, text: str, voice: str, *, rate: str, pitch: str) -> None:
            task_texts.append(text)

        async def stream(self):
            yield {"type": "audio", "data": task_texts[-1].encode("utf-8")}
            yield {
                "type": "WordBoundary",
                "offset": 0,
                "duration": 10_000_000,
                "text": "task",
            }

    monkeypatch.setattr("app.main.edge_tts.Communicate", FakeCommunicate)
    text = "x" * 6001
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/tts",
            json={"text": text, "voice": "zh-CN-XiaoxiaoNeural", "subtitle": True},
        )

    assert response.status_code == 200
    assert task_texts == [text[:3000], text[3000:6000], text[6000:]]
    assert all(len(task_text) <= 3000 for task_text in task_texts)
    result = response.json()
    assert base64.b64decode(result["audio_base64"]) == text.encode("utf-8")
    assert result["subtitle_srt"] == (
        "1\n00:00:00,000 --> 00:00:01,000\ntask\n\n"
        "2\n00:00:01,000 --> 00:00:02,000\ntask\n\n"
        "3\n00:00:02,000 --> 00:00:03,000\ntask"
    )


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
