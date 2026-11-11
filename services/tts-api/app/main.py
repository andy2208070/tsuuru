import asyncio
import base64
import json
import logging
import os
from collections.abc import Callable

import edge_tts
import edge_tts.communicate as edge_tts_communicate
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)
MAX_TASK_CHARACTERS = 3000


def configure_edge_tts_ssl_context() -> None:
    """Trust OS certificates and an optional additional CA for Edge TTS."""
    ssl_context = edge_tts_communicate._SSL_CTX
    ssl_context.load_default_certs()

    ca_bundle = os.getenv("TTS_CA_BUNDLE")
    if ca_bundle:
        ssl_context.load_verify_locations(cafile=ca_bundle)


configure_edge_tts_ssl_context()

VOICE_CATALOG: tuple[dict[str, str], ...] = (
    {
        "name": "zh-CN-XiaoxiaoNeural",
        "description": "Xiaoxiao - Warm, sweet female voice",
        "gender": "Female",
        "language": "zh-CN",
    },
    {
        "name": "zh-CN-XiaoyiNeural",
        "description": "Xiaoyi - Fresh, natural female voice",
        "gender": "Female",
        "language": "zh-CN",
    },
    {
        "name": "zh-CN-YunjianNeural",
        "description": "Yunjian - Mature, steady male voice",
        "gender": "Male",
        "language": "zh-CN",
    },
    {
        "name": "zh-CN-YunxiNeural",
        "description": "Yunxi - Bright, energetic male voice",
        "gender": "Male",
        "language": "zh-CN",
    },
    {
        "name": "zh-CN-YunxiaNeural",
        "description": "Yunxia - Youthful, expressive male voice",
        "gender": "Male",
        "language": "zh-CN",
    },
    {
        "name": "zh-CN-YunyangNeural",
        "description": "Yunyang - Professional, broadcast-ready male voice",
        "gender": "Male",
        "language": "zh-CN",
    },
    {
        "name": "zh-CN-liaoning-XiaobeiNeural",
        "description": "Xiaobei - Warm Northeastern Mandarin female voice",
        "gender": "Female",
        "language": "zh-CN-liaoning",
    },
    {
        "name": "zh-CN-shaanxi-XiaoniNeural",
        "description": "Xiaoni - Bright Shaanxi Mandarin female voice",
        "gender": "Female",
        "language": "zh-CN-shaanxi",
    },
)
VOICE_NAMES = {voice["name"] for voice in VOICE_CATALOG}

DEFAULT_ALLOWED_ORIGINS = ",".join(
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in ("5173", "5174", "5175")
)
allowed_origins = [
    origin.strip()
    for origin in os.getenv("TTS_ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
    if origin.strip()
]

app = FastAPI(title="Tsuuru TTS API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class TTSRequest(BaseModel):
    text: str = Field(min_length=1)
    voice: str = Field(min_length=1)
    subtitle: bool = False
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    pitch: float = Field(default=1.0, ge=0.5, le=2.0)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Text cannot be empty.")
        return normalized

    @field_validator("voice")
    @classmethod
    def validate_voice(cls, value: str) -> str:
        if value not in VOICE_NAMES:
            raise ValueError("Unknown voice selection.")
        return value


class SynthesisResponse(BaseModel):
    audio_base64: str
    mime_type: str = "audio/mpeg"
    subtitle_srt: str | None = None


def split_text_into_tasks(text: str) -> list[str]:
    """Split text into tasks that fit within the synthesis service limit."""
    return [
        text[start : start + MAX_TASK_CHARACTERS]
        for start in range(0, len(text), MAX_TASK_CHARACTERS)
    ]


async def synthesize_task(
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    include_subtitles: bool,
    on_progress: Callable[[int], None] | None = None,
) -> tuple[bytes, list[tuple[float, float, str]], float]:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    audio_data = bytearray()
    subtitle_boundaries: list[tuple[float, float, str]] = []
    duration = 0.0
    processed_characters = 0

    async for chunk in communicate.stream():
        chunk_type = chunk.get("type")
        if chunk_type == "audio":
            data = chunk.get("data")
            if isinstance(data, bytes):
                audio_data.extend(data)
        elif chunk_type == "WordBoundary":
            boundary_value = chunk.get("text")
            if isinstance(boundary_value, str) and boundary_value.strip():
                processed_characters += len(boundary_value.strip())
                if on_progress is not None:
                    on_progress(processed_characters)

            if not include_subtitles:
                continue

            try:
                start = float(chunk["offset"]) / 10_000_000
                end = (float(chunk["offset"]) + float(chunk["duration"])) / 10_000_000
                boundary_text = str(chunk["text"]).strip()
            except (KeyError, TypeError, ValueError):
                logger.warning("Skipping malformed Edge TTS word-boundary event")
                continue

            if boundary_text:
                subtitle_boundaries.append((start, end, boundary_text))
                duration = max(duration, end)

    if not audio_data:
        raise RuntimeError("Edge TTS returned no audio data")

    return bytes(audio_data), subtitle_boundaries, duration


def format_srt_timestamp(seconds: float) -> str:
    total_milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(total_milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d},{milliseconds:03d}"


def report_synthesis_progress(
    progress: int,
    message: str,
    callback: Callable[[int, str], None] | None,
) -> None:
    if callback is not None:
        callback(progress, message)


async def synthesize_speech(
    payload: TTSRequest,
    on_progress: Callable[[int, str], None] | None = None,
) -> SynthesisResponse:
    """Generate audio and optional subtitles, reporting synthesis progress as it advances."""
    rate = round((payload.speed - 1.0) * 100)
    pitch = round((payload.pitch - 1.0) * 50)
    rate_value = f"{rate:+d}%"
    pitch_value = f"{pitch:+d}Hz"
    tasks = split_text_into_tasks(payload.text)
    total_characters = len(payload.text)
    completed_characters = 0
    latest_progress = 0
    audio_data = bytearray()
    subtitle_entries: list[str] = []
    subtitle_offset = 0.0

    def update_progress(task_characters: int, task_number: int) -> None:
        nonlocal latest_progress
        progress = min(
            95,
            5 + round(90 * min(completed_characters + task_characters, total_characters) / total_characters),
        )
        if progress > latest_progress:
            latest_progress = progress
            report_synthesis_progress(
                progress,
                f"Generating audio · task {task_number} of {len(tasks)}",
                on_progress,
            )

    try:
        for task_number, task_text in enumerate(tasks, start=1):
            update_progress(0, task_number)
            task_audio, boundaries, task_duration = await synthesize_task(
                task_text,
                payload.voice,
                rate_value,
                pitch_value,
                payload.subtitle,
                on_progress=lambda amount, current_task=task_number: update_progress(
                    amount, current_task
                ),
            )
            audio_data.extend(task_audio)
            for start, end, text in boundaries:
                subtitle_entries.append(
                    f"{len(subtitle_entries) + 1}\n"
                    f"{format_srt_timestamp(subtitle_offset + start)} --> "
                    f"{format_srt_timestamp(subtitle_offset + end)}\n"
                    f"{text}"
                )
            subtitle_offset += task_duration
            completed_characters += len(task_text)
            update_progress(0, task_number)
    except Exception as error:
        logger.exception("Edge TTS synthesis failed")
        raise HTTPException(
            status_code=502,
            detail="The speech synthesis service is temporarily unavailable. Please try again later.",
        ) from error

    subtitle_srt = "\n\n".join(subtitle_entries) if subtitle_entries else None
    return SynthesisResponse(
        audio_base64=base64.b64encode(audio_data).decode("ascii"),
        subtitle_srt=subtitle_srt,
    )


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Report that the API process is healthy."""
    return {"status": "ok"}


@app.get("/api/voices", tags=["tts"])
def get_voices() -> list[dict[str, str]]:
    """Return the curated Mandarin voice list used by the web client."""
    return [voice.copy() for voice in VOICE_CATALOG]


@app.post("/api/tts", response_model=SynthesisResponse, tags=["tts"])
async def text_to_speech(payload: TTSRequest) -> SynthesisResponse:
    """Generate MP3 audio and optional subtitles from one or more text tasks."""
    return await synthesize_speech(payload)


@app.post("/api/tts/stream", tags=["tts"])
async def text_to_speech_with_progress(payload: TTSRequest) -> StreamingResponse:
    """Stream progress events followed by the completed synthesis response as NDJSON."""
    async def event_stream():
        events: asyncio.Queue[dict[str, object] | None] = asyncio.Queue()

        def enqueue_progress(progress: int, message: str) -> None:
            events.put_nowait({"type": "progress", "progress": progress, "message": message})

        async def run_synthesis() -> None:
            try:
                result = await synthesize_speech(payload, enqueue_progress)
                events.put_nowait(
                    {"type": "complete", "progress": 100, "result": result.model_dump()}
                )
            except HTTPException as error:
                events.put_nowait({"type": "error", "detail": str(error.detail)})
            finally:
                events.put_nowait(None)

        synthesis_task = asyncio.create_task(run_synthesis())
        yield json.dumps(
            {"type": "progress", "progress": 1, "message": "Preparing your text..."}
        ) + "\n"
        try:
            while True:
                event = await events.get()
                if event is None:
                    break
                yield json.dumps(event) + "\n"
        finally:
            if not synthesis_task.done():
                synthesis_task.cancel()
                await asyncio.gather(synthesis_task, return_exceptions=True)

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
