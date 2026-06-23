"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Screen = "home" | "studio" | "library" | "mobile";
type StudioStatus = "ready" | "recording" | "transcribing" | "illustrating" | "complete" | "error";

type Tale = {
  id: string;
  title: string;
  teller: string;
  duration: string;
  accent: string;
  icon: string;
  gradient: string;
  excerpt: string;
  imageUrl?: string;
};

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const MAX_RECORDING_SECONDS = 30;
const BAR_COUNT = 44;

const ACCENTS = [
  "Jamaican Patois",
  "Trinidadian Creole",
  "Bajan",
  "Haitian Kreyòl",
  "Guyanese",
];

const FEATURES = [
  {
    icon: "headphones",
    title: "Accent-native",
    body: "A model trained on real island voices—not a generic transcriber.",
    gradient: "linear-gradient(135deg,#ff9e2c,#ff5630)",
  },
  {
    icon: "sparkles",
    title: "Live & illustrated",
    body: "Record your voice, receive a transcript, and turn the moment into scene art.",
    gradient: "linear-gradient(135deg,#ffc94d,#ff5630)",
  },
  {
    icon: "book",
    title: "A living archive",
    body: "Save each tale to your library and help preserve folklore for the next generation.",
    gradient: "linear-gradient(135deg,#e5286f,#ff5630)",
  },
];

const INITIAL_TALES: Tale[] = [
  {
    id: "anansi-sky-god",
    title: "Anansi & the Sky-God",
    teller: "Told by Miss Ivy · Jamaica",
    duration: "4:12",
    accent: "Jamaican Patois",
    icon: "🕷️",
    gradient: "linear-gradient(135deg,#ff5630,#e5286f 60%,#ff5630)",
    excerpt:
      "Long time ago, Anansi heard that all the wisdom in the world could be his—if he could complete the Sky-God’s impossible tasks.",
  },
  {
    id: "soucouyant",
    title: "The Soucouyant",
    teller: "Told by Earl · Trinidad",
    duration: "6:38",
    accent: "Trini Creole",
    icon: "🔥",
    gradient: "linear-gradient(135deg,#ff9e2c,#ff5630)",
    excerpt:
      "When night settles over the village, a ball of fire slips between the silk-cotton trees, looking for a house with an open window.",
  },
  {
    id: "papa-bois",
    title: "Papa Bois of the Forest",
    teller: "Told by Lystra · Tobago",
    duration: "5:01",
    accent: "Trini Creole",
    icon: "🌿",
    gradient: "linear-gradient(135deg,#ff9e2c,#d9461f)",
    excerpt:
      "Deep in the forest, the old guardian walks on cloven feet and whistles a warning whenever hunters take more than they need.",
  },
  {
    id: "rolling-calf",
    title: "The Rolling Calf",
    teller: "Told by Devon · Jamaica",
    duration: "3:45",
    accent: "Jamaican Patois",
    icon: "🐂",
    gradient: "linear-gradient(135deg,#e5286f,#ff5630)",
    excerpt:
      "Chains rattled behind him on the moonlit road, and every time he looked back, the red-eyed calf was closer.",
  },
  {
    id: "ti-jean",
    title: "Ti Jean & the Devil",
    teller: "Told by Marie · Haiti",
    duration: "7:20",
    accent: "Haitian Kreyòl",
    icon: "😈",
    gradient: "linear-gradient(135deg,#ff5630,#ffc94d)",
    excerpt:
      "Ti Jean had no gold and no great strength, but he carried the one thing the Devil could never predict: a clever plan.",
  },
  {
    id: "diablesse",
    title: "The Diablesse",
    teller: "Told by Sandra · Dominica",
    duration: "5:55",
    accent: "Dominican Creole",
    icon: "🌙",
    gradient: "linear-gradient(135deg,#d9461f,#ff5630)",
    excerpt:
      "She appeared at the crossroads dressed for a grand dance, but beneath the long skirt was one polished hoof.",
  },
];

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Icon({ name }: { name: string }) {
  if (name === "headphones") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <path d="M6.5 13H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1.5V13Zm11 0H19a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1.5V13Z" />
      </svg>
    );
  }
  if (name === "sparkles") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 1.2 3.2L16.5 7.5l-3.3 1.3L12 12l-1.2-3.2-3.3-1.3 3.3-1.3L12 3Z" />
        <path d="m18.5 13 1 2.5L22 16.5l-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5ZM6 13l.8 2.2L9 16l-2.2.8L6 19l-.8-2.2L3 16l2.2-.8L6 13Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H4V5.5Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v18a3 3 0 0 1 3-3h3V5.5Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="2.5" width="8" height="13" rx="4" />
      <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5v3M8.5 21.5h7" />
    </svg>
  );
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(
    safeSeconds % 60,
  ).padStart(2, "0")}`;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) || ""
  );
}

async function convertToWav(blob: Blob): Promise<Blob> {
  const AudioContextClass = window.AudioContext;
  const audioContext = new AudioContextClass();

  try {
    const source = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(source.slice(0));
    const channelCount = audioBuffer.numberOfChannels;
    const frameCount = audioBuffer.length;
    const bytesPerSample = 2;
    const buffer = new ArrayBuffer(44 + frameCount * channelCount * bytesPerSample);
    const view = new DataView(buffer);
    let offset = 0;

    const writeText = (value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
      offset += value.length;
    };

    writeText("RIFF");
    view.setUint32(offset, 36 + frameCount * channelCount * bytesPerSample, true);
    offset += 4;
    writeText("WAVE");
    writeText("fmt ");
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, channelCount, true);
    offset += 2;
    view.setUint32(offset, audioBuffer.sampleRate, true);
    offset += 4;
    view.setUint32(offset, audioBuffer.sampleRate * channelCount * bytesPerSample, true);
    offset += 4;
    view.setUint16(offset, channelCount * bytesPerSample, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeText("data");
    view.setUint32(offset, frameCount * channelCount * bytesPerSample, true);
    offset += 4;

    const channels = Array.from({ length: channelCount }, (_, index) =>
      audioBuffer.getChannelData(index),
    );

    for (let frame = 0; frame < frameCount; frame += 1) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: "audio/wav" });
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

async function responseError(response: Response) {
  try {
    const data = await response.json();
    return data.error || data.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function imageUrlFromResponse(response: Response): Promise<string | null> {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  if (contentType.startsWith("image/")) {
    return URL.createObjectURL(await response.blob());
  }

  const data = await response.json();
  const value =
    data.imageUrl || data.url || data.image || data.imageUrlBase64 || data.base64;

  if (!value || typeof value !== "string") return null;
  if (value.startsWith("data:image") || value.startsWith("http")) return value;
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 100) {
    return `data:image/png;base64,${value.replace(/\s/g, "")}`;
  }
  return value;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [studioStatus, setStudioStatus] = useState<StudioStatus>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sceneUrl, setSceneUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedTales, setSavedTales] = useState<Tale[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedTale, setSelectedTale] = useState<Tale | null>(null);
  const [pendingStart, setPendingStart] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const currentSceneUrlRef = useRef<string | null>(null);

  const isBusy = studioStatus === "transcribing" || studioStatus === "illustrating";
  const isRecording = studioStatus === "recording";
  const allTales = useMemo(() => [...savedTales, ...INITIAL_TALES], [savedTales]);

  const setAudioObjectUrl = useCallback((url: string | null) => {
    if (currentAudioUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
    }
    currentAudioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  const setSceneObjectUrl = useCallback((url: string | null) => {
    if (currentSceneUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(currentSceneUrlRef.current);
    }
    currentSceneUrlRef.current = url;
    setSceneUrl(url);
  }, []);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const processRecording = useCallback(
    async (wavBlob: Blob) => {
      setStudioStatus("transcribing");
      setNotice(null);

      try {
        const form = new FormData();
        form.append("audio", wavBlob, `carivoice-${Date.now()}.wav`);

        const transcriptionResponse = await fetch(`${BACKEND_URL}/transcribe`, {
          method: "POST",
          body: form,
        });

        if (!transcriptionResponse.ok) {
          throw new Error(await responseError(transcriptionResponse));
        }

        const transcriptionData = await transcriptionResponse.json();
        const text = String(
          transcriptionData.transcript ||
            transcriptionData.text ||
            transcriptionData.answer ||
            "",
        ).trim();

        if (!text) {
          throw new Error("The recording was received, but no speech was detected.");
        }

        setTranscript(text);
        setStudioStatus("illustrating");

        try {
          const imageResponse = await fetch(`${BACKEND_URL}/generate-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });

          if (!imageResponse.ok) {
            throw new Error(await responseError(imageResponse));
          }

          const nextSceneUrl = await imageUrlFromResponse(imageResponse);
          if (!nextSceneUrl) throw new Error("The image service returned no artwork.");
          setSceneObjectUrl(nextSceneUrl);
        } catch (imageError) {
          console.error(imageError);
          setNotice("Your transcript is ready, but the illustration service is unavailable.");
        }

        setStudioStatus("complete");
      } catch (error) {
        console.error(error);
        setStudioStatus("error");
        setNotice(
          error instanceof Error
            ? error.message
            : "CariVoice could not process that recording. Please try again.",
        );
      }
    },
    [setSceneObjectUrl],
  );

  const stopRecording = useCallback(() => {
    clearTimers();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      stopMediaStream();
      setStudioStatus("ready");
    }
  }, [clearTimers, stopMediaStream]);

  const startRecording = useCallback(async () => {
    if (isBusy || isRecording) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStudioStatus("error");
      setNotice("This browser does not support microphone recording. Try a current version of Chrome, Edge, Firefox, or Safari.");
      return;
    }

    try {
      setNotice(null);
      setTranscript("");
      setAudioBlob(null);
      setAudioObjectUrl(null);
      setSceneObjectUrl(null);
      setIsSaved(false);
      setElapsed(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        clearTimers();
        stopMediaStream();
        setStudioStatus("error");
        setNotice("The microphone stopped unexpectedly. Please try another recording.");
      };

      recorder.onstop = async () => {
        clearTimers();
        const rawBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        stopMediaStream();

        if (!rawBlob.size) {
          setStudioStatus("error");
          setNotice("No audio was captured. Check your microphone and try again.");
          return;
        }

        try {
          const wavBlob = await convertToWav(rawBlob);
          setAudioBlob(wavBlob);
          setAudioObjectUrl(URL.createObjectURL(wavBlob));
          await processRecording(wavBlob);
        } catch (error) {
          console.error(error);
          setStudioStatus("error");
          setNotice("The recording could not be prepared for transcription. Please try again.");
        }
      };

      recorder.start(250);
      setStudioStatus("recording");

      const startedAt = Date.now();
      intervalRef.current = window.setInterval(() => {
        setElapsed(Math.min(MAX_RECORDING_SECONDS, (Date.now() - startedAt) / 1000));
      }, 100);
      timeoutRef.current = window.setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      console.error(error);
      stopMediaStream();
      setStudioStatus("error");
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      setNotice(
        denied
          ? "Microphone access was blocked. Allow microphone access in your browser and try again."
          : "CariVoice could not open your microphone. Check that it is connected and not in use elsewhere.",
      );
    }
  }, [
    clearTimers,
    isBusy,
    isRecording,
    processRecording,
    setAudioObjectUrl,
    setSceneObjectUrl,
    stopMediaStream,
    stopRecording,
  ]);

  const navigate = useCallback(
    (nextScreen: Screen) => {
      if (isRecording) stopRecording();
      setSelectedTale(null);
      setScreen(nextScreen);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [isRecording, stopRecording],
  );

  const startSession = useCallback(() => {
    if (screen === "studio") {
      void startRecording();
      return;
    }
    setScreen("studio");
    setPendingStart(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen, startRecording]);

  useEffect(() => {
    if (screen === "studio" && pendingStart) {
      setPendingStart(false);
      const id = window.setTimeout(() => void startRecording(), 250);
      return () => window.clearTimeout(id);
    }
  }, [pendingStart, screen, startRecording]);

  useEffect(() => {
    const renderWaveform = () => {
      const container = waveformRef.current;
      if (container) {
        const bars = container.children;
        const analyser = analyserRef.current;
        const frequencyData = analyser
          ? new Uint8Array(analyser.frequencyBinCount)
          : null;

        if (analyser && frequencyData) analyser.getByteFrequencyData(frequencyData);
        const time = performance.now() / 1000;

        for (let index = 0; index < bars.length; index += 1) {
          const element = bars[index] as HTMLElement;
          let scale = 0.08 + (Math.sin(time * 1.4 + index * 0.48) + 1) * 0.025;
          if (frequencyData) {
            const bin = Math.floor((index / bars.length) * frequencyData.length);
            scale = 0.12 + (frequencyData[bin] / 255) * 0.88;
          }
          element.style.transform = `scaleY(${scale.toFixed(3)})`;
        }
      }
      animationRef.current = requestAnimationFrame(renderWaveform);
    };

    animationRef.current = requestAnimationFrame(renderWaveform);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTale(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      stopMediaStream();
      if (currentAudioUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
      if (currentSceneUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(currentSceneUrlRef.current);
      }
    },
    [clearTimers, stopMediaStream],
  );

  const retryProcessing = useCallback(() => {
    if (audioBlob) void processRecording(audioBlob);
  }, [audioBlob, processRecording]);

  const downloadAudio = useCallback(() => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `carivoice-recording-${Date.now()}.wav`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }, [audioBlob]);

  const downloadTranscript = useCallback(() => {
    if (!transcript) return;
    const file = new Blob([`CariVoice Story\n\n${transcript}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `carivoice-story-${Date.now()}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }, [transcript]);

  const saveStory = useCallback(() => {
    if (!transcript || isSaved) return;
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const tale: Tale = {
      id: `recorded-${Date.now()}`,
      title: "My recorded story",
      teller: `Recorded today · ${new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`,
      duration: formatTime(elapsed),
      accent: "Caribbean voice",
      icon: "🎙️",
      gradient: "linear-gradient(135deg,#ff9e2c,#ff5630 55%,#e5286f)",
      excerpt:
        transcript.length > 190 ? `${transcript.slice(0, 187).trim()}…` : transcript,
      imageUrl: sceneUrl || undefined,
    };
    if (wordCount > 0) setSavedTales((current) => [tale, ...current]);
    setIsSaved(true);
    setNotice("Story saved to your library.");
  }, [elapsed, isSaved, sceneUrl, transcript]);

  const statusLabel = {
    ready: "Ready",
    recording: "Listening…",
    transcribing: "Transcribing…",
    illustrating: "Illustrating…",
    complete: isSaved ? "Saved" : "Story ready",
    error: "Needs attention",
  }[studioStatus];

  return (
    <main className="site-shell">
      <nav className="top-nav" aria-label="Main navigation">
        <button className="brand-button" onClick={() => navigate("home")} aria-label="CariVoice home">
          <LogoMark />
          <span className="brand-name">
            Cari<span>Voice</span>
          </span>
        </button>

        <div className="nav-actions">
          <div className="nav-links">
            {(["home", "studio", "library", "mobile"] as Screen[]).map((item) => (
              <button
                key={item}
                className={screen === item ? "nav-link active" : "nav-link"}
                onClick={() => navigate(item)}
                aria-current={screen === item ? "page" : undefined}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <button className="gradient-button nav-cta" onClick={startSession}>
            Start telling
          </button>
        </div>
      </nav>

      {screen === "home" && (
        <section className="home-screen">
          <div className="floating-shape shape-one" />
          <div className="floating-shape shape-two" />
          <div className="floating-shape shape-three" />

          <div className="hero">
            <div className="eyebrow">
              <span />
              Trained on real Caribbean voices
            </div>
            <h1>
              Tell your story in
              <br />
              <span>the voice you grew up with.</span>
            </h1>
            <p>
              CariVoice understands Patois, Creole and every island accent in between—
              turning spoken folklore into living, illustrated tales.
            </p>
            <div className="hero-actions">
              <button className="gradient-button hero-primary" onClick={startSession}>
                <MicIcon /> Start a recording
              </button>
              <button className="secondary-button" onClick={() => navigate("library")}>
                Browse the library
              </button>
            </div>
          </div>

          <div className="accent-list" aria-label="Supported accents">
            {ACCENTS.map((accent) => (
              <span key={accent}>{accent}</span>
            ))}
          </div>

          <div className="feature-band">
            <div className="feature-glow feature-glow-one" />
            <div className="feature-glow feature-glow-two" />
            <div className="feature-grid">
              {FEATURES.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon" style={{ background: feature.gradient }}>
                    <Icon name={feature.icon} />
                  </div>
                  <h2>{feature.title}</h2>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {screen === "studio" && (
        <section className="page-section studio-screen">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Your story starts here</p>
              <h1>Live Studio</h1>
              <p>Press record and speak your tale—we’ll transcribe and illustrate it for you.</p>
            </div>
            <div className={`status-pill status-${studioStatus}`} aria-live="polite">
              <span />
              {statusLabel}
            </div>
          </div>

          {notice && (
            <div className={studioStatus === "error" ? "notice error" : "notice"} role="status">
              <span>{notice}</span>
              {studioStatus === "error" && audioBlob && (
                <button onClick={retryProcessing}>Try processing again</button>
              )}
              <button className="notice-close" onClick={() => setNotice(null)} aria-label="Dismiss message">
                ×
              </button>
            </div>
          )}

          <div className="studio-grid">
            <div className="capture-card">
              <div className="capture-glow" />
              <p className="capture-label">Voice capture</p>

              <div className="waveform" ref={waveformRef} aria-hidden="true">
                {Array.from({ length: BAR_COUNT }, (_, index) => (
                  <span key={index} />
                ))}
              </div>

              <div className="timer">{formatTime(elapsed)}</div>
              <div className="record-control">
                {isRecording && <span className="record-ring" />}
                <button
                  className={isRecording ? "record-button recording" : "record-button"}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isBusy}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                  {isRecording ? <span className="stop-icon" /> : <MicIcon />}
                </button>
              </div>
              <p className="record-hint">
                {isRecording
                  ? `Recording—tap to stop · ${MAX_RECORDING_SECONDS}s maximum`
                  : isBusy
                    ? "Your story is being prepared…"
                    : "Tap the mic to begin"}
              </p>

              {audioUrl && !isRecording && (
                <div className="audio-preview">
                  <audio controls src={audioUrl}>
                    Your browser does not support audio playback.
                  </audio>
                  <button onClick={downloadAudio}>Download .wav</button>
                </div>
              )}
            </div>

            <div className="studio-results">
              <article className="transcript-card">
                <div className="card-heading">
                  <h2>Transcript</h2>
                  <span className={transcript ? "accent-badge detected" : "accent-badge"}>
                    {transcript ? "Caribbean voice · captured" : "Detecting accent…"}
                  </span>
                </div>
                <div className="transcript-copy" aria-live="polite">
                  {studioStatus === "transcribing" ? (
                    <span className="processing-line">Listening closely to every word…</span>
                  ) : transcript ? (
                    <p>{transcript}</p>
                  ) : (
                    <p className="placeholder">
                      Your words will appear here, in your own accent…
                    </p>
                  )}
                </div>
                {transcript && (
                  <div className="result-actions">
                    <button onClick={saveStory} disabled={isSaved}>
                      {isSaved ? "Saved to library" : "Save to library"}
                    </button>
                    <button onClick={downloadTranscript}>Download transcript</button>
                  </div>
                )}
              </article>

              <article className="scene-card">
                <div
                  className={sceneUrl ? "scene-art has-image" : "scene-art"}
                  style={sceneUrl ? { backgroundImage: `url("${sceneUrl}")` } : undefined}
                >
                  <div className="scene-pattern" />
                  {studioStatus === "illustrating" ? (
                    <div className="scene-loading">
                      <span />
                      <strong>Illustrating your story</strong>
                      <small>Painting an island-inspired scene…</small>
                    </div>
                  ) : (
                    <div className={transcript ? "scene-caption visible" : "scene-caption"}>
                      <span className="scene-icon">🕷️</span>
                      <strong>{transcript ? "Your story, brought to life" : "Your scene will appear here"}</strong>
                    </div>
                  )}
                  <div className="scene-footer">
                    {sceneUrl ? "AI-illustrated scene · generated from your story" : "Auto-illustrated scene"}
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      )}

      {screen === "library" && (
        <section className="page-section library-screen">
          <div className="section-heading library-heading">
            <div>
              <p className="section-kicker">Voices worth keeping</p>
              <h1>Story Library</h1>
              <p>Tales told and saved across the islands.</p>
            </div>
            <button className="gradient-button library-record" onClick={startSession}>
              <MicIcon /> Add your story
            </button>
          </div>

          <div className="tale-grid">
            {allTales.map((tale) => (
              <button className="tale-card" key={tale.id} onClick={() => setSelectedTale(tale)}>
                <span
                  className={tale.imageUrl ? "tale-art has-image" : "tale-art"}
                  style={{
                    backgroundImage: tale.imageUrl
                      ? `url("${tale.imageUrl}")`
                      : tale.gradient,
                  }}
                >
                  <span className="tale-pattern" />
                  <span className="duration-badge">{tale.duration}</span>
                  <span className="tale-icon">{tale.icon}</span>
                  <span className="play-badge" aria-hidden="true">
                    →
                  </span>
                </span>
                <span className="tale-copy">
                  <strong>{tale.title}</strong>
                  <span>{tale.teller}</span>
                  <em>{tale.accent}</em>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {screen === "mobile" && (
        <section className="mobile-screen page-section">
          <div className="mobile-copy">
            <p className="section-kicker">Stories travel</p>
            <h1>
              CariVoice
              <br />
              in your pocket
            </h1>
            <p>
              The same warm, accent-aware studio—tuned for one-thumb storytelling on
              the go.
            </p>
            <button className="gradient-button" onClick={() => navigate("studio")}>
              Open the recording studio
            </button>
          </div>

          <div className="phone" aria-label="CariVoice mobile preview">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="phone-content">
                <div className="phone-brand">
                  <LogoMark />
                  <strong>CariVoice</strong>
                </div>
                <div className="phone-recorder">
                  <span className="phone-listening">Ready to listen</span>
                  <div className="phone-wave" aria-hidden="true">
                    {[18, 44, 30, 52, 24, 40, 16].map((height, index) => (
                      <span key={index} style={{ height }} />
                    ))}
                  </div>
                  <button onClick={startSession} aria-label="Start a recording">
                    <MicIcon />
                  </button>
                </div>
                <div className="phone-transcript">
                  <span>Jamaican Patois · 98%</span>
                  <p>
                    Anansi the spider hear say all the wisdom in the world coulda be
                    his…
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {selectedTale && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedTale(null)}>
          <article
            className="story-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedTale(null)}
              aria-label="Close story"
            >
              ×
            </button>
            <div
              className={selectedTale.imageUrl ? "modal-art has-image" : "modal-art"}
              style={{
                backgroundImage: selectedTale.imageUrl
                  ? `url("${selectedTale.imageUrl}")`
                  : selectedTale.gradient,
              }}
            >
              <span>{selectedTale.icon}</span>
            </div>
            <div className="modal-copy">
              <span className="accent-badge detected">{selectedTale.accent}</span>
              <h2 id="story-title">{selectedTale.title}</h2>
              <p className="modal-teller">
                {selectedTale.teller} · {selectedTale.duration}
              </p>
              <p className="modal-excerpt">{selectedTale.excerpt}</p>
              <button
                className="gradient-button"
                onClick={() => {
                  setSelectedTale(null);
                  startSession();
                }}
              >
                <MicIcon /> Tell your own version
              </button>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
