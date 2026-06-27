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
  imageTheme?: string;
};

type StoryArtTheme = {
  id: string;
  name: string;
  colors: [string, string, string, string];
  motif: "web" | "fire" | "forest" | "calf" | "crossroads" | "moon" | "spirit" | "sea" | "circle";
  keywords: string[];
};

type ImageArtwork = {
  url: string | null;
  theme?: string;
  themeName?: string;
  source?: string;
  warning?: string;
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

const STORY_ART_THEMES: Record<string, StoryArtTheme> = {
  "island-story": {
    id: "island-story",
    name: "Caribbean folklore",
    colors: ["#21445f", "#f6b44b", "#d94131", "#fff1cf"],
    motif: "circle",
    keywords: [],
  },
  anansi: {
    id: "anansi",
    name: "Anansi trickster",
    colors: ["#244c64", "#f7b547", "#d93b2f", "#fff1ca"],
    motif: "web",
    keywords: ["anansi", "spider", "sky-god", "sky god", "wisdom", "trickster"],
  },
  soucouyant: {
    id: "soucouyant",
    name: "Soucouyant night",
    colors: ["#211331", "#ffb13c", "#e84d2a", "#ffe6b3"],
    motif: "fire",
    keywords: ["soucouyant", "fire", "ball of fire", "skin", "night", "window"],
  },
  "papa-bois": {
    id: "papa-bois",
    name: "Papa Bois forest",
    colors: ["#183b2f", "#66a858", "#f0a83b", "#e9f3c4"],
    motif: "forest",
    keywords: ["papa bois", "forest", "hunter", "hunters", "guardian", "cloven", "deer"],
  },
  "rolling-calf": {
    id: "rolling-calf",
    name: "Rolling Calf road",
    colors: ["#1f2f45", "#8896a8", "#d3382f", "#f6d28b"],
    motif: "calf",
    keywords: ["rolling calf", "calf", "bull", "chains", "chain", "red-eyed", "red eyes"],
  },
  "ti-jean": {
    id: "ti-jean",
    name: "Ti Jean hero",
    colors: ["#243b63", "#f4c04d", "#d84627", "#f6efe0"],
    motif: "crossroads",
    keywords: ["ti jean", "devil", "clever", "plan", "deal", "crossroads"],
  },
  diablesse: {
    id: "diablesse",
    name: "Diablesse crossroads",
    colors: ["#252046", "#d7c7ff", "#d84627", "#fff0d0"],
    motif: "moon",
    keywords: ["diablesse", "la diablesse", "hoof", "crossroads", "wide hat", "moon"],
  },
  duppy: {
    id: "duppy",
    name: "Duppy spirit",
    colors: ["#18243a", "#7dc6d6", "#f3b650", "#e9f7ff"],
    motif: "spirit",
    keywords: ["duppy", "jumbie", "ghost", "spirit", "haunt", "haunted"],
  },
  "sea-spirit": {
    id: "sea-spirit",
    name: "Sea spirit",
    colors: ["#0f4c5c", "#1da7a8", "#f2c14e", "#e7f8ef"],
    motif: "sea",
    keywords: ["river mumma", "mami wata", "mermaid", "sea", "ocean", "river", "water"],
  },
};

function storyThemeFromText(text: string) {
  const haystack = text.toLowerCase();
  let bestTheme = STORY_ART_THEMES["island-story"];
  let bestScore = 0;

  Object.values(STORY_ART_THEMES).forEach((theme) => {
    const score = theme.keywords.reduce(
      (total, keyword) => total + (haystack.includes(keyword) ? (keyword.includes(" ") ? 3 : 1) : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestTheme = theme;
    }
  });

  return bestTheme;
}

function storyMotifSvg(theme: StoryArtTheme) {
  const [dark, mid, hot, light] = theme.colors;

  if (theme.motif === "web") {
    return `
      <g transform="translate(360 245)" stroke="${light}" stroke-width="5" stroke-linecap="round" opacity=".9">
        <circle r="52" fill="none"/><circle r="92" fill="none"/><circle r="136" fill="none"/>
        ${Array.from({ length: 12 }, (_, index) => `<line x1="0" y1="0" x2="0" y2="-148" transform="rotate(${index * 30})"/>`).join("")}
      </g>
      <g transform="translate(360 270)" filter="url(#shadow)">
        <ellipse cx="0" cy="16" rx="40" ry="49" fill="${dark}"/><circle cx="0" cy="-35" r="30" fill="${dark}"/>
        <path d="M-32-2C-99 8-105 56-146 68M32-2C99 8 105 56 146 68M-26 24C-89 55-78 99-121 120M26 24C89 55 78 99 121 120" fill="none" stroke="${dark}" stroke-width="13" stroke-linecap="round"/>
        <circle cx="-11" cy="-41" r="5" fill="${hot}"/><circle cx="11" cy="-41" r="5" fill="${hot}"/>
      </g>`;
  }

  if (theme.motif === "fire") {
    return `
      <g transform="translate(360 265)" filter="url(#shadow)">
        <path d="M0-164C69-89 148-52 108 61 84 126 28 165-40 150-108 134-138 66-105-1-79-59-33-70 0-164Z" fill="${hot}"/>
        <path d="M9-98C48-48 82-15 62 51 46 102-5 118-41 83-77 48-54 2 9-98Z" fill="${mid}"/>
        <path d="M6-38C28-10 37 29 8 64-15 41-18 4 6-38Z" fill="${light}"/>
      </g>`;
  }

  if (theme.motif === "forest") {
    return `
      <g transform="translate(360 260)" filter="url(#shadow)">
        <path d="M-39 126C-25 58-29-1-12-75-4-109 30-109 38-75 56-1 51 58 66 126Z" fill="${dark}"/>
        <path d="M-134 9C-77-116 29-150 126-36 58-45 9-18-17 56-46 39-82 28-134 9Z" fill="${mid}" opacity=".9"/>
        <path d="M-190 79C-110-29-20-41 76 52-11 49-67 78-110 124Z" fill="${light}" opacity=".8"/>
        <circle cx="-16" cy="-53" r="6" fill="${hot}"/><circle cx="19" cy="-53" r="6" fill="${hot}"/>
      </g>`;
  }

  if (theme.motif === "calf") {
    return `
      <g transform="translate(360 305)" filter="url(#shadow)">
        <ellipse cx="0" cy="8" rx="132" ry="62" fill="${dark}"/><circle cx="113" cy="-18" r="49" fill="${dark}"/>
        <path d="M86-52C60-95 83-109 113-70M138-53C170-95 196-79 157-40" fill="none" stroke="${dark}" stroke-width="16" stroke-linecap="round"/>
        <path d="M-88 56L-112 132M-25 61L-34 138M64 57L78 133M111 39L139 119" stroke="${dark}" stroke-width="19" stroke-linecap="round"/>
        <circle cx="102" cy="-28" r="7" fill="${hot}"/><circle cx="128" cy="-26" r="7" fill="${hot}"/>
        <path d="M-181 42C-150 82-116 80-85 41M-154 82C-124 116-90 114-59 83" fill="none" stroke="${light}" stroke-width="8" stroke-linecap="round"/>
      </g>`;
  }

  if (theme.motif === "crossroads") {
    return `
      <g transform="translate(360 288)" filter="url(#shadow)">
        <path d="M-62 168L-16-48H18L68 168Z" fill="${mid}" opacity=".85"/>
        <path d="M-198 168C-89 74 58 39 213 38L229 78C66 80-52 116-134 168Z" fill="${light}" opacity=".78"/>
        <circle cx="-12" cy="-80" r="31" fill="${dark}"/>
        <path d="M-28-51C-63 6-79 56-68 112H37C48 47 31-5 4-51Z" fill="${dark}"/>
        <path d="M37-55C78-106 123-96 160-34 115-55 83-49 58-18Z" fill="${hot}" opacity=".9"/>
      </g>`;
  }

  if (theme.motif === "moon") {
    return `
      <g transform="translate(360 276)" filter="url(#shadow)">
        <circle cx="113" cy="-117" r="58" fill="${light}" opacity=".9"/><circle cx="134" cy="-134" r="58" fill="${dark}" opacity=".4"/>
        <path d="M-80-80C-25-128 43-128 94-80 43-65-28-66-80-80Z" fill="${dark}"/>
        <circle cx="7" cy="-55" r="27" fill="${dark}"/>
        <path d="M-51-25C-100 44-121 116-136 171H149C131 110 101 40 56-25Z" fill="${hot}"/>
      </g>`;
  }

  if (theme.motif === "spirit") {
    return `
      <g transform="translate(360 275)" filter="url(#shadow)">
        <path d="M-68 138C-112 73-82-11-31-75 18-138 95-75 74 5 58 65 108 94 80 143 38 120 8 122-23 153-35 135-48 131-68 138Z" fill="${light}" opacity=".76"/>
        <circle cx="-4" cy="-42" r="6" fill="${hot}"/><circle cx="23" cy="-42" r="6" fill="${hot}"/>
        <path d="M-134 101C-65 67 28 66 132 91" fill="none" stroke="${mid}" stroke-width="12" stroke-linecap="round" opacity=".6"/>
      </g>`;
  }

  if (theme.motif === "sea") {
    return `
      <g transform="translate(360 288)" filter="url(#shadow)">
        <path d="M-178 100C-91 45 7 45 92 100 30 130-91 130-178 100Z" fill="${mid}" opacity=".9"/>
        <path d="M-52 77C-43 11-22-45 16-95 61-35 77 20 68 77Z" fill="${light}" opacity=".9"/>
        <circle cx="12" cy="-103" r="28" fill="${light}"/>
        <path d="M-248 132C-181 102-111 102-43 132 25 163 94 163 161 132 188 120 216 114 248 114" fill="none" stroke="${light}" stroke-width="13" stroke-linecap="round" opacity=".82"/>
      </g>`;
  }

  return `
    <g transform="translate(360 278)" filter="url(#shadow)">
      <circle cx="-90" cy="-17" r="52" fill="${mid}"/><circle cx="0" cy="-42" r="64" fill="${hot}"/><circle cx="96" cy="-17" r="52" fill="${mid}"/>
      <path d="M-162 126C-107 52-48 27 0 27 48 27 107 52 162 126Z" fill="${dark}"/>
      <path d="M-196 146C-124 99-51 99 22 146 94 193 168 193 242 146" fill="none" stroke="${light}" stroke-width="12" stroke-linecap="round" opacity=".8"/>
    </g>`;
}

function customStoryImage(themeId: string) {
  const theme = STORY_ART_THEMES[themeId] || STORY_ART_THEMES["island-story"];
  const [dark, mid, hot, light] = theme.colors;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="460" viewBox="0 0 720 460" role="img" aria-label="${theme.name}">
    <defs>
      <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${dark}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${hot}"/>
      </linearGradient>
      <radialGradient id="glow" cx="52%" cy="38%" r="58%">
        <stop offset="0" stop-color="${light}" stop-opacity=".76"/><stop offset="1" stop-color="${light}" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-35%" y="-35%" width="170%" height="170%">
        <feDropShadow dx="0" dy="13" stdDeviation="16" flood-color="#1b0d10" flood-opacity=".35"/>
      </filter>
      <pattern id="texture" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M0 8H34M8 0V34" stroke="#fff" stroke-opacity=".07" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="720" height="460" fill="url(#sky)"/><rect width="720" height="460" fill="url(#texture)"/>
    <circle cx="128" cy="88" r="82" fill="${light}" opacity=".16"/><circle cx="530" cy="145" r="210" fill="url(#glow)"/>
    <path d="M0 332C139 278 230 310 340 270 470 222 580 250 720 196V460H0Z" fill="${dark}" opacity=".28"/>
    <path d="M0 386C100 342 207 359 306 330 420 293 540 304 720 252V460H0Z" fill="${dark}" opacity=".46"/>
    ${storyMotifSvg(theme)}
    <path d="M55 392C132 368 209 368 286 392 363 416 440 416 517 392 594 368 650 368 704 392" fill="none" stroke="${light}" stroke-width="8" stroke-linecap="round" opacity=".42"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const INITIAL_TALES: Tale[] = [
  {
    id: "anansi-sky-god",
    title: "Anansi & the Sky-God",
    teller: "Told by Miss Ivy · Jamaica",
    duration: "4:12",
    accent: "Jamaican Patois",
    icon: "🕷️",
    gradient: "linear-gradient(135deg,#ff5630,#e5286f 60%,#ff5630)",
    imageUrl: customStoryImage("anansi"),
    imageTheme: "anansi",
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
    imageUrl: customStoryImage("soucouyant"),
    imageTheme: "soucouyant",
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
    imageUrl: customStoryImage("papa-bois"),
    imageTheme: "papa-bois",
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
    imageUrl: customStoryImage("rolling-calf"),
    imageTheme: "rolling-calf",
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
    imageUrl: customStoryImage("ti-jean"),
    imageTheme: "ti-jean",
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
    imageUrl: customStoryImage("diablesse"),
    imageTheme: "diablesse",
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

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
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

async function artworkFromResponse(response: Response): Promise<ImageArtwork> {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  if (contentType.startsWith("image/")) {
    return { url: URL.createObjectURL(await response.blob()), source: "generated" };
  }

  const data = await response.json();
  const value =
    data.imageUrl || data.url || data.image || data.imageUrlBase64 || data.base64;

  const artwork: ImageArtwork = {
    url: null,
    theme: typeof data.theme === "string" ? data.theme : undefined,
    themeName: typeof data.themeName === "string" ? data.themeName : undefined,
    source: typeof data.source === "string" ? data.source : undefined,
    warning: typeof data.warning === "string" ? data.warning : undefined,
  };

  if (!value || typeof value !== "string") return artwork;
  if (value.startsWith("data:image") || value.startsWith("http")) {
    return { ...artwork, url: value };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 100) {
    return { ...artwork, url: `data:image/png;base64,${value.replace(/\s/g, "")}` };
  }
  return { ...artwork, url: value };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function loadImageForCanvas(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (!source.startsWith("data:") && !source.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The story image could not be loaded."));
    image.src = source;
  });
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function splitLongWord(
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
) {
  const chunks: string[] = [];
  let current = "";

  Array.from(word).forEach((letter) => {
    const next = `${current}${letter}`;
    if (current && context.measureText(next).width > maxWidth) {
      chunks.push(current);
      current = letter;
      return;
    }
    current = next;
  });

  if (current) chunks.push(current);
  return chunks;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  const paragraphs = text.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    let line = "";
    const words = paragraph.split(/\s+/).flatMap((word) =>
      context.measureText(word).width > maxWidth ? splitLongWord(context, word, maxWidth) : word,
    );

    words.forEach((word) => {
      const nextLine = line ? `${line} ${word}` : word;
      if (line && context.measureText(nextLine).width > maxWidth) {
        lines.push(line);
        line = word;
        return;
      }
      line = nextLine;
    });

    if (line) lines.push(line);
    if (paragraphIndex < paragraphs.length - 1) lines.push("");
  });

  return lines.length ? lines : [text.trim()];
}

async function downloadPosterImage(
  imageUrl: string,
  transcript: string,
  themeName: string,
) {
  const image = await loadImageForCanvas(imageUrl);
  const posterWidth = 1400;
  const artworkHeight = 900;
  const textPaddingX = 84;
  const textMaxWidth = posterWidth - textPaddingX * 2;
  const fontSize = transcript.length > 900 ? 34 : 38;
  const lineHeight = Math.round(fontSize * 1.45);

  const measuringCanvas = document.createElement("canvas");
  const measuringContext = measuringCanvas.getContext("2d");
  if (!measuringContext) throw new Error("Canvas is unavailable in this browser.");

  measuringContext.font = `${fontSize}px "DM Sans", Arial, sans-serif`;
  const lines = wrapCanvasText(measuringContext, transcript, textMaxWidth);
  const textTopPadding = 72;
  const headingHeight = 86;
  const textBottomPadding = 82;
  const transcriptHeight = Math.max(lineHeight, lines.length * lineHeight);
  const posterHeight = artworkHeight + textTopPadding + headingHeight + transcriptHeight + textBottomPadding;

  const canvas = document.createElement("canvas");
  canvas.width = posterWidth;
  canvas.height = posterHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");

  context.fillStyle = "#fff4e8";
  context.fillRect(0, 0, posterWidth, posterHeight);
  drawImageCover(context, image, 0, 0, posterWidth, artworkHeight);

  const watermarkText = "CariVoice";
  context.save();
  context.font = '700 48px "Sora", Arial, sans-serif';
  context.textBaseline = "middle";
  const watermarkPaddingX = 28;
  const watermarkHeight = 78;
  const watermarkWidth = context.measureText(watermarkText).width + watermarkPaddingX * 2;
  const watermarkX = posterWidth - watermarkWidth - 42;
  const watermarkY = artworkHeight - watermarkHeight - 42;
  roundedRect(context, watermarkX, watermarkY, watermarkWidth, watermarkHeight, 24);
  context.fillStyle = "rgba(58, 20, 16, 0.62)";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 255, 255, 0.42)";
  context.stroke();
  context.fillStyle = "#ffffff";
  context.fillText(watermarkText, watermarkX + watermarkPaddingX, watermarkY + watermarkHeight / 2);
  context.restore();

  const copyTop = artworkHeight + textTopPadding;
  context.fillStyle = "#3a1410";
  context.font = '700 44px "Sora", Arial, sans-serif';
  context.fillText(`${themeName} story`, textPaddingX, copyTop);

  context.fillStyle = "#d9461f";
  context.font = '700 24px "DM Sans", Arial, sans-serif';
  context.fillText("Recorded with CariVoice", textPaddingX, copyTop + 40);

  context.fillStyle = "#3e2926";
  context.font = `${fontSize}px "DM Sans", Arial, sans-serif`;
  context.textBaseline = "top";
  let currentY = copyTop + headingHeight;
  lines.forEach((line) => {
    if (line) context.fillText(line, textPaddingX, currentY);
    currentY += lineHeight;
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
        return;
      }
      reject(new Error("The story image could not be prepared."));
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `carivoice-illustrated-story-${Date.now()}.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [studioStatus, setStudioStatus] = useState<StudioStatus>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sceneUrl, setSceneUrl] = useState<string | null>(null);
  const [sceneTheme, setSceneTheme] = useState<StoryArtTheme | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedTales, setSavedTales] = useState<Tale[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isDownloadingStoryImage, setIsDownloadingStoryImage] = useState(false);
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

        const localTheme = storyThemeFromText(text);
        setTranscript(text);
        setSceneTheme(localTheme);
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

          const artwork = await artworkFromResponse(imageResponse);
          if (!artwork.url) throw new Error("The image service returned no artwork.");
          setSceneObjectUrl(artwork.url);
          setSceneTheme(STORY_ART_THEMES[artwork.theme || ""] || localTheme);
          if (artwork.warning) setNotice(artwork.warning);
        } catch (imageError) {
          console.error(imageError);
          setSceneObjectUrl(customStoryImage(localTheme.id));
          setNotice("Your transcript is ready. CariVoice used a custom local illustration for this story.");
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
      setSceneTheme(null);
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

  const downloadStoryImage = useCallback(async () => {
    if (!sceneUrl || !transcript || isDownloadingStoryImage) return;

    setIsDownloadingStoryImage(true);
    setNotice(null);

    try {
      await downloadPosterImage(
        sceneUrl,
        transcript,
        sceneTheme?.name || "CariVoice",
      );
    } catch (error) {
      console.error(error);
      setNotice("CariVoice could not prepare that story image. Please try again.");
    } finally {
      setIsDownloadingStoryImage(false);
    }
  }, [isDownloadingStoryImage, sceneTheme, sceneUrl, transcript]);

  const saveStory = useCallback(() => {
    if (!transcript || isSaved) return;
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const theme = sceneTheme || storyThemeFromText(transcript);
    const tale: Tale = {
      id: `recorded-${Date.now()}`,
      title: theme.id === "island-story" ? "My recorded story" : `${theme.name} story`,
      teller: `Recorded today · ${new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`,
      duration: formatTime(elapsed),
      accent: "Caribbean voice",
      icon: "🎙️",
      gradient: `linear-gradient(135deg,${theme.colors[1]},${theme.colors[2]} 55%,${theme.colors[0]})`,
      excerpt:
        transcript.length > 190 ? `${transcript.slice(0, 187).trim()}…` : transcript,
      imageUrl: sceneUrl || customStoryImage(theme.id),
      imageTheme: theme.id,
    };
    if (wordCount > 0) setSavedTales((current) => [tale, ...current]);
    setIsSaved(true);
    setNotice("Story saved to your library.");
  }, [elapsed, isSaved, sceneTheme, sceneUrl, transcript]);

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
                    {sceneUrl && (
                      <button
                        className="story-download-button"
                        onClick={downloadStoryImage}
                        disabled={isDownloadingStoryImage}
                      >
                        <DownloadIcon />
                        {isDownloadingStoryImage ? "Preparing image" : "Download story image"}
                      </button>
                    )}
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
                  {sceneUrl && <span className="scene-watermark">CariVoice</span>}
                  <div className="scene-footer">
                    {sceneUrl
                      ? `${sceneTheme?.name || "Custom folklore"} scene - generated from your story`
                      : "Auto-illustrated scene"}
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
