import base64
import logging
import os
import tempfile
from pathlib import Path
from urllib.parse import quote

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

    # Keep the request focused and bounded while retaining enough of the story
    # to produce a scene that feels specific to the recording.
    story_excerpt = story_text[:1200]
    image_prompt = (
        "Warm, vibrant Caribbean folklore storybook illustration, richly textured "
        "paper-cut and painted style, expressive cinematic composition, tropical "
        "island color palette, no text, no logos. Story scene: "
        f"{story_excerpt}"
    )
    image_url = (
        "https://image.pollinations.ai/prompt/"
        f"{quote(image_prompt, safe='')}?width=1024&height=768&nologo=true"
    )

    try:
        logger.info("Generating an illustration for %s characters", len(story_excerpt))
        response = requests.get(image_url, timeout=90)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "image/jpeg")
        if not content_type.startswith("image/"):
            return jsonify({"error": "The image service returned an invalid response."}), 502

        encoded_image = base64.b64encode(response.content).decode("utf-8")
        return jsonify({"image": f"data:{content_type};base64,{encoded_image}"}), 200
    except requests.Timeout:
        return jsonify({"error": "The image service timed out. Please try again."}), 504
    except requests.RequestException as error:
        logger.error("Image generation failed: %s", error)
        return jsonify({"error": "The image service is unavailable right now."}), 502
    except Exception as error:
        logger.exception("Unexpected image generation failure")
        return jsonify({"error": f"Image generation failed: {error}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
