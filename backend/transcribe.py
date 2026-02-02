import numpy as np
import torch
import soundfile as sf
import librosa
import time
import os
import torch
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq

BASE_MODEL = "openai/whisper-medium"
PT_PATH = "model/whisper_finetuned_best.pt"


device = "cuda" if torch.cuda.is_available() else "cpu"

processor = AutoProcessor.from_pretrained(BASE_MODEL)

model = AutoModelForSpeechSeq2Seq.from_pretrained(
    BASE_MODEL,
    low_cpu_mem_usage=True,
    torch_dtype=torch.float32,   # match training
).to(device)

checkpoint = torch.load(PT_PATH, map_location=device)

# If saved as {"model_state_dict": ...}
if "model_state_dict" in checkpoint:
    checkpoint = checkpoint["model_state_dict"]

model.load_state_dict(checkpoint, strict=False)

print("Loaded Whisper Medium model with fine-tuned weights.")

AUDIO_SR = 16000
MAX_SECONDS = 30  # matching your original logic

def preprocess_audio(path):
    audio, sr = sf.read(path)

    # Convert stereo → mono
    if len(audio.shape) > 1:
        audio = librosa.to_mono(audio.T)

    # Resample if needed
    if sr != AUDIO_SR:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=AUDIO_SR)

    return audio, AUDIO_SR


def transcribe_one(audio_path):
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    speech_array, sr = preprocess_audio(audio_path)

    # truncate to MAX_SECONDS
    max_len = int(MAX_SECONDS * AUDIO_SR)
    if len(speech_array) > max_len:
        speech_array = speech_array[:max_len]

    inputs = processor(
        [speech_array],                    # list because HF expects batch
        sampling_rate=AUDIO_SR,
        return_tensors="pt",
        padding="max_length",
        max_length=processor.feature_extractor.n_samples,
        truncation=True,
        return_attention_mask=True
    )

    # GPU + FP16 (same as your batch code)
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        pred_ids = model.generate(
            **inputs,
            max_length=225,
            forced_decoder_ids=processor.get_decoder_prompt_ids(
                language="en",
                task="transcribe"
            ),
            num_beams=3,
            do_sample=False,
            no_repeat_ngram_size=2,
            suppress_tokens=None
        )

    text = processor.batch_decode(pred_ids, skip_special_tokens=True)[0]
    return text.strip()