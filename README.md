# CariVoice

CariVoice turns spoken Caribbean folklore into a transcript, a generated story illustration, and a downloadable story image with the text below it.

## Setup

Clone the repository, then install the frontend and backend dependencies.

### Frontend

```bash
cd frontend
npm install
npm run build
npm start
```

The frontend runs at [http://localhost:3000](http://localhost:3000).

By default it expects the backend at `http://127.0.0.1:5000`. To point it somewhere else, set `NEXT_PUBLIC_BACKEND_URL` before building the frontend.

### Backend

Use a dedicated Python environment for the backend. With conda, for example:

```bash
conda create -n carivoice python=3.12
conda activate carivoice
cd backend
python -m pip install -r requirements.txt
python app.py
```

If you already have a suitable environment, activate that environment instead and run the same `pip install` and `python app.py` commands.

The backend runs at [http://127.0.0.1:5000](http://127.0.0.1:5000).

CariVoice looks for a fine-tuned Whisper checkpoint at:

```text
backend/model/whisper_finetuned_best.pt
```

If your model is somewhere else, set `CARIVOICE_MODEL_PATH` before starting the backend. If no fine-tuned checkpoint is found, the backend falls back to the base Whisper model configured by `CARIVOICE_BASE_MODEL`.

## Image Generation

The backend uses the external Pollinations image service by default and falls back to a custom local story illustration if that service fails.

Useful backend environment variables:

```bash
CARIVOICE_IMAGE_PROVIDER=fallback
CARIVOICE_IMAGE_BASE_URL=https://image.pollinations.ai/prompt
CARIVOICE_CORS_ORIGINS=http://localhost:3000
```

Set `CARIVOICE_IMAGE_PROVIDER=fallback` if you want to run without external image generation.

## Running The Platform

Start the backend in one terminal:

```bash
conda activate carivoice
cd backend
python app.py
```

Start the frontend in another terminal:

```bash
cd frontend
npm run build && npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Demo

https://github.com/user-attachments/assets/75a893c2-1569-4b42-b20b-d80b8fe660ff

---

Made with love by [Overflow Analytics](https://github.com/OAOverflowAnalytics)
