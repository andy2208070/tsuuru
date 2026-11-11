import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@tsuuru/shared-ui";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

type Voice = {
  name: string;
  description: string;
  gender: "Female" | "Male";
  language: string;
};

type Notice = {
  kind: "info" | "success" | "error";
  message: string;
};

type SynthesisResponse = {
  audio_base64?: string;
  mime_type?: string;
  subtitle_srt?: string | null;
  detail?: string;
};

type SynthesisStreamEvent =
  | { type: "progress"; progress: number; message: string }
  | { type: "complete"; progress: number; result: SynthesisResponse }
  | { type: "error"; detail: string };

type ServiceState = "checking" | "online" | "offline";

const TASK_CHARACTERS = 3000;
const API_BASE_URL = (import.meta.env.VITE_TTS_API_BASE_URL ?? "").replace(/\/+$/, "");
const VOICE_STORAGE_KEY = "tsuuru.tts.selectedVoice";

const DEFAULT_VOICES: Voice[] = [
  { name: "zh-CN-XiaoxiaoNeural", description: "Xiaoxiao - Warm, sweet female voice", gender: "Female", language: "zh-CN" },
  { name: "zh-CN-XiaoyiNeural", description: "Xiaoyi - Fresh, natural female voice", gender: "Female", language: "zh-CN" },
  { name: "zh-CN-YunjianNeural", description: "Yunjian - Mature, steady male voice", gender: "Male", language: "zh-CN" },
  { name: "zh-CN-YunxiNeural", description: "Yunxi - Bright, energetic male voice", gender: "Male", language: "zh-CN" },
  { name: "zh-CN-YunxiaNeural", description: "Yunxia - Youthful, expressive male voice", gender: "Male", language: "zh-CN" },
  { name: "zh-CN-YunyangNeural", description: "Yunyang - Professional, broadcast-ready male voice", gender: "Male", language: "zh-CN" },
  { name: "zh-CN-liaoning-XiaobeiNeural", description: "Xiaobei - Warm Northeastern Mandarin female voice", gender: "Female", language: "zh-CN-liaoning" },
  { name: "zh-CN-shaanxi-XiaoniNeural", description: "Xiaoni - Bright Shaanxi Mandarin female voice", gender: "Female", language: "zh-CN-shaanxi" },
];

const SAMPLE_TEXT =
  "Welcome to the text-to-speech studio!\n\nEnter or paste your text, choose a voice, and adjust the speed and pitch to create natural-sounding audio. You can also generate subtitles for your videos.";
const VOICE_PREVIEW_TEXT_ENGLISH = "Small steps every day lead to big results.";
const VOICE_PREVIEW_TEXT_CHINESE = "滾滾長江東逝水";

const highlights = [
  { icon: "8", title: "8 Mandarin voices", detail: "Professional voices for a range of content" },
  { icon: "↕", title: "Speed and pitch", detail: "Fine-tune pacing and vocal expression" },
  { icon: "CC", title: "Synchronized subtitles", detail: "Generate an SRT file in one click" },
];

const featureCards = [
  { icon: "TTS", title: "Natural-sounding speech", text: "Choose from Mandarin neural voices for narration, study materials, and everyday content." },
  { icon: "↕", title: "Flexible voice controls", text: "Fine-tune speed and pitch to suit your content and listening context." },
  { icon: "CC", title: "Audio and subtitle downloads", text: "Preview your results and download MP3 audio or SRT subtitles." },
];

const usageSteps = [
  { number: "01", title: "Enter your text", text: "Paste or type any amount of text. Long text is split into synthesis tasks." },
  { number: "02", title: "Choose a voice", text: "Select a voice from the Mandarin collection." },
  { number: "03", title: "Adjust settings", text: "Set the speed and pitch, and choose whether to include subtitles." },
  { number: "04", title: "Preview and download", text: "Listen to the result, then save the audio or subtitle file." },
];

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function readPreferredVoice(): string {
  try {
    return window.localStorage.getItem(VOICE_STORAGE_KEY) ?? DEFAULT_VOICES[0].name;
  } catch {
    return DEFAULT_VOICES[0].name;
  }
}

function rememberVoice(name: string): void {
  try {
    window.localStorage.setItem(VOICE_STORAGE_KEY, name);
  } catch {
    // Keep the selected voice for this page even if storage is unavailable.
  }
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function readSynthesisStream(
  response: Response,
  onProgress: (progress: number, message: string) => void,
): Promise<SynthesisResponse> {
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as SynthesisResponse;
    throw new Error(result.detail ?? "Speech synthesis failed. Please try again later.");
  }
  if (!response.body) {
    throw new Error("Progress updates are unavailable. Please try again.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let synthesisResult: SynthesisResponse | null = null;

  function processLine(line: string) {
    if (!line.trim()) {
      return;
    }
    const event = JSON.parse(line) as SynthesisStreamEvent;
    if (event.type === "progress") {
      onProgress(event.progress, event.message);
    } else if (event.type === "error") {
      throw new Error(event.detail);
    } else {
      synthesisResult = event.result;
      onProgress(event.progress, "Finishing your audio...");
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      pending += decoder.decode(value, { stream: true });
    }

    let newlineIndex = pending.indexOf("\n");
    while (newlineIndex >= 0) {
      processLine(pending.slice(0, newlineIndex));
      pending = pending.slice(newlineIndex + 1);
      newlineIndex = pending.indexOf("\n");
    }

    if (done) {
      pending += decoder.decode();
      processLine(pending);
      break;
    }
  }

  if (!synthesisResult) {
    throw new Error("The service did not return any audio. Please try again.");
  }
  return synthesisResult;
}

function SiteHeader() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <Link aria-label="Tsuuru Speech Studio home" className="brand" to="/">
          <span aria-hidden="true" className="brand-mark">TS</span>
          <span className="brand-name">
            <strong>Tsuuru</strong>
            <small>EDGE TTS STUDIO</small>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="main-nav">
          <a href="/#converter">Speech studio</a>
          <a href="/#guide">How it works</a>
          <Link to="/about">About</Link>
        </nav>
        <span className="free-badge"><span aria-hidden="true" />Free to use · No sign-up</span>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span>Tsuuru · Online text-to-speech</span>
        <span>Speech synthesis powered by Edge TTS</span>
        <Link to="/about">About</Link>
      </div>
    </footer>
  );
}

function TTSStudio() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [voices, setVoices] = useState(DEFAULT_VOICES);
  const [selectedVoice, setSelectedVoice] = useState(readPreferredVoice);
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [includeSubtitle, setIncludeSubtitle] = useState(false);
  const [voiceServiceState, setVoiceServiceState] = useState<ServiceState>("checking");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState("");
  const [previewState, setPreviewState] = useState<{
    voiceName: string;
    status: "loading" | "playing";
  } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [subtitleSrt, setSubtitleSrt] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const previewRequestId = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const activeVoice = voices.find((voice) => voice.name === selectedVoice) ?? DEFAULT_VOICES[0];
  const characterCount = Array.from(text).length;
  const taskCount = Math.ceil(characterCount / TASK_CHARACTERS);

  useEffect(() => {
    let isMounted = true;

    async function loadVoices() {
      try {
        const response = await fetch(apiUrl("/api/voices"));
        if (!response.ok) {
          throw new Error("Voice service unavailable");
        }

        const result: unknown = await response.json();
        if (!Array.isArray(result) || result.length === 0) {
          throw new Error("No voices returned");
        }

        const availableVoices = result as Voice[];
        if (!isMounted) {
          return;
        }

        setVoices(availableVoices);
        setVoiceServiceState("online");
        const preferred = readPreferredVoice();
        setSelectedVoice(
          availableVoices.some((voice) => voice.name === preferred)
            ? preferred
            : availableVoices[0].name,
        );
      } catch {
        if (isMounted) {
          setVoiceServiceState("offline");
        }
      }
    }

    void loadVoices();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!audioUrl) {
      return;
    }
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  useEffect(() => () => {
    previewRequestId.current += 1;
    previewAbortRef.current?.abort();
    clearPreviewAudio();
  }, []);

  function clearPreviewAudio() {
    if (previewAudioRef.current) {
      previewAudioRef.current.onended = null;
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  function stopVoicePreview() {
    previewRequestId.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    clearPreviewAudio();
    setPreviewState(null);
  }

  async function handleVoicePreview(voice: Voice) {
    if (previewState?.voiceName === voice.name) {
      stopVoicePreview();
      return;
    }

    stopVoicePreview();
    const requestId = previewRequestId.current;
    const abortController = new AbortController();
    previewAbortRef.current = abortController;
    setPreviewState({ voiceName: voice.name, status: "loading" });

    try {
      const sampleText = voice.language.toLowerCase().startsWith("zh")
        ? VOICE_PREVIEW_TEXT_CHINESE
        : VOICE_PREVIEW_TEXT_ENGLISH;
      const response = await fetch(apiUrl("/api/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          text: sampleText,
          voice: voice.name,
          subtitle: false,
          speed,
          pitch,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as SynthesisResponse;
      if (!response.ok) {
        throw new Error(result.detail ?? "Voice preview failed. Please try again.");
      }
      if (!result.audio_base64) {
        throw new Error("The service did not return preview audio.");
      }
      if (requestId !== previewRequestId.current) {
        return;
      }

      const audioBytes = decodeBase64(result.audio_base64);
      const audioBuffer = new ArrayBuffer(audioBytes.byteLength);
      new Uint8Array(audioBuffer).set(audioBytes);
      const previewUrl = URL.createObjectURL(
        new Blob([audioBuffer], { type: result.mime_type ?? "audio/mpeg" }),
      );
      const previewAudio = new Audio(previewUrl);
      previewUrlRef.current = previewUrl;
      previewAudioRef.current = previewAudio;
      previewAudio.onended = () => {
        if (requestId === previewRequestId.current) {
          clearPreviewAudio();
          setPreviewState(null);
        }
      };
      setPreviewState({ voiceName: voice.name, status: "playing" });
      await previewAudio.play();
      previewAbortRef.current = null;
    } catch (error) {
      if (requestId !== previewRequestId.current) {
        return;
      }
      clearPreviewAudio();
      setPreviewState(null);
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Voice preview failed. Please try again.",
      });
    }
  }

  function chooseVoice(name: string) {
    stopVoicePreview();
    setSelectedVoice(name);
    rememberVoice(name);
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedText = text.trim();
    if (!normalizedText) {
      setNotice({ kind: "error", message: "Enter some text to convert." });
      return;
    }

    stopVoicePreview();
    setIsGenerating(true);
    setGenerationProgress(1);
    setGenerationMessage("Preparing your text...");
    setAudioUrl(null);
    setSubtitleSrt("");
    setNotice({ kind: "info", message: "Generating speech. Please wait..." });

    try {
      const response = await fetch(apiUrl("/api/tts/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: normalizedText,
          voice: selectedVoice,
          subtitle: includeSubtitle,
          speed,
          pitch,
        }),
      });
      const result = await readSynthesisStream(response, (progress, message) => {
        setGenerationProgress(progress);
        setGenerationMessage(message);
      });
      if (!result.audio_base64) {
        throw new Error("The service did not return any audio. Please try again.");
      }

      const audioBytes = decodeBase64(result.audio_base64);
      const audioBuffer = new ArrayBuffer(audioBytes.byteLength);
      new Uint8Array(audioBuffer).set(audioBytes);
      const audioBlob = new Blob([audioBuffer], { type: result.mime_type ?? "audio/mpeg" });
      setAudioUrl(URL.createObjectURL(audioBlob));
      setSubtitleSrt(result.subtitle_srt ?? "");
      setNotice({ kind: "success", message: "Conversion complete. Preview or download your audio." });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Conversion failed. Make sure the TTS API is running.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadSubtitle() {
    if (!subtitleSrt) {
      return;
    }
    const subtitleUrl = URL.createObjectURL(
      new Blob([subtitleSrt], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = subtitleUrl;
    link.download = "tsuuru-subtitles.srt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(subtitleUrl), 1000);
  }

  return (
    <div className="tts-app">
      <SiteHeader />
      <main className="page-shell">
        <section aria-labelledby="hero-title" className="hero-section">
          <div className="hero-copy">
            <p className="hero-eyebrow"><span aria-hidden="true" /> EDGE-POWERED SPEECH STUDIO</p>
            <h1 id="hero-title">Make every word <span>sound natural.</span></h1>
            <p className="hero-description">
              A free online text-to-speech tool. Choose a Mandarin voice, fine-tune the speed and pitch, then generate and download high-quality audio.
            </p>
            <Button
              className="hero-button"
              onClick={() => document.getElementById("converter")?.scrollIntoView({ behavior: "smooth" })}
              type="button"
            >
              Start creating <span aria-hidden="true">↓</span>
            </Button>
          </div>
          <div aria-label="Product highlights" className="hero-highlights">
            {highlights.map((item) => (
              <article className="highlight-card" key={item.title}>
                <span aria-hidden="true" className="highlight-icon">{item.icon}</span>
                <span className="highlight-copy">
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
              </article>
            ))}
          </div>
        </section>

        <form aria-label="Text-to-speech settings" className="converter-layout" id="converter" onSubmit={handleGenerate}>
          <section aria-labelledby="editor-title" className="editor-card">
            <div className="section-heading">
              <div>
                <p className="step-label">01 / Text</p>
                <h2 id="editor-title">Enter the text to convert</h2>
              </div>
              <span className="character-count">{characterCount.toLocaleString()} characters · {taskCount.toLocaleString()} tasks</span>
            </div>

            <div className="text-input-wrap">
              <label className="sr-only" htmlFor="tts-text">Text to convert</label>
              <textarea
                id="tts-text"
                onChange={(event) => setText(event.currentTarget.value)}
                placeholder="Type or paste the text you want to convert..."
                value={text}
              />
              <span aria-hidden="true" className="textarea-watermark">T</span>
            </div>

            <div className="editor-toolbar">
              <span>Long text is automatically split into tasks of up to 3,000 characters.</span>
              <div className="text-actions">
                <button onClick={() => setText(SAMPLE_TEXT)} type="button">Load sample</button>
                <button onClick={() => setText("")} type="button">Clear text</button>
              </div>
            </div>

            <div className="selected-voice-summary">
              <span aria-hidden="true" className="voice-summary-mark">♪</span>
              <span className="summary-label">Selected voice</span>
              <strong>{activeVoice.description}</strong>
              <span className="summary-divider" />
              <span className="summary-language">Mandarin</span>
            </div>

            <div className="tuning-panel">
              <div className="tuning-heading">
                <div>
                  <p className="step-label">03 / Voice settings</p>
                  <h3>Fine-tune your voice</h3>
                </div>
                <span className="tuning-note">Preview your changes anytime</span>
              </div>
              <div className="tuning-grid">
                <div className="setting-item">
                  <div className="setting-heading">
                    <label htmlFor="speech-speed">Speed</label>
                    <output htmlFor="speech-speed">{speed.toFixed(1)}×</output>
                  </div>
                  <div className="range-row">
                    <span>0.5×</span>
                    <input
                      id="speech-speed"
                      max="2"
                      min="0.5"
                      onChange={(event) => setSpeed(Number(event.currentTarget.value))}
                      step="0.1"
                      type="range"
                      value={speed}
                    />
                    <span>2.0×</span>
                  </div>
                </div>
                <div className="setting-item">
                  <div className="setting-heading">
                    <label htmlFor="speech-pitch">Pitch</label>
                    <output htmlFor="speech-pitch">{pitch.toFixed(1)}×</output>
                  </div>
                  <div className="range-row">
                    <span>0.5×</span>
                    <input
                      id="speech-pitch"
                      max="2"
                      min="0.5"
                      onChange={(event) => setPitch(Number(event.currentTarget.value))}
                      step="0.1"
                      type="range"
                      value={pitch}
                    />
                    <span>2.0×</span>
                  </div>
                </div>
              </div>
            </div>

            {notice && (
              <p aria-live="polite" className={`notice notice-${notice.kind}`} role="status">
                <span aria-hidden="true">{notice.kind === "success" ? "✓" : notice.kind === "error" ? "!" : "…"}</span>
                {notice.message}
              </p>
            )}

            {audioUrl && (
              <section aria-label="Generated speech" className="audio-result">
                <div className="result-heading">
                  <div>
                    <p className="step-label">Result</p>
                    <h3>Your speech is ready</h3>
                  </div>
                  <span className="format-badge">MP3</span>
                </div>
                <audio controls preload="metadata" src={audioUrl}>
                  Your browser does not support audio playback.
                </audio>
                <div className="result-actions">
                  <a className="download-link download-audio" download="tsuuru-speech.mp3" href={audioUrl}>
                    <span aria-hidden="true">↓</span>Download audio
                  </a>
                  {subtitleSrt && (
                    <button className="download-link download-subtitle" onClick={downloadSubtitle} type="button">
                      <span aria-hidden="true">CC</span>Download subtitles
                    </button>
                  )}
                </div>
              </section>
            )}
          </section>

          <aside aria-labelledby="voice-title" className="voice-panel">
            <div className="section-heading voice-heading">
              <div>
                <p className="step-label">02 / Voice</p>
                <h2 id="voice-title">Choose your voice</h2>
              </div>
              <span className={`service-state state-${voiceServiceState}`} title="TTS API status">
                <span aria-hidden="true" />
                {voiceServiceState === "online" ? "Connected" : voiceServiceState === "checking" ? "Connecting" : "Offline"}
              </span>
            </div>

            <label className="language-label" htmlFor="voice-language">Language</label>
            <select className="language-select" id="voice-language" disabled value="zh-CN">
              <option value="zh-CN">Chinese · Mandarin</option>
            </select>

            <div className="voice-list-heading">
              <h3>Select a voice</h3>
              <span>{voices.length} voices</span>
            </div>
            <div aria-label="Available Mandarin voices" className="voice-list" role="radiogroup">
              {voices.map((voice) => {
                const isSelected = selectedVoice === voice.name;
                const [name, description] = voice.description.split(" - ");
                const isPreviewActive = previewState?.voiceName === voice.name;
                return (
                  <div className={`voice-option${isSelected ? " selected" : ""}`} key={voice.name}>
                    <input
                      checked={isSelected}
                      id={`voice-${voice.name}`}
                      name="tts-voice"
                      onChange={() => chooseVoice(voice.name)}
                      type="radio"
                      value={voice.name}
                    />
                    <label className="voice-option-select" htmlFor={`voice-${voice.name}`}>
                      <span aria-hidden="true" className={`voice-avatar ${voice.gender === "Male" ? "avatar-male" : "avatar-female"}`}>
                        {voice.gender === "Male" ? "M" : "F"}
                      </span>
                      <span className="voice-option-copy">
                        <strong>{name ?? voice.description}</strong>
                        <small>{description ?? voice.language}</small>
                      </span>
                      <span aria-hidden="true" className="voice-check">✓</span>
                    </label>
                    <button
                      aria-label={isPreviewActive
                        ? previewState.status === "loading"
                          ? `Loading preview for ${name ?? voice.name}`
                          : `Stop preview for ${name ?? voice.name}`
                        : `Play preview for ${name ?? voice.name}`}
                      className={`voice-preview-button${isPreviewActive ? " preview-active" : ""}`}
                      disabled={isGenerating}
                      onClick={() => void handleVoicePreview(voice)}
                      title={isPreviewActive ? "Stop preview" : "Preview voice"}
                      type="button"
                    >
                      {isPreviewActive && previewState.status === "loading" ? (
                        <span aria-hidden="true" className="preview-spinner" />
                      ) : isPreviewActive ? (
                        <svg aria-hidden="true" viewBox="0 0 16 16">
                          <path d="M5 3.5v9M11 3.5v9" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 16 16">
                          <path d="m5 3.5 7 4.5-7 4.5z" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <label className="subtitle-option" htmlFor="include-subtitle">
              <input
                checked={includeSubtitle}
                id="include-subtitle"
                onChange={(event) => setIncludeSubtitle(event.currentTarget.checked)}
                type="checkbox"
              />
              <span aria-hidden="true" className="subtitle-icon">CC</span>
              <span className="subtitle-copy">
                <strong>Generate subtitles</strong>
                <small>Create a downloadable SRT file</small>
              </span>
              <span aria-hidden="true" className="toggle-track" />
            </label>

            <button className="convert-button" disabled={isGenerating || !text.trim()} type="submit">
              {isGenerating ? <span className="button-spinner" /> : <span aria-hidden="true">✦</span>}
              {isGenerating ? "Generating..." : "Convert to speech"}
              {!isGenerating && <span aria-hidden="true" className="button-arrow">→</span>}
            </button>
            {isGenerating && (
              <div className="generation-progress">
                <div className="generation-progress-heading">
                  <span>{generationMessage}</span>
                  <strong>{generationProgress}%</strong>
                </div>
                <div
                  aria-label="Speech generation progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={generationProgress}
                  className="generation-progress-track"
                  role="progressbar"
                >
                  <span style={{ width: `${generationProgress}%` }} />
                </div>
                <span className="generation-progress-detail">
                  Processing {taskCount} {taskCount === 1 ? "task" : "tasks"}
                </span>
              </div>
            )}
            <p className="voice-footnote">No character limit · Long text is processed as multiple tasks</p>
          </aside>
        </form>

        <section aria-labelledby="features-title" className="features-section" id="features">
          <div className="section-intro">
            <p className="step-label">Made for creators</p>
            <h2 id="features-title">Simple controls. Expressive results.</h2>
            <p>Enjoy a smooth workflow from your first draft to the final download.</p>
          </div>
          <div className="features-grid">
            {featureCards.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <span aria-hidden="true" className="feature-icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="guide-title" className="steps-section" id="guide">
          <div className="section-intro">
            <p className="step-label">Get started in minutes</p>
            <h2 id="guide-title">How to use text-to-speech</h2>
          </div>
          <div className="steps-grid">
            {usageSteps.map((step) => (
              <article className="step-card" key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="tips-title" className="tips-section">
          <div className="tips-heading">
            <span aria-hidden="true" className="tips-icon">✦</span>
            <div>
              <p className="step-label">Tips</p>
              <h2 id="tips-title">Get better results</h2>
            </div>
          </div>
          <div className="tips-grid">
            <p><strong>Text pacing</strong><span>Use punctuation and natural paragraph breaks to create more realistic pauses.</span></p>
            <p><strong>Choose a voice for the context</strong><span>A clear, steady voice works well for explanations, while a livelier voice can bring stories to life.</span></p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function AboutPage() {
  return (
    <div className="tts-app">
      <SiteHeader />
      <main className="page-shell about-page">
        <Link className="back-link" to="/">← Back to studio</Link>
        <section className="about-card">
          <p className="hero-eyebrow"><span aria-hidden="true" /> ABOUT THE PROJECT</p>
          <h1>Create speech with ease.</h1>
          <p>
            Tsuuru Speech Studio is an independently buildable Edge TTS frontend in the tsuuru monorepo, built with React, TypeScript, Vite, and Tailwind CSS.
            The FastAPI service provides the voice catalog, speech synthesis, and optional SRT subtitle generation.
          </p>
          <div className="about-facts">
            <div><strong>Frontend</strong><span>React · TypeScript · Vite</span></div>
            <div><strong>API</strong><span>FastAPI · edge-tts</span></div>
            <div><strong>Standalone development</strong><span>pnpm dev:tts-web</span></div>
          </div>
          <Link className="about-action" to="/#converter">Open the studio <span aria-hidden="true">→</span></Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="tts-app">
      <SiteHeader />
      <main className="page-shell not-found-page">
        <p className="hero-eyebrow"><span aria-hidden="true" /> 404 · PAGE NOT FOUND</p>
        <h1>This page is not available.</h1>
        <Link className="about-action" to="/">Return home <span aria-hidden="true">→</span></Link>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<TTSStudio />} path="/" />
        <Route element={<AboutPage />} path="/about" />
        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}