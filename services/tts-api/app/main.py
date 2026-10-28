import base64
import logging
import os

import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

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
    text: str = Field(min_length=1, max_length=3000)
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


def format_srt_timestamp(seconds: float) -> str:
    total_milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(total_milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d},{milliseconds:03d}"


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
    """Generate MP3 audio and optional word-boundary SRT subtitles."""
    rate = round((payload.speed - 1.0) * 100)
    pitch = round((payload.pitch - 1.0) * 50)
    communicate = edge_tts.Communicate(
        payload.text,
        payload.voice,
        rate=f"{rate:+d}%",
        pitch=f"{pitch:+d}Hz",
    )

    audio_data = bytearray()
    subtitle_entries: list[str] = []

    try:
        async for chunk in communicate.stream():
            chunk_type = chunk.get("type")
            if chunk_type == "audio":
                data = chunk.get("data")
                if isinstance(data, bytes):
                    audio_data.extend(data)
            elif chunk_type == "WordBoundary" and payload.subtitle:
                try:
                    start = float(chunk["offset"]) / 10_000_000
                    end = (float(chunk["offset"]) + float(chunk["duration"])) / 10_000_000
                    text = str(chunk["text"]).strip()
                except (KeyError, TypeError, ValueError):
                    logger.warning("Skipping malformed Edge TTS word-boundary event")
                    continue

                if text:
                    subtitle_entries.append(
                        f"{len(subtitle_entries) + 1}\n"
                        f"{format_srt_timestamp(start)} --> {format_srt_timestamp(end)}\n"
                        f"{text}"
                    )

        if not audio_data:
            raise RuntimeError("Edge TTS returned no audio data")
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
