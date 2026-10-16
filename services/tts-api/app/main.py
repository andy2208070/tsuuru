from fastapi import FastAPI

app = FastAPI(title="Tsuuru TTS API", version="0.1.0")


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Report that the API process is healthy."""
    return {"status": "ok"}