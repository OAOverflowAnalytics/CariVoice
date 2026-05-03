from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import tempfile
import logging
import os
import requests
import base64
from urllib.parse import quote

from transcribe import transcribe_one

os.environ["COLAB_RELEASE_TAG"] = "v1"
os.environ["COLAB_BACKEND_URL"] = ""

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins="*")

@app.route("/", methods=["GET"])
def root():
  return "Alive!", 200

@app.route("/transcribe", methods=["POST", "OPTIONS"])
def transcribe_post():
    if request.method == "OPTIONS":
        return "", 200

    logger.info("Received transcribe request")

    audio_file = request.files.get("audio")
    if not audio_file:
        logger.warning("No audio file in request")
        return jsonify({"error": "No audio file received"}), 400

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
          audio_file.save(tmp.name)
          logger.info(f"Saved audio to {tmp.name}, running transcription...")
        try:
            text = transcribe_one(tmp.name)
            logger.info(f"Transcription result: {text}")
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            os.remove(tmp.name)
            return jsonify({"error": str(e)}), 500

    os.remove(tmp.name)
    return jsonify({"transcript": text})

@app.route('/generate-image', methods=['POST'])
def generate_image():
    try:
        data = request.json
        prompt = data.get('text', '')
        
        if not prompt:
            return jsonify({'error': 'No text provided'}), 400
        
        print(f"Generating image for prompt: {prompt}")
        
        # Pollinations.ai - completely free, no API key needed
        encoded_prompt = quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
        
        response = requests.get(url)
        
        if response.status_code == 200:
            image_bytes = response.content
            b64_data = base64.b64encode(image_bytes).decode('utf-8')
            
            return jsonify({
                'image': f'data:image/jpeg;base64,{b64_data}'
            }), 200
        else:
            return jsonify({'error': 'Failed to generate image'}), 500
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

# public_url = eval_js("google.colab.kernel.proxyPort(5000)")
# print(f"BACKEND_URL: {public_url}")

app.run(host='0.0.0.0', port=5000, debug=False)