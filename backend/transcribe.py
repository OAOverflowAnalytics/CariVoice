import os
from pathlib import Path
from threading import Lock

import librosa
import numpy as np
import soundfile as sf
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor


BASE_MODEL = os.getenv("CARIVOICE_BASE_MODEL", "openai/whisper-medium")
DEFAULT_CHECKPOINT = Path(__file__).resolve().parent / "model" / "whisper_finetuned_best.pt"
MODEL_PATH_OVERRIDE = os.getenv("CARIVOICE_MODEL_PATH")
PT_PATH = Path(MODEL_PATH_OVERRIDE or DEFAULT_CHECKPOINT).expanduser().resolve()
AUDIO_SR = 16000
MAX_SECONDS = 30

_device = "cuda" if torch.cuda.is_available() else "cpu"
_processor = None
_model = None
_load_lock = Lock()


def load_model():
    global _processor, _model

    if _processor is not None and _model is not None:
        return _processor, _model

    with _load_lock:
        if _processor is not None and _model is not None:
            return _processor, _model

        if MODEL_PATH_OVERRIDE and not PT_PATH.exists():
            raise FileNotFoundError(
                f"CariVoice model checkpoint not found at {PT_PATH}. "
                "Correct CARIVOICE_MODEL_PATH or remove it to use standard Whisper."
            )

        processor = AutoProcessor.from_pretrained(BASE_MODEL)
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            BASE_MODEL,
            low_cpu_mem_usage=True,
            torch_dtype=torch.float32,
        ).to(_device)

        if PT_PATH.exists():
            checkpoint = torch.load(PT_PATH, map_location=_device)
            if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                checkpoint = checkpoint["model_state_dict"]
            model.load_state_dict(checkpoint, strict=False)
            print(f"Loaded CariVoice fine-tuned checkpoint from {PT_PATH}.")
        else:
            print(
                f"No fine-tuned checkpoint found at {PT_PATH}; "
                f"using the standard {BASE_MODEL} model."
            )

        model.eval()
        _processor = processor
        _model = model
        print(f"Whisper is ready on {_device}.")

    return _processor, _model


def preprocess_audio(path):
    audio, sample_rate = sf.read(path, dtype="float32")

    if audio.size == 0:
        raise ValueError("The recording contains no audio samples.")

    # Convert multi-channel audio to mono.
    if audio.ndim > 1:
        audio = librosa.to_mono(audio.T)

    if sample_rate != AUDIO_SR:
        audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=AUDIO_SR)

    return np.asarray(audio, dtype=np.float32)


def transcribe_one(audio_path):
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    processor, model = load_model()
    speech_array = preprocess_audio(audio_path)
    speech_array = speech_array[: MAX_SECONDS * AUDIO_SR]

    inputs = processor(
        [speech_array],
        sampling_rate=AUDIO_SR,
        return_tensors="pt",
        padding="max_length",
        max_length=processor.feature_extractor.n_samples,
        truncation=True,
        return_attention_mask=True,
    )
    inputs = {key: value.to(_device) for key, value in inputs.items()}

    with torch.inference_mode():
        prediction_ids = model.generate(
            **inputs,
            max_length=225,
            forced_decoder_ids=processor.get_decoder_prompt_ids(
                language="en",
                task="transcribe",
            ),
            num_beams=3,
            do_sample=False,
            no_repeat_ngram_size=2,
            suppress_tokens=None,
        )

    text = processor.batch_decode(prediction_ids, skip_special_tokens=True)[0]
    return text.strip()
