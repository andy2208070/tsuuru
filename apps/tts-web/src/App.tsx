import { useEffect, useState, type FormEvent } from "react";
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

type ServiceState = "checking" | "online" | "offline";

const MAX_CHARACTERS = 3000;
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
  { number: "01", title: "Enter your text", text: "Paste or type up to 3,000 characters." },
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [subtitleSrt, setSubtitleSrt] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const activeVoice = voices.find((voice) => voice.name === selectedVoice) ?? DEFAULT_VOICES[0];

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

  function chooseVoice(name: string) {
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

    setIsGenerating(true);
    setAudioUrl(null);
    setSubtitleSrt("");
    setNotice({ kind: "info", message: "Generating speech. Please wait..." });

    try {
      const response = await fetch(apiUrl("/api/tts"), {
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
      const result = (await response.json().catch(() => ({}))) as SynthesisResponse;

      if (!response.ok) {
        throw new Error(result.detail ?? "Speech synthesis failed. Please try again later.");
      }
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
              <span className="character-count">{text.length.toLocaleString()} <span>/ {MAX_CHARACTERS.toLocaleString()}</span></span>
            </div>

            <div className="text-input-wrap">
              <label className="sr-only" htmlFor="tts-text">Text to convert</label>
              <textarea
                id="tts-text"
                maxLength={MAX_CHARACTERS}
                onChange={(event) => setText(event.currentTarget.value)}
                placeholder="Type or paste the text you want to convert..."
                value={text}
              />
              <span aria-hidden="true" className="textarea-watermark">T</span>
            </div>

            <div className="editor-toolbar">
              <span>Supports Mandarin and English, up to 3,000 characters</span>
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
                return (
                  <label
                    className={`voice-option${isSelected ? " selected" : ""}`}
                    htmlFor={`voice-${voice.name}`}
                    key={voice.name}
                  >
                    <input
                      checked={isSelected}
                      id={`voice-${voice.name}`}
                      name="tts-voice"
                      onChange={() => chooseVoice(voice.name)}
                      type="radio"
                      value={voice.name}
                    />
                    <span aria-hidden="true" className={`voice-avatar ${voice.gender === "Male" ? "avatar-male" : "avatar-female"}`}>
                      {voice.gender === "Male" ? "M" : "F"}
                    </span>
                    <span className="voice-option-copy">
                      <strong>{name ?? voice.description}</strong>
                      <small>{description ?? voice.language}</small>
                    </span>
                    <span aria-hidden="true" className="voice-check">✓</span>
                  </label>
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
            <p className="voice-footnote">Up to 3,000 characters · Audio is available for download during this session</p>
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