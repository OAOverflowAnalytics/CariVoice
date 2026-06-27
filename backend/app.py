import base64
import hashlib
import html
import logging
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import quote, urlencode

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 35 * 1024 * 1024
CORS(app, origins=os.getenv("CARIVOICE_CORS_ORIGINS", "*").split(","))

IMAGE_WIDTH = 1024
IMAGE_HEIGHT = 768
IMAGE_PROVIDER = os.getenv("CARIVOICE_IMAGE_PROVIDER", "pollinations").strip().lower()
IMAGE_BASE_URL = os.getenv("CARIVOICE_IMAGE_BASE_URL", "https://image.pollinations.ai/prompt").rstrip("/")

GENERIC_STORY_PROFILE = {
    "id": "island-story",
    "name": "Caribbean folklore story",
    "subject": "an elder sharing a vivid island folktale with listeners gathered close",
    "setting": "a warm Caribbean village at dusk, with palms, sea breeze, and lantern light",
    "details": "expressive faces, handmade textures, tropical plants, patterned cloth",
    "motif": "story-circle",
    "colors": ("#21445f", "#f6b44b", "#d94131", "#fff1cf"),
    "keywords": (),
}

STORY_PROFILES = [
    {
        "id": "anansi",
        "name": "Anansi trickster tale",
        "subject": "Anansi the clever spider bargaining with a powerful sky spirit",
        "setting": "a sunlit Jamaican village beneath a broad silk-cotton tree",
        "details": "silver webs, calabash bowls, market colors, playful trickster energy",
        "motif": "web",
        "colors": ("#244c64", "#f7b547", "#d93b2f", "#fff1ca"),
        "keywords": ("anansi", "spider", "sky-god", "sky god", "wisdom", "trickster"),
    },
    {
        "id": "soucouyant",
        "name": "Soucouyant night tale",
        "subject": "a mysterious ball of fire drifting between village windows",
        "setting": "a Trinidad village at night beside shadowy silk-cotton trees",
        "details": "glowing ember trails, moonlit rooftops, suspenseful folklore mood",
        "motif": "fire",
        "colors": ("#211331", "#ffb13c", "#e84d2a", "#ffe6b3"),
        "keywords": ("soucouyant", "fire", "ball of fire", "skin", "night", "window"),
    },
    {
        "id": "papa-bois",
        "name": "Papa Bois forest tale",
        "subject": "Papa Bois guarding the animals of the forest",
        "setting": "deep Tobago rainforest with giant leaves, vines, and filtered light",
        "details": "forest guardian silhouette, wary hunters, protected animals, green-gold mist",
        "motif": "forest",
        "colors": ("#183b2f", "#66a858", "#f0a83b", "#e9f3c4"),
        "keywords": ("papa bois", "forest", "hunter", "hunters", "guardian", "cloven", "deer"),
    },
    {
        "id": "rolling-calf",
        "name": "Rolling Calf road tale",
        "subject": "the Rolling Calf with glowing red eyes and rattling chains",
        "setting": "a moonlit Jamaican country road edged by cane fields",
        "details": "dusty road, iron chains, red eyes, blue moonlight, tense chase",
        "motif": "calf",
        "colors": ("#1f2f45", "#8896a8", "#d3382f", "#f6d28b"),
        "keywords": ("rolling calf", "calf", "bull", "chains", "chain", "red-eyed", "red eyes"),
    },
    {
        "id": "ti-jean",
        "name": "Ti Jean clever hero tale",
        "subject": "Ti Jean facing the Devil with courage and a clever plan",
        "setting": "a Haitian mountain path leading toward a fiery crossroads",
        "details": "small brave hero, looming shadow, bright dawn beyond danger",
        "motif": "crossroads",
        "colors": ("#243b63", "#f4c04d", "#d84627", "#f6efe0"),
        "keywords": ("ti jean", "devil", "clever", "plan", "deal", "crossroads"),
    },
    {
        "id": "diablesse",
        "name": "Diablesse crossroads tale",
        "subject": "La Diablesse appearing elegantly at a crossroads under the moon",
        "setting": "a Dominica or Trinidad roadside under silver moonlight",
        "details": "wide hat, flowing dress, hidden hoof, moonlit palms, dangerous beauty",
        "motif": "moon-figure",
        "colors": ("#252046", "#d7c7ff", "#d84627", "#fff0d0"),
        "keywords": ("diablesse", "la diablesse", "hoof", "crossroads", "wide hat", "moon"),
    },
    {
        "id": "duppy",
        "name": "Duppy spirit tale",
        "subject": "a restless duppy spirit moving through a moonlit yard",
        "setting": "an old Caribbean yard with breadfruit trees and silver mist",
        "details": "misty spirit shape, lantern glow, nervous witnesses, quiet suspense",
        "motif": "spirit",
        "colors": ("#18243a", "#7dc6d6", "#f3b650", "#e9f7ff"),
        "keywords": ("duppy", "jumbie", "ghost", "spirit", "haunt", "haunted"),
    },
    {
        "id": "sea-spirit",
        "name": "Sea spirit tale",
        "subject": "a radiant sea spirit rising near a moonlit Caribbean shore",
        "setting": "turquoise water, coral rocks, and palms along the coastline",
        "details": "glimmering waves, shells, moon path on water, magical sea air",
        "motif": "sea",
        "colors": ("#0f4c5c", "#1da7a8", "#f2c14e", "#e7f8ef"),
        "keywords": ("river mumma", "mami wata", "mermaid", "sea", "ocean", "river", "water"),
    },
]


def clean_story_text(story_text: str, limit: int | None = None) -> str:
    text = re.sub(r"\s+", " ", story_text).strip()
    if limit and len(text) > limit:
        return f"{text[: limit - 1].rstrip()}..."
    return text


def story_seed(story_text: str) -> int:
    digest = hashlib.sha256(clean_story_text(story_text).encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def detect_story_profile(story_text: str) -> dict:
    haystack = clean_story_text(story_text).lower()
    best_profile = GENERIC_STORY_PROFILE
    best_score = 0

    for profile in STORY_PROFILES:
        score = 0
        for keyword in profile["keywords"]:
            if keyword in haystack:
                score += 3 if " " in keyword else 1
        if score > best_score:
            best_score = score
            best_profile = profile

    return best_profile


def detect_story_setting(story_text: str) -> str:
    haystack = clean_story_text(story_text).lower()
    locations = (
        ("jamaica", "Jamaica"),
        ("trinidad", "Trinidad"),
        ("tobago", "Tobago"),
        ("haiti", "Haiti"),
        ("haitian", "Haiti"),
        ("barbados", "Barbados"),
        ("bajan", "Barbados"),
        ("guyana", "Guyana"),
        ("guyanese", "Guyana"),
        ("dominica", "Dominica"),
        ("grenada", "Grenada"),
        ("st lucia", "Saint Lucia"),
        ("saint lucia", "Saint Lucia"),
    )
    for keyword, location in locations:
        if keyword in haystack:
            return f"{location}, grounded in local Caribbean landscape and architecture"
    return "the Caribbean, with landscape details inferred from the story"


def build_image_prompt(story_text: str) -> tuple[str, dict]:
    profile = detect_story_profile(story_text)
    excerpt = clean_story_text(story_text, 700)
    location = detect_story_setting(story_text)
    prompt = (
        "Create a single custom illustration for this Caribbean folklore story. "
        "Style: warm vibrant storybook art, richly textured painted paper, cinematic but family-friendly, "
        "expressive characters, tropical light, no words, no captions, no logos, no watermark. "
        f"Story type: {profile['name']}. "
        f"Main subject: {profile['subject']}. "
        f"Setting: {profile['setting']}; location cue: {location}. "
        f"Scene details to emphasize: {profile['details']}. "
        "Use the actual story details below to choose the character action, mood, and composition. "
        f"Story excerpt: {excerpt}"
    )
    return prompt, profile


def motif_markup(profile: dict) -> str:
    dark, mid, hot, light = profile["colors"]
    motif = profile["motif"]

    if motif == "web":
        spokes = "\n".join(
            f'<line x1="0" y1="0" x2="0" y2="-210" transform="rotate({angle})" />'
            for angle in range(0, 360, 30)
        )
        return f"""
        <g transform="translate(512 355)" stroke="{light}" stroke-width="5" stroke-linecap="round" opacity="0.9">
          <circle r="75" fill="none" />
          <circle r="130" fill="none" />
          <circle r="190" fill="none" />
          {spokes}
        </g>
        <g transform="translate(512 385)" filter="url(#softShadow)">
          <ellipse cx="0" cy="24" rx="54" ry="68" fill="{dark}" />
          <circle cx="0" cy="-48" r="42" fill="{dark}" />
          <path d="M-44 -4 C-145 4 -150 86 -208 98 M44 -4 C145 4 150 86 208 98 M-38 28 C-130 64 -118 137 -174 166 M38 28 C130 64 118 137 174 166" fill="none" stroke="{dark}" stroke-width="17" stroke-linecap="round" />
          <circle cx="-16" cy="-56" r="6" fill="{hot}" />
          <circle cx="16" cy="-56" r="6" fill="{hot}" />
        </g>
        """

    if motif == "fire":
        return f"""
        <g transform="translate(512 376)" filter="url(#softShadow)">
          <path d="M0 -230 C92 -130 203 -75 148 88 C119 175 42 228 -50 207 C-142 185 -185 95 -144 2 C-106 -86 -43 -95 0 -230Z" fill="{hot}" />
          <path d="M12 -138 C64 -67 114 -20 85 74 C63 145 -7 166 -55 116 C-103 67 -73 2 12 -138Z" fill="{mid}" />
          <path d="M8 -54 C36 -13 50 43 10 91 C-22 61 -25 4 8 -54Z" fill="{light}" opacity="0.95" />
        </g>
        """

    if motif == "forest":
        return f"""
        <g transform="translate(512 364)" filter="url(#softShadow)">
          <path d="M-58 180 C-38 88 -43 -2 -18 -105 C-6 -154 42 -154 54 -105 C79 -2 73 88 94 180Z" fill="{dark}" />
          <path d="M-187 15 C-105 -159 45 -214 176 -50 C80 -62 9 -26 -25 78 C-67 54 -116 41 -187 15Z" fill="{mid}" opacity="0.9" />
          <path d="M-260 115 C-149 -41 -28 -56 105 76 C-15 72 -88 108 -146 177Z" fill="{light}" opacity="0.8" />
          <circle cx="-22" cy="-75" r="8" fill="{hot}" />
          <circle cx="28" cy="-75" r="8" fill="{hot}" />
          <path d="M-30 188 C-52 228 -71 233 -96 198 M72 188 C90 231 113 235 139 198" fill="none" stroke="{dark}" stroke-width="22" stroke-linecap="round" />
        </g>
        """

    if motif == "calf":
        return f"""
        <g transform="translate(512 420)" filter="url(#softShadow)">
          <ellipse cx="0" cy="10" rx="190" ry="88" fill="{dark}" />
          <circle cx="162" cy="-26" r="68" fill="{dark}" />
          <path d="M123 -74 C87 -134 119 -153 162 -100 M197 -76 C240 -132 277 -111 224 -56" fill="none" stroke="{dark}" stroke-width="20" stroke-linecap="round" />
          <path d="M-125 78 L-160 190 M-35 88 L-47 198 M92 80 L111 192 M159 55 L198 170" stroke="{dark}" stroke-width="25" stroke-linecap="round" />
          <circle cx="145" cy="-38" r="9" fill="{hot}" />
          <circle cx="181" cy="-35" r="9" fill="{hot}" />
          <path d="M-260 58 C-212 116 -169 112 -121 55 M-222 114 C-180 163 -131 161 -84 116" fill="none" stroke="{light}" stroke-width="10" stroke-linecap="round" opacity="0.9" />
        </g>
        """

    if motif == "crossroads":
        return f"""
        <g transform="translate(512 395)" filter="url(#softShadow)">
          <path d="M-85 248 L-22 -68 L24 -68 L93 248Z" fill="{mid}" opacity="0.85" />
          <path d="M-270 248 C-120 111 79 58 292 54 L315 110 C91 112 -69 164 -183 248Z" fill="{light}" opacity="0.75" />
          <circle cx="-18" cy="-113" r="43" fill="{dark}" />
          <path d="M-38 -73 C-86 8 -108 78 -94 161 L51 161 C67 67 43 -7 4 -73Z" fill="{dark}" />
          <path d="M50 -79 C107 -154 168 -136 218 -48 C157 -80 114 -69 80 -26Z" fill="{hot}" opacity="0.9" />
        </g>
        """

    if motif == "moon-figure":
        return f"""
        <g transform="translate(512 380)" filter="url(#softShadow)">
          <circle cx="162" cy="-168" r="82" fill="{light}" opacity="0.9" />
          <circle cx="191" cy="-191" r="82" fill="{dark}" opacity="0.42" />
          <path d="M-110 -115 C-36 -182 60 -183 130 -112 C61 -92 -38 -93 -110 -115Z" fill="{dark}" />
          <circle cx="10" cy="-79" r="37" fill="{dark}" />
          <path d="M-70 -36 C-136 64 -166 164 -186 246 L204 246 C180 158 139 56 77 -36Z" fill="{hot}" />
          <path d="M-4 112 C-7 183 13 220 73 238" fill="none" stroke="{dark}" stroke-width="23" stroke-linecap="round" />
        </g>
        """

    if motif == "spirit":
        return f"""
        <g transform="translate(512 378)" filter="url(#softShadow)">
          <path d="M-92 196 C-153 102 -111 -14 -42 -103 C25 -190 130 -102 101 6 C79 89 148 129 110 201 C52 168 10 169 -31 216 C-48 191 -65 186 -92 196Z" fill="{light}" opacity="0.75" />
          <circle cx="-5" cy="-58" r="8" fill="{hot}" />
          <circle cx="32" cy="-58" r="8" fill="{hot}" />
          <path d="M-180 143 C-87 95 38 92 176 130" fill="none" stroke="{mid}" stroke-width="16" stroke-linecap="round" opacity="0.62" />
        </g>
        """

    if motif == "sea":
        return f"""
        <g transform="translate(512 390)" filter="url(#softShadow)">
          <path d="M-246 142 C-128 65 10 64 128 142 C41 184 -123 184 -246 142Z" fill="{mid}" opacity="0.9" />
          <path d="M-72 109 C-59 15 -31 -64 22 -132 C83 -49 107 28 96 109Z" fill="{light}" opacity="0.9" />
          <circle cx="16" cy="-145" r="38" fill="{light}" />
          <path d="M-310 186 C-219 144 -126 144 -34 186 C58 228 151 228 242 186 C280 168 315 160 350 160" fill="none" stroke="{light}" stroke-width="17" stroke-linecap="round" opacity="0.82" />
          <path d="M-338 239 C-245 197 -151 197 -59 239 C33 281 127 281 219 239 C255 223 294 214 337 214" fill="none" stroke="{hot}" stroke-width="12" stroke-linecap="round" opacity="0.62" />
        </g>
        """

    return f"""
    <g transform="translate(512 386)" filter="url(#softShadow)">
      <circle cx="-125" cy="-24" r="72" fill="{mid}" />
      <circle cx="0" cy="-58" r="88" fill="{hot}" />
      <circle cx="132" cy="-24" r="72" fill="{mid}" />
      <path d="M-224 178 C-148 72 -67 36 0 36 C67 36 148 72 224 178Z" fill="{dark}" />
      <path d="M-268 205 C-169 139 -69 139 30 205 C128 270 230 270 330 205" fill="none" stroke="{light}" stroke-width="16" stroke-linecap="round" opacity="0.8" />
    </g>
    """


def fallback_svg(story_text: str, profile: dict) -> str:
    dark, mid, hot, light = profile["colors"]
    seed = story_seed(story_text)
    sun_x = 145 + (seed % 210)
    sun_y = 96 + ((seed >> 4) % 70)
    title = html.escape(profile["name"])
    metadata = html.escape(clean_story_text(story_text, 300))

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{IMAGE_WIDTH}" height="{IMAGE_HEIGHT}" viewBox="0 0 {IMAGE_WIDTH} {IMAGE_HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">{title}</title>
  <desc id="desc">A custom CariVoice illustration generated from the story theme.</desc>
  <metadata>{metadata}</metadata>
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="{dark}" />
      <stop offset="0.55" stop-color="{mid}" />
      <stop offset="1" stop-color="{hot}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="58%">
      <stop offset="0" stop-color="{light}" stop-opacity="0.78" />
      <stop offset="1" stop-color="{light}" stop-opacity="0" />
    </radialGradient>
    <filter id="softShadow" x="-35%" y="-35%" width="170%" height="170%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#1b0d10" flood-opacity="0.34" />
    </filter>
    <pattern id="texture" width="42" height="42" patternUnits="userSpaceOnUse">
      <path d="M0 8 H42 M8 0 V42" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2" />
    </pattern>
  </defs>
  <rect width="1024" height="768" fill="url(#sky)" />
  <rect width="1024" height="768" fill="url(#texture)" />
  <circle cx="{sun_x}" cy="{sun_y}" r="118" fill="{light}" opacity="0.18" />
  <circle cx="745" cy="228" r="310" fill="url(#glow)" />
  <path d="M0 560 C190 470 321 516 474 458 C656 389 814 418 1024 332 V768 H0Z" fill="{dark}" opacity="0.28" />
  <path d="M0 626 C143 559 293 584 430 530 C593 465 761 499 1024 421 V768 H0Z" fill="{dark}" opacity="0.36" />
  <path d="M0 692 C134 632 278 651 413 610 C564 563 721 579 1024 506 V768 H0Z" fill="{dark}" opacity="0.54" />
  {motif_markup(profile)}
  <path d="M84 650 C189 616 290 618 390 650 C492 684 594 684 696 650 C798 616 900 616 1004 650" fill="none" stroke="{light}" stroke-width="10" stroke-linecap="round" opacity="0.42" />
</svg>"""


def fallback_image_data_url(story_text: str, profile: dict) -> str:
    encoded = base64.b64encode(fallback_svg(story_text, profile).encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def image_payload(story_text: str, image: str, profile: dict, prompt: str, source: str, warning: str | None = None) -> dict:
    payload = {
        "image": image,
        "source": source,
        "theme": profile["id"],
        "themeName": profile["name"],
        "prompt": prompt,
    }
    if warning:
        payload["warning"] = warning
    return payload


@app.route("/", methods=["GET"])
def root():
    return jsonify({"service": "CariVoice API", "status": "ok"}), 200


@app.route("/transcribe", methods=["POST"])
def transcribe_post():
    audio_file = request.files.get("audio")
    if not audio_file or not audio_file.filename:
        return jsonify({"error": "No audio file received."}), 400

    temp_path: Path | None = None
    try:
        file_descriptor, filename = tempfile.mkstemp(prefix="carivoice-", suffix=".wav")
        os.close(file_descriptor)
        temp_path = Path(filename)
        audio_file.save(temp_path)

        if temp_path.stat().st_size == 0:
            return jsonify({"error": "The uploaded audio file was empty."}), 400

        logger.info("Transcribing %s bytes of audio", temp_path.stat().st_size)
        from transcribe import transcribe_one

        text = transcribe_one(str(temp_path))
        if not text:
            return jsonify({"error": "No speech was detected in the recording."}), 422

        return jsonify({"transcript": text}), 200
    except ModuleNotFoundError as error:
        logger.error("A transcription dependency is unavailable: %s", error)
        return jsonify(
            {
                "error": (
                    f"Missing transcription dependency: {error.name}. "
                    "Run `python -m pip install -r requirements.txt` in the backend folder."
                )
            }
        ), 503
    except FileNotFoundError as error:
        logger.error("Transcription model is unavailable: %s", error)
        return jsonify({"error": str(error)}), 503
    except Exception as error:
        logger.exception("Transcription failed")
        return jsonify({"error": f"Transcription failed: {error}"}), 500
    finally:
        if temp_path:
            temp_path.unlink(missing_ok=True)


@app.route("/generate-image", methods=["POST"])
def generate_image():
    data = request.get_json(silent=True) or {}
    story_text = str(data.get("text", "")).strip()
    if not story_text:
        return jsonify({"error": "No story text was provided."}), 400

    image_prompt, profile = build_image_prompt(story_text)

    if IMAGE_PROVIDER in {"", "fallback", "none", "off", "disabled"}:
        return jsonify(
            image_payload(
                story_text,
                fallback_image_data_url(story_text, profile),
                profile,
                image_prompt,
                "fallback",
                "External image generation is disabled.",
            )
        ), 200

    query = urlencode(
        {
            "width": IMAGE_WIDTH,
            "height": IMAGE_HEIGHT,
            "nologo": "true",
            "safe": "true",
            "seed": story_seed(story_text),
        }
    )
    image_url = f"{IMAGE_BASE_URL}/{quote(image_prompt, safe='')}?{query}"

    try:
        logger.info(
            "Generating a %s illustration for %s characters",
            profile["id"],
            len(clean_story_text(story_text)),
        )
        response = requests.get(
            image_url,
            headers={"Accept": "image/*", "User-Agent": "CariVoice/1.0"},
            timeout=90,
        )
        response.raise_for_status()

        content_type = response.headers.get("content-type", "image/jpeg")
        if not content_type.startswith("image/") or len(response.content) < 512:
            logger.warning("The image service returned an invalid image response.")
            return jsonify(
                image_payload(
                    story_text,
                    fallback_image_data_url(story_text, profile),
                    profile,
                    image_prompt,
                    "fallback",
                    "The image service returned an invalid response, so CariVoice used a custom fallback image.",
                )
            ), 200

        encoded_image = base64.b64encode(response.content).decode("utf-8")
        return jsonify(
            image_payload(
                story_text,
                f"data:{content_type};base64,{encoded_image}",
                profile,
                image_prompt,
                "generated",
            )
        ), 200
    except requests.Timeout:
        logger.warning("Image generation timed out; returning fallback artwork.")
        return jsonify(
            image_payload(
                story_text,
                fallback_image_data_url(story_text, profile),
                profile,
                image_prompt,
                "fallback",
                "The image service timed out, so CariVoice used a custom fallback image.",
            )
        ), 200
    except requests.RequestException as error:
        logger.error("Image generation failed: %s", error)
        return jsonify(
            image_payload(
                story_text,
                fallback_image_data_url(story_text, profile),
                profile,
                image_prompt,
                "fallback",
                "The image service is unavailable, so CariVoice used a custom fallback image.",
            )
        ), 200
    except Exception as error:
        logger.exception("Unexpected image generation failure")
        return jsonify({"error": f"Image generation failed: {error}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
