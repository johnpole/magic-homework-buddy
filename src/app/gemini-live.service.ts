import { Injectable, signal } from '@angular/core';
import { ActivityHandling, EndSensitivity, GoogleGenAI, LiveServerMessage, Modality, StartSensitivity, Type } from "@google/genai";

export interface CatalogItem {
  id: string;
  name: string;
  type: string;
  description: string;
  timestamp: number;
}

declare const GEMINI_API_KEY: string;
type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{
      isFinal: boolean;
      0: { transcript: string };
    }>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}
declare const window: Window & { aistudio: AIStudio };

@Injectable({ providedIn: 'root' })
export class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any = null;
  private currentVideoElement: HTMLVideoElement | null = null;

  // ── State signals ──────────────────────────────────────────────────────────
  isConnected = signal(false);
  isMuted = signal(false);
  isCameraEnabled = signal(true);
  isAnalyzing = signal(false);
  isFeedbackLoading = signal(false);
  micLevel = signal(0);
  userSpeaking = signal(false);
  buddySpeaking = signal(false);
  status = signal<'idle' | 'connecting' | 'connected' | 'error' | 'needs-key'>('idle');
  chatHistory = signal<{ role: 'user' | 'buddy'; text: string }[]>([]);
  catalogItems = signal<CatalogItem[]>([]);
  sessionFeedback = signal<string>('');
  generatedImageUrl = signal<string>('');
  generatedImagePrompt = signal<string>('');
  isGeneratingImage = signal(false);
  imageError = signal('');

  // ── Audio (separate contexts to eliminate crackling) ───────────────────────
  private inputAudioContext: AudioContext | null = null;    // 16 kHz – mic
  private playbackAudioContext: AudioContext | null = null; // 24 kHz – AI voice
  private workletNode: AudioWorkletNode | null = null;
  private playbackWorkletNode: AudioWorkletNode | null = null;
  private playbackGainNode: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;
  private mutedMonitorGain: GainNode | null = null;
  private speakingTimeout: ReturnType<typeof setTimeout> | null = null;
  private speechRecognition: InstanceType<SpeechRecognitionCtor> | null = null;
  private speechRecognitionEnabled = false;
  private pendingBuddyTranscript = '';
  private pendingUserTranscript = '';
  private userTurnInProgress = false;
  private buddyTurnInProgress = false;
  private buddySpeakingTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingUserCommitTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly useBrowserSpeechFallback = false;

  // ── Key helpers ────────────────────────────────────────────────────────────
  async checkKey(): Promise<boolean> {
    if (typeof window.aistudio !== 'undefined') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) { this.status.set('needs-key'); return false; }
    }
    return true;
  }

  async openKeySelector() {
    if (typeof window.aistudio !== 'undefined') {
      await window.aistudio.openSelectKey();
      this.status.set('idle');
    }
  }

  toggleMute() {
    this.isMuted.update(m => !m);
    const audioTrack = this.mediaStream?.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = !this.isMuted();
    if (this.isMuted()) {
      this.stopSpeechRecognition();
    } else if (this.useBrowserSpeechFallback) {
      this.startSpeechRecognition();
    }
  }

  toggleCamera() {
    this.isCameraEnabled.update(v => !v);
    const videoTrack = this.mediaStream?.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = this.isCameraEnabled();
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  async connect(videoElement: HTMLVideoElement) {
    if (this.isConnected()) return;
    this.status.set('connecting');
    this.currentVideoElement = videoElement;

    if (!await this.checkKey()) return;

    try {
      this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        },
        video: { width: 640, height: 480 }
      });
      videoElement.srcObject = this.mediaStream;

      this.session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              prefixPaddingMs: 150,
              silenceDurationMs: 700
            },
            activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
          },
          systemInstruction: `You are Magic Buddy, an enthusiastic AI homework tutor for children in grades K-8.

=== FIRST MOMENT RULE ===
When the session begins, do not jump into tutoring right away.
First say a warm hello, introduce yourself as Magic Buddy, and ask the child for their name.
After the child tells you their name, say that you are here to help with homework and ask whether they want to show a homework page or say a topic like counting, vowels, A to Z, or multiplication.
Remember their name and use it naturally in later replies.

=== YOUR MISSION ===
Watch the camera feed continuously. The moment you see any homework, paper, or learning material, begin interacting immediately.

=== HOW TO RESPOND TO WHAT YOU SEE ===
- LETTER (e.g. "A"): Say "I can see the letter A! Awesome! What sound does the letter A make? Can you name a word that starts with A — like Apple or Ant?"
- NUMBER (e.g. "7"): Say "I see the number 7! Great! Can you count up to 7 for me?"
- WORD: Read it aloud. Ask the student to spell it out loud or use it in a sentence.
- SHAPE: Name it. Ask how many sides it has or where they see that shape in real life.
- HOMEWORK PROBLEM: Guide with questions — NEVER just give the answer.
- DRAWING: Describe it enthusiastically. Ask the student to tell you about it.
- PAPER (general): Say "Oh I can see your homework! Hold it a bit closer and I'll take a good look!"

=== RULES ===
1. Keep every response SHORT — maximum 3 sentences. This is a live voice conversation.
2. After identifying something, always ask EXACTLY ONE question.
3. Always be positive: "Great job!", "Wow!", "You're so smart!", "Amazing!"
4. Call catalog_item EVERY TIME you clearly identify something in the camera.
5. Support interruptions gracefully — if the student starts speaking, stop and listen.
6. End each short exercise with encouragement before moving to the next thing.
7. Use a playful, gentle, kid-friendly voice and easy words.
8. If you know the child's name, include it often in a warm natural way.
9. If the child says a topic instead of showing paper, immediately teach that topic with one tiny activity or question.

=== OPENING ===
Greeting flow:
1. Say: "Hi! I'm Magic Buddy, your homework helper. What's your name?"
2. After they answer, say: "Hi <name>! I'm here to help with homework"`,
          tools: [{
            functionDeclarations: [
              {
                name: 'catalog_item',
                description: 'Call this every time you visually identify something in the camera feed.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "What you saw (e.g. 'Letter A', 'Number 5', 'Triangle')" },
                    type: { type: Type.STRING, description: "Category: letter, number, word, shape, drawing, object, or homework" },
                    description: { type: Type.STRING, description: "A brief child-friendly description of what was seen." }
                  },
                  required: ['name', 'type', 'description']
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: async () => {
            console.log("Gemini Live: HANDSHAKE SUCCESSFUL");
            this.isConnected.set(true);
            this.status.set('connected');
            this.isMuted.set(false);
            this.isCameraEnabled.set(true);
            this.chatHistory.set([]);
            this.catalogItems.set([]);
            this.sessionFeedback.set('');
            this.generatedImageUrl.set('');
            this.generatedImagePrompt.set('');
            this.imageError.set('');
            await this.startStreaming(videoElement);
            this.startSpeechRecognition();

            // Proactive stimulus to trigger the Opening greeting from systemInstruction
            if (this.session) {
              console.log("Gemini Live: Sending initial greeting stimulus...");
              this.session.sendClientContent({
                turns: [{
                  role: 'user',
                  parts: [{ text: "The student has just opened Magic Buddy. Greet them, ask for their name, and after they answer explain that you can help with homework by either looking at a page or helping with a spoken topic." }]
                }],
                turnComplete: true
              });
            }
          },
          onmessage: (msg: LiveServerMessage) => {
            console.log("Gemini Live: Message received", msg);
            this.handleMessage(msg);
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live error:', e);
            this.status.set('error');
            this.cleanup();
          },
          onclose: () => {
            this.status.set('idle');
            this.cleanup();
          }
        }
      });
    } catch (err) {
      console.error('Connect failed:', err);
      this.status.set('error');
    }
  }

  // ── Snapshot analysis (non-live, full detail) ──────────────────────────────
  async analyzeCurrentFrame() {
    const video = this.currentVideoElement;
    if (!video || video.videoWidth === 0) return;
    if (!await this.checkKey()) return;
    if (!this.ai) this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    this.isAnalyzing.set(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    this.chatHistory.update(h => [...h, { role: 'user', text: '📸 Snapshot — what can you see on my paper?' }]);

    try {
      const res = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: 'You are a friendly children\'s tutor. Look at this image and describe every letter, number, word, shape, drawing, or homework problem you can see. Keep it encouraging and simple for a young child. If the image is too blurry, explain how to improve it.' },
            { inlineData: { mimeType: 'image/jpeg', data: base64 } }
          ]
        }]
      });
      const text = res.text?.trim() || "I couldn't quite read the page. Try holding it closer with good lighting!";
      this.chatHistory.update(h => [...h, { role: 'buddy', text }]);

      // ── Push to Live Session so Buddy speaks the analysis ──
      if (this.isConnected() && this.session) {
        console.log("Gemini Live: Pushing snapshot analysis to live voice session...");
        this.session.sendClientContent({
          turns: [{
            role: 'user',
            parts: [{
              text: `I just saw a high-detail snapshot from the student's homework. These are my detailed notes on what I saw: "${text}". Please summarize these notes aloud for the student in your warm, encouraging Buddy voice!`
            }]
          }],
          turnComplete: true
        });
      }
    } catch (err) {
      console.error('Snapshot failed:', err);
      this.chatHistory.update(h => [...h, { role: 'buddy', text: "Oops! I couldn't read the page. Try better lighting and hold it closer." }]);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  // ── Session feedback: sends full transcript back to Gemini ─────────────────
  async getSessionFeedback() {
    const history = this.chatHistory();
    if (history.length < 2) return;
    if (!this.ai) this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    this.isFeedbackLoading.set(true);
    this.sessionFeedback.set('');

    const transcript = history
      .map(m => `${m.role === 'user' ? 'Student' : 'Magic Buddy'}: ${m.text}`)
      .join('\n');

    try {
      const res = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: `You are a warm, encouraging teacher. Read this tutoring session transcript and write a short (3-4 sentence) summary for the student. Highlight: (1) what they did great, (2) what concept they worked on, (3) one simple thing to practice next. Keep it positive and age-appropriate for a young child.\n\nTRANSCRIPT:\n${transcript}` }]
        }]
      });
      this.sessionFeedback.set(res.text?.trim() || 'Great session! Keep up the amazing work!');
    } catch (err) {
      console.error('Feedback failed:', err);
      this.sessionFeedback.set('You did an amazing job today! Keep practising!');
    } finally {
      this.isFeedbackLoading.set(false);
    }
  }

  sendTypedMessage(text: string) {
    const normalized = text.trim();
    if (!normalized || !this.session || !this.isConnected()) return;

    this.chatHistory.update(h => [...h, { role: 'user', text: normalized }]);
    this.session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: normalized }]
      }],
      turnComplete: true
    });
  }

  // ── Message handler ────────────────────────────────────────────────────────
  private async handleMessage(message: LiveServerMessage) {
    // Play audio chunks
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) this.playAudio(part.inlineData.data);
      }
    }

    // Interruption
    if (message.serverContent?.interrupted) this.stopAllAudio();

    // Tool calls
    const calls = message.toolCall?.functionCalls;
    if (calls) {
      const responses = [];
      for (const call of calls) {
        if (call.name === 'catalog_item') {
          const a = call.args as { name: string; type: string; description: string };
          this.catalogItems.update(items => [
            { id: Math.random().toString(36).slice(2, 9), name: a.name, type: a.type, description: a.description, timestamp: Date.now() },
            ...items
          ]);
          responses.push({ name: call.name, id: call.id, response: { success: true } });
        }
      }
      if (responses.length && this.session) {
        this.session.sendToolResponse({ functionResponses: responses });
      }
    }

    // User speech
    const userText = message.serverContent?.inputTranscription?.text?.trim();
    if (userText) {
      this.pendingUserTranscript = userText;
      this.userSpeaking.set(true);
      this.chatHistory.update(history => {
        if (this.userTurnInProgress) {
          const last = history[history.length - 1];
          if (last?.role === 'user') return [...history.slice(0, -1), { role: 'user', text: userText }];
        }
        this.userTurnInProgress = true;
        return [...history, { role: 'user', text: userText }];
      });
    }

    if (message.serverContent?.inputTranscription?.finished) {
      this.pendingUserTranscript = '';
      this.userSpeaking.set(false);
      this.userTurnInProgress = false;
    }

    // Buddy speech
    const buddyText = message.serverContent?.outputTranscription?.text?.trim();
    if (buddyText) {
      this.setBuddySpeaking(true);
      this.pendingBuddyTranscript = buddyText;
      this.chatHistory.update(h => {
        if (this.buddyTurnInProgress) {
          const last = h[h.length - 1];
          if (last?.role === 'buddy') return [...h.slice(0, -1), { ...last, text: this.pendingBuddyTranscript }];
        }
        this.buddyTurnInProgress = true;
        return [...h, { role: 'buddy', text: this.pendingBuddyTranscript }];
      });
    }

    if (message.serverContent?.outputTranscription?.finished) {
      this.pendingBuddyTranscript = '';
      this.buddyTurnInProgress = false;
      this.setBuddySpeaking(false);
    }
  }

  // ── Streaming (mic + video frames) ────────────────────────────────────────
  private async startStreaming(videoElement: HTMLVideoElement) {
    this.inputAudioContext = new AudioContext({ sampleRate: 16000 });
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();

    this.playbackAudioContext = new AudioContext({ sampleRate: 24000 });
    if (this.playbackAudioContext.state === 'suspended') await this.playbackAudioContext.resume();
    await this.playbackAudioContext.audioWorklet.addModule('/playback-processor.js');
    this.playbackWorkletNode = new AudioWorkletNode(this.playbackAudioContext, 'pcm-processor');
    this.playbackGainNode = this.playbackAudioContext.createGain();
    this.playbackGainNode.gain.value = 1;
    this.playbackWorkletNode.connect(this.playbackGainNode);
    this.playbackGainNode.connect(this.playbackAudioContext.destination);

    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream!);

    try {
      await this.inputAudioContext.audioWorklet.addModule('/pcm-processor.js');
      this.workletNode = new AudioWorkletNode(this.inputAudioContext, 'pcm-processor');
      this.mutedMonitorGain = this.inputAudioContext.createGain();
      this.mutedMonitorGain.gain.value = 0;

      this.workletNode.port.onmessage = (e) => {
        if (!this.isConnected() || !this.session || this.isMuted() || this.buddySpeaking()) return;
        const level = this.calculateMicLevel(e.data);
        this.micLevel.set(level);
        if (level > 0.06) {
          this.userSpeaking.set(true);
          if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
          this.speakingTimeout = setTimeout(() => this.userSpeaking.set(false), 250);
        }
        const pcm = this.floatTo16BitPCM(e.data);
        const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
        this.session.sendRealtimeInput({ audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } });
      };

      this.source.connect(this.workletNode);
      this.workletNode.connect(this.mutedMonitorGain);
      this.mutedMonitorGain.connect(this.inputAudioContext.destination);
    } catch (err) {
      console.error('AudioWorklet failed:', err);
    }

    // Video at 1 FPS
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 640; canvas.height = 480;
    const sendFrame = () => {
      if (!this.isConnected() || !this.session) return;
      ctx?.drawImage(videoElement, 0, 0, 640, 480);
      const b64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      this.session.sendRealtimeInput({ video: { data: b64, mimeType: 'image/jpeg' } });
      setTimeout(sendFrame, 1000);
    };
    sendFrame();
  }

  private startSpeechRecognition() {
    if (!this.useBrowserSpeechFallback) return;
    const SpeechRecognitionImpl =
      (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ||
      (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;

    if (!SpeechRecognitionImpl || this.isMuted() || this.buddySpeaking()) return;
    if (this.speechRecognitionEnabled) return;

    this.speechRecognition = new SpeechRecognitionImpl();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.lang = 'en-US';

    this.speechRecognition.onresult = (event) => {
      if (this.buddySpeaking()) return;
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript?.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          finalText += `${transcript} `;
        } else {
          interimText += `${transcript} `;
        }
      }

      const normalizedInterim = interimText.trim();
      if (normalizedInterim) {
        this.pendingUserTranscript = normalizedInterim;
        this.chatHistory.update(history => {
          const last = history[history.length - 1];
          if (last?.role === 'user') {
            return [...history.slice(0, -1), { ...last, text: normalizedInterim }];
          }
          return [...history, { role: 'user', text: normalizedInterim }];
        });
        if (this.pendingUserCommitTimeout) clearTimeout(this.pendingUserCommitTimeout);
        this.pendingUserCommitTimeout = setTimeout(() => {
          if (this.pendingUserTranscript) {
            this.commitRecognizedUserText(this.pendingUserTranscript);
          }
        }, 1200);
      }

      const normalizedFinal = finalText.trim();
      if (normalizedFinal && this.session && this.isConnected()) {
        this.commitRecognizedUserText(normalizedFinal);
      }
    };

    this.speechRecognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
    };

    this.speechRecognition.onend = () => {
      this.speechRecognitionEnabled = false;
      if (this.isConnected() && !this.isMuted() && !this.buddySpeaking()) {
        setTimeout(() => this.startSpeechRecognition(), 300);
      }
    };

    try {
      this.speechRecognition.start();
      this.speechRecognitionEnabled = true;
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
    }
  }

  private stopSpeechRecognition() {
    this.speechRecognitionEnabled = false;
    if (this.pendingUserCommitTimeout) {
      clearTimeout(this.pendingUserCommitTimeout);
      this.pendingUserCommitTimeout = null;
    }
    try {
      this.speechRecognition?.stop();
    } catch {
      // ignore stop race
    }
    this.speechRecognition = null;
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  private calculateMicLevel(input: Float32Array): number {
    if (!input.length) return 0;
    let sumSquares = 0;
    for (let i = 0; i < input.length; i++) sumSquares += input[i] * input[i];
    return Math.min(1, Math.sqrt(sumSquares / input.length) * 3);
  }

  private commitRecognizedUserText(text: string) {
    const normalized = text.trim();
    if (!normalized || !this.session || !this.isConnected()) return;

    if (this.pendingUserCommitTimeout) {
      clearTimeout(this.pendingUserCommitTimeout);
      this.pendingUserCommitTimeout = null;
    }

    this.pendingUserTranscript = '';
    this.userSpeaking.set(false);
    this.chatHistory.update(history => {
      const last = history[history.length - 1];
      if (last?.role === 'user') {
        return [...history.slice(0, -1), { ...last, text: normalized }];
      }
      return [...history, { role: 'user', text: normalized }];
    });

    this.session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: normalized }]
      }],
      turnComplete: true
    });
  }

  private async playAudio(base64Data: string) {
    if (!this.playbackAudioContext || !this.playbackWorkletNode) return;
    console.log("Gemini Live: Audio chunk playing...");
    if (this.playbackAudioContext.state === 'suspended') await this.playbackAudioContext.resume();
    this.setBuddySpeaking(true);

    const buf = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
    const pcm16 = new Int16Array(buf);
    const f32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;
    this.playbackWorkletNode.port.postMessage(f32);
  }

  private stopAllAudio() {
    this.setBuddySpeaking(false);
    this.playbackWorkletNode?.port.postMessage('interrupt');
  }

  // ── Image generation (called directly from the UI prompt input) ──────────
  async generateLearningImage(prompt: string) {
    const clean = prompt.trim();
    if (!clean) return;
    if (!await this.checkKey()) return;
    if (!this.ai) this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    this.isGeneratingImage.set(true);
    this.generatedImagePrompt.set(clean);
    this.generatedImageUrl.set('');
    this.imageError.set('');

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: `Create a very simple, cartoonish, flat-color children's educational illustration. Bold black outlines, cheerful bright colors, minimal detail, like a kids' coloring book. Keep it small and low-complexity. Topic: ${clean}`,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE]
        }
      });

      let imageData = '';
      let mimeType = 'image/png';
      for (const candidate of response.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
          if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/')) {
            imageData = part.inlineData.data;
            mimeType = part.inlineData.mimeType;
            break;
          }
        }
        if (imageData) break;
      }
      if (!imageData) throw new Error('No image returned');

      this.generatedImageUrl.set(`data:${mimeType};base64,${imageData}`);
    } catch (err) {
      console.error('Image generation failed:', err);
      this.imageError.set(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      this.isGeneratingImage.set(false);
    }
  }

  private setBuddySpeaking(value: boolean) {
    if (value) {
      this.buddySpeaking.set(true);
      this.stopSpeechRecognition();
      this.pendingUserTranscript = '';
      if (this.buddySpeakingTimeout) clearTimeout(this.buddySpeakingTimeout);
      this.buddySpeakingTimeout = setTimeout(() => {
        this.buddySpeaking.set(false);
        if (this.useBrowserSpeechFallback && this.isConnected() && !this.isMuted()) this.startSpeechRecognition();
      }, 2500);
      return;
    }

    if (this.buddySpeakingTimeout) {
      clearTimeout(this.buddySpeakingTimeout);
      this.buddySpeakingTimeout = null;
    }
    this.buddySpeaking.set(false);
    if (this.useBrowserSpeechFallback && this.isConnected() && !this.isMuted()) this.startSpeechRecognition();
  }

  disconnect() { this.cleanup(); }

  private cleanup() {
    this.isConnected.set(false);
    this.isAnalyzing.set(false);
    this.isMuted.set(false);
    this.isCameraEnabled.set(true);
    this.micLevel.set(0);
    this.userSpeaking.set(false);
    this.buddySpeaking.set(false);
    this.generatedImageUrl.set('');
    this.generatedImagePrompt.set('');
    this.isGeneratingImage.set(false);
    this.imageError.set('');
    if (this.status() === 'connected') this.status.set('idle');

    if (this.session) {
      try { this.session.close(); } catch { /* ignore */ }
      this.session = null;
    }

    this.stopAllAudio();
    this.stopSpeechRecognition();
    if (this.buddySpeakingTimeout) {
      clearTimeout(this.buddySpeakingTimeout);
      this.buddySpeakingTimeout = null;
    }

    this.workletNode?.port && (this.workletNode.port.onmessage = null);
    this.workletNode?.disconnect();
    this.workletNode = null;
    this.playbackWorkletNode?.disconnect();
    this.playbackWorkletNode = null;
    this.playbackGainNode?.disconnect();
    this.playbackGainNode = null;
    this.mutedMonitorGain?.disconnect();
    this.mutedMonitorGain = null;
    this.source?.disconnect();
    this.source = null;

    if (this.inputAudioContext?.state !== 'closed') {
      this.inputAudioContext?.close().catch(() => { });
    }
    this.inputAudioContext = null;

    if (this.playbackAudioContext?.state !== 'closed') {
      this.playbackAudioContext?.close().catch(() => { });
    }
    this.playbackAudioContext = null;

    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream = null;
    this.currentVideoElement = null;
    if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
    this.speakingTimeout = null;
    if (this.pendingUserCommitTimeout) clearTimeout(this.pendingUserCommitTimeout);
    this.pendingUserCommitTimeout = null;
    this.pendingBuddyTranscript = '';
    this.pendingUserTranscript = '';
    this.userTurnInProgress = false;
    this.buddyTurnInProgress = false;
  }
}
