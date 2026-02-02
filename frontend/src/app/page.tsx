'use client';

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string; isTranscription?: boolean; audioUrl?: string; imageUrl?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [generateImage, setGenerateImage] = useState<boolean>(false);
  const [generatingImageForId, setGeneratingImageForId] = useState<string | null>(null);
  const isGeneratingImage = generatingImageForId !== null;

  // Image modal state
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const openImageModal = (url: string) => { setModalImageUrl(url); setIsModalOpen(true); };
  const closeImageModal = () => { setIsModalOpen(false); setModalImageUrl(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeImageModal();
    };
    if (isModalOpen) window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [isModalOpen]);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  // Track decoded duration for the current recording (in seconds)
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  // Track elapsed recording time while recording
  const [recordingElapsed, setRecordingElapsed] = useState<number>(0);
  const MAX_RECORDING_SECONDS = 30; // limit recordings to 30 seconds
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingTimerRef = useRef<number | null>(null); // timeout id
  const recordingIntervalRef = useRef<number | null>(null); // interval id
  const messageListRef = useRef<HTMLDivElement | null>(null);

  function formatTime(seconds: number | null | undefined) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const BACKEND_URL = "https://jordynn-undeclinable-uncolloquially.ngrok-free.dev";

  // No session handling needed; this app sends audio directly to /transcribe.

  // No session history loading required.



  // Audio recording helpers
  const startRecording = async () => {
    // Prevent starting a new recording while an image is being generated or while a transcription is pending
    if (isGeneratingImage || loading) {
      console.warn('Cannot start recording: image generation or transcription in progress');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      audioChunksRef.current = [];
      const options = { mimeType: 'audio/webm' };
      const mr = new MediaRecorder(stream, options as any);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e: BlobEvent) => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const wav = await convertToWav(blob);
          setAudioBlob(wav);
          const localUrl = URL.createObjectURL(wav);
          setAudioUrl(localUrl);
          // Decode duration from the generated URL
          const tmp = new Audio(localUrl);
          tmp.addEventListener('loadedmetadata', () => {
            if (!isNaN(tmp.duration)) setAudioDuration(tmp.duration);
          });
          tmp.addEventListener('error', () => setAudioDuration(null));
        } catch (err) {
          console.error('Error converting to WAV:', err);
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setIsRecording(true);
      setAudioDuration(null);
      setRecordingElapsed(0);
      // start elapsed interval and auto-stop timer
      const startTs = Date.now();
      if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingElapsed(Math.floor((Date.now() - startTs) / 1000));
      }, 200);
      if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = window.setTimeout(() => {
        // Auto-stop when max reached
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // clear timers
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    // clamp elapsed time to max
    setRecordingElapsed((prev) => Math.min(prev, MAX_RECORDING_SECONDS));
  }; 

  async function convertToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = audioContextRef.current || new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const numOfChan = audioBuffer.numberOfChannels;
    const length = 44 + audioBuffer.length * numOfChan * 2;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    let offset = 0;
    function writeString(s: string) { for (let i = 0; i < s.length; i++) { view.setUint8(offset + i, s.charCodeAt(i)); } offset += s.length; }
    writeString('RIFF');
    view.setUint32(offset, 36 + audioBuffer.length * numOfChan * 2, true); offset += 4;
    writeString('WAVE'); writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2; // PCM
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, audioBuffer.sampleRate, true); offset += 4;
    view.setUint32(offset, audioBuffer.sampleRate * numOfChan * 2, true); offset += 4;
    view.setUint16(offset, numOfChan * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString('data');
    view.setUint32(offset, audioBuffer.length * numOfChan * 2, true); offset += 4;

    // write interleaved PCM16
    const channels = [] as Float32Array[];
    for (let i = 0; i < numOfChan; i++) channels.push(audioBuffer.getChannelData(i));
    let pos = offset;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let ch = 0; ch < numOfChan; ch++) {
        let sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        pos += 2;
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  const downloadWav = () => {
    if (!audioBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(audioBlob);
    a.download = `recording-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sendAudio = async () => {
    // Prevent sending a new prompt while an image is generating
    if (isGeneratingImage) {
      console.warn('Cannot send audio: image generation in progress');
      return;
    }

    if (!audioBlob) return;
    setLoading(true);
    // Make a local object URL that the message will own so it doesn't rely on component state
    const localAudioUrl = URL.createObjectURL(audioBlob);
    try {
      const form = new FormData();
      form.append('audio', audioBlob, `recording-${Date.now()}.wav`);

      const res = await fetch(`${BACKEND_URL}/transcribe`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      const text = data.text || data.transcript || data.answer;
      if (text) {
        const msgId = `audio-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            role: 'assistant',
            content: text,
            isTranscription: true,
            audioUrl: localAudioUrl,
          },
        ]);

        // If generateImage was selected, call backend /generate-image and attach image to the message when available
        if (generateImage) {
          setGeneratingImageForId(msgId);
          (async () => {
            try {
              const imgRes = await fetch(`${BACKEND_URL}/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }), // send transcription text as specified
              });

              if (!imgRes.ok) {
                const errText = await imgRes.text().catch(() => '');
                console.error('Image generation failed', imgRes.status, errText);
                return;
              }

              const ct = (imgRes.headers.get('content-type') || '').toLowerCase();
              let imageUrl: string | null = null;

              if (ct.includes('application/json')) {
                const imgData = await imgRes.json().catch(() => null);
                const maybe = imgData?.imageUrl || imgData?.url || imgData?.image || imgData?.imageUrlBase64 || imgData?.base64 || null;
                if (maybe && typeof maybe === 'string') {
                  // Accept either a full data URL or a plain base64 string
                  if (maybe.startsWith('data:image')) {
                    imageUrl = maybe;
                  } else if (/^\s*<base64>/i.test(maybe)) {
                    // unlikely but handle prefix
                    imageUrl = maybe.replace(/^\s*<base64>/i, 'data:image/png;base64,');
                  } else if (/^[A-Za-z0-9+/=\s]+$/.test(maybe) && maybe.length > 100) {
                    imageUrl = `data:image/png;base64,${maybe}`;
                  } else {
                    imageUrl = maybe;
                  }
                }
              } else if (ct.startsWith('image/')) {
                // Binary image, convert to blob URL
                const blob = await imgRes.blob();
                imageUrl = URL.createObjectURL(blob);
              } else {
                // Try JSON fallback
                const txt = await imgRes.text().catch(() => '');
                try {
                  const parsed = JSON.parse(txt);
                  const maybe = parsed?.imageUrl || parsed?.url || parsed?.image || null;
                  if (maybe) imageUrl = maybe;
                } catch (e) {
                  console.error('Unknown image response format', ct, txt);
                }
              }

              if (imageUrl) {
                setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, imageUrl } : m));
              } else {
                console.error('No image returned from /generate-image');
              }
            } catch (err) {
              console.error('Error generating image:', err);
            } finally {
              setGeneratingImageForId(null);
            }
          })();
        }

        // Clear recording state after message is created
        setAudioUrl(null);
        setAudioBlob(null);
      } else {
        console.error('No transcription returned', data);
        URL.revokeObjectURL(localAudioUrl);
      }
    } catch (err) {
      console.error('Error uploading audio:', err);
      // cleanup local URL on error
      URL.revokeObjectURL(localAudioUrl);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (recordingTimerRef.current) {
        window.clearTimeout(recordingTimerRef.current);
      }
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Revoke previous object URL when audioUrl changes or the component unmounts
    return () => {
      if (audioUrl) {
        try { URL.revokeObjectURL(audioUrl); } catch (e) { /* ignore */ }
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!messageListRef.current) return;
    // Auto-scroll to bottom so new messages stack and are visible
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;

    // Center the latest transcription message if present
    const lastTranscription = [...messages].reverse().find((m) => m.isTranscription);
    if (lastTranscription) {
      const el = document.querySelector(`[data-msg-id="${lastTranscription.id}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [messages]);

  return (
    <main className="flex flex-col h-screen bg-gradient-to-b from-blue-50 to-blue-100 relative">


      {/* Title */}
      <div className="text-center py-4 text-2xl font-bold text-blue-800">
        CariVoice
      </div>

      {/* Chat Container */}
      <div ref={messageListRef} className="flex-1 overflow-y-auto p-4 space-y-3 pb-48 flex flex-col items-start">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">Tap the button to begin telling your story!</p>
        ) : (
          messages.map((msg, i) => {
            if (msg.isTranscription) {
              return (
                <div
                  key={msg.id}
                  data-msg-id={msg.id}
                  className="p-4 rounded-2xl bg-white shadow-md w-full sm:w-3/5 sm:max-w-[60%] mx-4 flex flex-col items-start gap-4"
                >
                  <div className="flex-1 text-left text-base font-medium text-gray-900 break-words whitespace-pre-wrap">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>

                  {msg.imageUrl && (
                    <div className="w-full flex justify-center mt-3">
                      <img
                        src={msg.imageUrl}
                        alt="generated"
                        className="w-full max-w-[320px] rounded-md object-cover cursor-pointer"
                        onClick={() => openImageModal(msg.imageUrl!)}
                        role="button"
                        aria-label="Open image preview"
                      />
                    </div>
                  )} 

                  {msg.audioUrl && (
                    <div className="w-full flex justify-center mt-2">
                      <audio controls src={msg.audioUrl} className="w-full sm:w-48 rounded-md" />
                    </div>
                  )}

                  {generatingImageForId === msg.id && (
                    <div className="text-sm text-gray-500 mt-2">Generating image…</div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={msg.id || i}
                className={`p-4 rounded-2xl w-full sm:w-3/5 sm:max-w-[60%] mx-4 break-words whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Large Right-Aligned Record Panel */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-20 flex flex-col items-end space-y-3 w-72 sm:w-80 px-4">
        <div className="w-full bg-white border border-gray-200 rounded-xl p-3 shadow-md flex flex-col items-center space-y-3">
          {audioUrl ? (
            <div className="w-full flex flex-col items-center">
              <audio controls src={audioUrl} className="w-full max-w-[300px] sm:w-72 rounded-md mb-2"></audio>
              <div className="text-sm text-gray-500">{formatTime(audioDuration)} • Max: {formatTime(MAX_RECORDING_SECONDS)}</div>
              <div className="mt-2 flex space-x-3">
                <button
                  className="px-3 py-2 rounded-full bg-gray-200 hover:bg-gray-300"
                  onClick={downloadWav}
                >
                  Download .wav
                </button>
                <button
                  className={`px-4 py-2 rounded-full font-semibold ${loading || isGeneratingImage ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  onClick={sendAudio}
                  disabled={loading || isGeneratingImage}
                >
                  {loading ? '...' : 'Send'}
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              {isRecording ? (
                <>
                  <div className="text-sm text-gray-500">{formatTime(recordingElapsed)} • Max: {formatTime(MAX_RECORDING_SECONDS)}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className={`h-2 ${recordingElapsed / MAX_RECORDING_SECONDS > 0.9 ? 'bg-red-600' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, (recordingElapsed / MAX_RECORDING_SECONDS) * 100)}%` }}
                    ></div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">No recording yet</div>
              )}
            </div>
          )}

          <div className="w-full flex flex-col items-center">
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input type="checkbox" checked={generateImage} onChange={(e) => setGenerateImage(e.target.checked)} className="w-4 h-4" />
                <span>Generate image</span>
              </label>
            </div>

            {(isGeneratingImage || loading) && (
              <div className="w-full text-sm text-yellow-600 text-center">
                {isGeneratingImage ? 'Image generation in progress — recording and sending are disabled' : 'Transcribing — recording is disabled'}
              </div>
            )} 

            <div className="mt-3 w-full flex justify-center">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isGeneratingImage || loading}
                className={`w-36 h-36 rounded-full flex flex-col items-center justify-center shadow-lg transition transform ${isRecording ? 'bg-red-600 text-white scale-95 animate-pulse' : 'bg-green-600 text-white hover:scale-105'} ${isGeneratingImage || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRecording ? (
                  <>
                    <div className="text-xl font-bold">Recording…</div>
                    <div className="mt-2 w-3 h-3 bg-white rounded-full" />
                  </>
                ) : (
                  <div className="text-xl font-bold">Record</div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && modalImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" onClick={closeImageModal}>
          <div className="relative max-w-[90%] max-h-[90%]" onClick={(e) => e.stopPropagation()}>
            <img src={modalImageUrl} alt="Preview" className="max-w-full max-h-[80vh] rounded-md shadow-lg" />
            <div className="absolute top-2 right-2 flex space-x-2">
              <a href={modalImageUrl} download className="px-3 py-1 bg-white bg-opacity-90 rounded-md text-sm">Download</a>
              <button onClick={closeImageModal} className="px-3 py-1 bg-white bg-opacity-90 rounded-md text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}