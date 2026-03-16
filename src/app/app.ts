import {
  ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiLiveService, CatalogItem } from './gemini-live.service';
import { FormsModule } from '@angular/forms';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fff7bf_0,_#fff7bf_14%,_#9be7ff_14%,_#9be7ff_28%,_#ffe09b_28%,_#ffe09b_42%,_#ffd2e1_42%,_#ffd2e1_56%,_#ffffff_56%,_#ffffff_100%)] text-[#1f2937]">
      @if (showCelebration) {
        <div class="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          @for (piece of confettiPieces; track piece.id) {
            <div
              class="confetti-piece"
              [style.left.%]="piece.left"
              [style.animationDelay.ms]="piece.delay"
              [style.animationDuration.ms]="piece.duration"
              [style.background]="piece.color"
              [style.transform]="'rotate(' + piece.rotate + 'deg)'">
            </div>
          }
          <div class="absolute inset-x-0 top-24 mx-auto w-fit rounded-[28px] border-4 border-[#1f2937] bg-white px-6 py-4 text-center shadow-[8px_8px_0_0_#1f2937]">
            <div class="text-3xl">🎉</div>
            <p class="mt-2 text-2xl font-black text-[#1f2937]">Great job today!</p>
            <p class="mt-1 text-sm font-bold text-[#6b7280]">Magic Buddy is proud of your learning session.</p>
          </div>
        </div>
      }

      <header class="sticky top-0 z-30 border-b-4 border-[#1f2937] bg-[#fffaf0]/95 shadow-[0_8px_0_0_#1f2937] backdrop-blur-sm">
        <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div class="flex items-center gap-4">
            <div class="flex h-14 w-14 items-center justify-center rounded-[20px] border-4 border-[#1f2937] bg-[#ffd54f] text-2xl shadow-[5px_5px_0_0_#1f2937]">✨</div>
            <div>
              <h1 class="font-black uppercase tracking-tight text-2xl text-[#1f2937] md:text-3xl">Magic Buddy</h1>
              <p class="text-[11px] font-bold uppercase tracking-[0.3em] text-[#ff6f61]">Homework Club For Bright Kids</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <button (click)="toggleConnection()"
              [class]="isConnected() ? 'bg-[#ff6f61] text-white' : 'bg-[#54d38a] text-[#1f2937]'"
              class="col-span-2 rounded-2xl border-4 border-[#1f2937] px-4 py-3 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0_0_#1f2937] transition-transform hover:-translate-y-0.5">
              {{ isConnected() ? 'End Session' : 'Start Learning' }}
            </button>

            <button (click)="toggleMute()"
              [disabled]="!isConnected()"
              [class]="isMuted() ? 'bg-[#ff8a80] text-white' : 'bg-white text-[#1f2937]'"
              class="rounded-2xl border-4 border-[#1f2937] px-4 py-3 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0_0_#1f2937] disabled:cursor-not-allowed disabled:opacity-50">
              {{ isMuted() ? 'Mic Off' : 'Mic On' }}
            </button>

            <button (click)="toggleCamera()"
              [disabled]="!isConnected()"
              [class]="isCameraEnabled() ? 'bg-[#57c7ff] text-[#1f2937]' : 'bg-white text-[#1f2937]'"
              class="rounded-2xl border-4 border-[#1f2937] px-4 py-3 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0_0_#1f2937] disabled:cursor-not-allowed disabled:opacity-50">
              {{ isCameraEnabled() ? 'Camera On' : 'Camera Off' }}
            </button>

            <button (click)="analyzeFrame()"
              [disabled]="!isConnected() || isAnalyzing()"
              class="rounded-2xl border-4 border-[#1f2937] bg-[#ffd54f] px-4 py-3 text-sm font-black uppercase tracking-wide text-[#1f2937] shadow-[4px_4px_0_0_#1f2937] disabled:cursor-not-allowed disabled:opacity-50">
              {{ isAnalyzing() ? 'Reading...' : 'Analyze Page' }}
            </button>
          </div>
        </div>
      </header>

      <main class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 xl:grid xl:grid-cols-[minmax(0,1.4fr)_360px] xl:items-start">
        <section class="space-y-6">
          <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-[28px] border-4 border-[#1f2937] bg-white p-4 shadow-[6px_6px_0_0_#1f2937]">
              <p class="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff6f61]">Start Here</p>
              <h2 class="mt-2 text-xl font-black text-[#1f2937]">1. Meet Buddy</h2>
              <p class="mt-2 text-sm font-bold leading-relaxed text-[#6b7280]">Press <strong>Start Learning</strong>, say the student name, and let Buddy begin the lesson.</p>
            </div>
            <div class="rounded-[28px] border-4 border-[#1f2937] bg-[#eefbff] p-4 shadow-[6px_6px_0_0_#1f2937]">
              <p class="text-[10px] font-black uppercase tracking-[0.28em] text-[#57c7ff]">Live Help</p>
              <h2 class="mt-2 text-xl font-black text-[#1f2937]">2. Talk Or Type</h2>
              <p class="mt-2 text-sm font-bold leading-relaxed text-[#6b7280]">Ask for counting, vowels, A to Z, spelling, or multiplication using voice or the text box.</p>
            </div>
            <div class="rounded-[28px] border-4 border-[#1f2937] bg-[#fff9d6] p-4 shadow-[6px_6px_0_0_#1f2937]">
              <p class="text-[10px] font-black uppercase tracking-[0.28em] text-[#d97706]">Homework Scan</p>
              <h2 class="mt-2 text-xl font-black text-[#1f2937]">3. Show A Page</h2>
              <p class="mt-2 text-sm font-bold leading-relaxed text-[#6b7280]">Point the camera at a worksheet and use <strong>Analyze Page</strong> for a clear visual explanation.</p>
            </div>
            <div class="rounded-[28px] border-4 border-[#1f2937] bg-[#f5f3ff] p-4 shadow-[6px_6px_0_0_#1f2937]">
              <p class="text-[10px] font-black uppercase tracking-[0.28em] text-[#7c3aed]">Creative Help</p>
              <h2 class="mt-2 text-xl font-black text-[#1f2937]">4. Make An Image</h2>
              <p class="mt-2 text-sm font-bold leading-relaxed text-[#6b7280]">Type any topic in the Buddy Studio box and press Create Image to get a cartoon picture.</p>
            </div>
          </section>

          <div class="rounded-[32px] border-4 border-[#1f2937] bg-white p-4 shadow-[8px_8px_0_0_#1f2937]">
            <div class="mb-4 flex flex-wrap items-end justify-between gap-4 rounded-[24px] border-4 border-[#1f2937] bg-[#fffaf0] p-4 shadow-[4px_4px_0_0_#1f2937]">
              <div>
                <p class="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff6f61]">Main Lesson Space</p>
                <h2 class="mt-2 text-2xl font-black text-[#1f2937]">Camera Classroom</h2>
                <p class="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-[#6b7280]">
                  This is the main teaching area. Buddy listens here, watches the camera here, and guides the child through the session step by step.
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <div class="rounded-full border-2 border-[#1f2937] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">Voice</div>
                <div class="rounded-full border-2 border-[#1f2937] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">Camera</div>
                <div class="rounded-full border-2 border-[#1f2937] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">Homework</div>
                <div class="rounded-full border-2 border-[#1f2937] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">Topics</div>
              </div>
            </div>

            <div class="mb-4 flex flex-wrap items-center gap-3">
              <div class="rounded-full border-2 border-[#1f2937] bg-[#54d38a] px-4 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#1f2937]">
                {{ isConnected() ? 'Buddy Is Live' : 'Ready To Start' }}
              </div>
              <div class="rounded-full border-2 border-[#1f2937] bg-[#f4f1ea] px-4 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#1f2937]">
                {{ userSpeaking() ? 'Buddy Hears You' : 'Waiting For Voice' }}
              </div>
              <div class="flex min-w-[180px] items-center gap-2 rounded-full border-2 border-[#1f2937] bg-[#fef3c7] px-3 py-1.5">
                <span class="text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">Mic</span>
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-white">
                  <div class="h-full rounded-full bg-[#54d38a] transition-all duration-100" [style.width.%]="micLevel() * 100"></div>
                </div>
              </div>
            </div>

            <div class="relative overflow-hidden rounded-[28px] border-4 border-[#1f2937] bg-[#fff7bf]">
              <video #videoFeed autoplay playsinline muted class="aspect-[4/3] w-full object-cover md:aspect-video"></video>

              @if (!isConnected()) {
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#1f2937]/60 p-8 text-center text-white backdrop-blur-sm">
                  @if (status() === 'needs-key') {
                    <div class="rounded-[24px] border-4 border-white bg-[#ffd54f] p-5 text-[#1f2937] shadow-[6px_6px_0_0_#ffffff]">
                      <div class="text-4xl">🔑</div>
                    </div>
                    <div>
                      <p class="text-2xl font-black">API Key Needed</p>
                      <p class="mt-2 text-sm text-white/80">Pick your Gemini key so Buddy can talk and teach.</p>
                    </div>
                    <button (click)="selectKey()" class="rounded-2xl border-4 border-[#1f2937] bg-[#57c7ff] px-6 py-3 text-sm font-black uppercase tracking-wide text-[#1f2937] shadow-[4px_4px_0_0_#1f2937]">
                      Select Key
                    </button>
                  } @else if (status() === 'connecting') {
                    <div class="h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
                    <p class="text-2xl font-black">Magic Buddy is getting ready...</p>
                  } @else if (status() === 'error') {
                    <div class="text-5xl">😵</div>
                    <p class="text-2xl font-black">Oops! Let’s try that again.</p>
                    <button (click)="toggleConnection()" class="rounded-2xl border-4 border-[#1f2937] bg-white px-6 py-3 text-sm font-black uppercase tracking-wide text-[#1f2937] shadow-[4px_4px_0_0_#1f2937]">
                      Retry
                    </button>
                  } @else {
                    <div class="rounded-[28px] border-4 border-white bg-[#ff8a80] px-6 py-4 text-4xl shadow-[6px_6px_0_0_#ffffff]">🎒</div>
                    <div>
                      <p class="text-3xl font-black">Welcome to Homework Club!</p>
                      <p class="mt-2 max-w-xl text-sm text-white/85">Press <strong>Start Learning</strong>, speak to Buddy, and hold up your homework for a bright, fun lesson.</p>
                    </div>
                  }
                </div>
              }

              @if (!isCameraEnabled() && isConnected()) {
                <div class="absolute inset-0 flex items-center justify-center bg-[#1f2937]/70 text-center text-white backdrop-blur-sm">
                  <div>
                    <div class="text-5xl">📷</div>
                    <p class="mt-3 text-xl font-black">Camera is off</p>
                  </div>
                </div>
              }

              <div class="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                <div class="rounded-full border-2 border-[#1f2937] bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#1f2937]">
                  Step 1: Talk
                </div>
                <div class="rounded-full border-2 border-[#1f2937] bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#1f2937]">
                  Step 2: Show Homework
                </div>
                <div class="rounded-full border-2 border-[#1f2937] bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#1f2937]">
                  Step 3: Learn Together
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-6">
            <section class="rounded-[32px] border-4 border-[#1f2937] bg-[#fffaf0] p-5 shadow-[8px_8px_0_0_#1f2937]">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-black uppercase tracking-[0.3em] text-[#ff6f61]">Type To Buddy</p>
                  <h2 class="text-2xl font-black text-[#1f2937]">Ask A Question</h2>
                </div>
                <div class="rounded-full border-2 border-[#1f2937] bg-[#57c7ff] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">
                  Great Backup
                </div>
              </div>
              <div class="flex flex-col gap-3 sm:flex-row">
                <input
                  [(ngModel)]="draftMessage"
                  [disabled]="!isConnected()"
                  (keydown.enter)="sendTypedMessage()"
                  placeholder="Type a question if voice is not working..."
                  class="min-w-0 flex-1 rounded-[22px] border-4 border-[#1f2937] bg-white px-4 py-4 text-sm text-[#1f2937] outline-none placeholder:text-[#6b7280] disabled:opacity-50"
                />
                <button
                  (click)="sendTypedMessage()"
                  [disabled]="!isConnected() || !draftMessage.trim()"
                  class="rounded-[22px] border-4 border-[#1f2937] bg-[#54d38a] px-6 py-4 text-sm font-black uppercase tracking-wide text-[#1f2937] shadow-[4px_4px_0_0_#1f2937] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              <p class="mt-3 text-xs font-bold text-[#6b7280]">Tip: Ask things like "What letter is this?", "Can you quiz me on vowels?", or "Help me with multiplication."</p>
              <div class="mt-4 rounded-[20px] border-4 border-[#1f2937] bg-white px-4 py-3 text-sm font-bold leading-relaxed text-[#6b7280] shadow-[3px_3px_0_0_#1f2937]">
                Best use: if voice is noisy, type here and keep the demo moving smoothly.
              </div>
            </section>

            <section class="rounded-[32px] border-4 border-[#1f2937] bg-white p-5 shadow-[8px_8px_0_0_#1f2937]">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-black uppercase tracking-[0.3em] text-[#57c7ff]">Buddy Vision</p>
                  <h2 class="text-2xl font-black text-[#1f2937]">What Buddy Sees</h2>
                </div>
                <div class="rounded-full border-2 border-[#1f2937] bg-[#ffd54f] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">
                  {{ catalogItems().length }} Spotted
                </div>
              </div>

              <div class="flex gap-3 overflow-x-auto pb-2">
                @if (catalogItems().length === 0) {
                  <div class="w-full rounded-[24px] border-4 border-dashed border-[#1f2937] bg-[#fffaf0] px-4 py-8 text-center text-sm font-bold text-[#6b7280]">
                    Show a worksheet, letter, number, or drawing and Buddy will collect it here.
                  </div>
                }

                @for (item of catalogItems(); track item.id) {
                  <div class="w-48 flex-shrink-0 rounded-[24px] border-4 border-[#1f2937] bg-[#f8fbff] p-4 shadow-[4px_4px_0_0_#1f2937]">
                    <div class="text-3xl">{{ getCatalogIcon(item.type) }}</div>
                    <div class="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6f61]">{{ item.type }}</div>
                    <div class="mt-1 text-lg font-black text-[#1f2937]">{{ item.name }}</div>
                    <div class="mt-2 text-xs leading-relaxed text-[#4b5563]">{{ item.description }}</div>
                  </div>
                }
              </div>

              <div class="mt-5 rounded-[24px] border-4 border-[#1f2937] bg-[#e6fff4] p-4 shadow-[4px_4px_0_0_#1f2937]">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-black uppercase tracking-[0.3em] text-[#16a34a]">Session Collection</p>
                    <h3 class="text-xl font-black text-[#1f2937]">What We Learned</h3>
                  </div>
                  <div class="rounded-full border-2 border-[#1f2937] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">
                    {{ getLearnedItems().length }} Learned
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  @if (getLearnedItems().length === 0) {
                    <div class="rounded-[18px] border-4 border-dashed border-[#1f2937] bg-white px-4 py-4 text-sm font-bold text-[#6b7280]">
                      As Buddy teaches, learned letters, numbers, and topics will show up here.
                    </div>
                  }

                  @for (item of getLearnedItems(); track item) {
                    <div class="rounded-full border-4 border-[#1f2937] bg-white px-4 py-2 text-sm font-black text-[#1f2937] shadow-[3px_3px_0_0_#1f2937]">
                      {{ item }}
                    </div>
                  }
                </div>
              </div>

              <div class="mt-5 rounded-[24px] border-4 border-[#1f2937] bg-[#f5f3ff] p-4 shadow-[4px_4px_0_0_#1f2937]">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-black uppercase tracking-[0.3em] text-[#7c3aed]">Buddy Studio</p>
                    <h3 class="text-xl font-black text-[#1f2937]">Learning Image</h3>
                  </div>
                  @if (isGeneratingImage()) {
                    <div class="rounded-full border-2 border-[#1f2937] bg-[#ffd54f] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">
                      Drawing...
                    </div>
                  }
                </div>

                <!-- Prompt input + button -->
                <div class="mb-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    [(ngModel)]="imagePromptDraft"
                    [disabled]="isGeneratingImage()"
                    (keydown.enter)="generateImage()"
                    placeholder="e.g. counting animals, letter A, shapes, vowels poster..."
                    class="min-w-0 flex-1 rounded-[22px] border-4 border-[#1f2937] bg-white px-4 py-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af] disabled:opacity-50"
                  />
                  <button
                    (click)="generateImage()"
                    [disabled]="!imagePromptDraft.trim() || isGeneratingImage()"
                    class="rounded-[22px] border-4 border-[#1f2937] bg-[#c084fc] px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[4px_4px_0_0_#1f2937] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                  >
                    {{ isGeneratingImage() ? 'Drawing...' : '🎨 Create Image' }}
                  </button>
                </div>

                @if (generatedImageUrl()) {
                  <img [src]="generatedImageUrl()" [alt]="generatedImagePrompt() || 'Generated learning image'" class="w-full rounded-[20px] border-4 border-[#1f2937] bg-white object-contain shadow-[4px_4px_0_0_#1f2937]" />
                  <p class="mt-2 text-xs font-bold text-[#6b7280]">{{ generatedImagePrompt() }}</p>
                } @else if (imageError()) {
                  <div class="rounded-[20px] border-4 border-[#1f2937] bg-[#fff1f2] px-4 py-5 text-center text-sm font-bold text-[#9f1239] shadow-[4px_4px_0_0_#1f2937]">
                    Couldn't make that image.
                    <div class="mt-1 text-xs font-normal text-[#6b7280]">{{ imageError() }}</div>
                  </div>
                } @else {
                  <div class="rounded-[20px] border-4 border-dashed border-[#1f2937] bg-white px-4 py-8 text-center text-sm font-bold text-[#9ca3af]">
                    Type a topic above and hit Create Image 🎨
                  </div>
                }
              </div>
            </section>
          </div>
        </section>

        <aside class="xl:sticky xl:top-28 xl:w-[420px]">
          <section class="rounded-[32px] border-4 border-[#1f2937] bg-white p-5 shadow-[8px_8px_0_0_#1f2937]">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.3em] text-[#54d38a]">Conversation</p>
                <h2 class="text-2xl font-black text-[#1f2937]">Live Transcript</h2>
                <p class="mt-2 text-sm font-bold leading-relaxed text-[#6b7280]">This panel shows what the student said and how Buddy replied during the lesson.</p>
              </div>
              <div class="rounded-full border-2 border-[#1f2937] bg-[#fef3c7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#1f2937]">
                {{ chatHistory().length }} Messages
              </div>
            </div>

            <div #transcriptScroll class="max-h-[60vh] space-y-2 overflow-y-auto rounded-[24px] bg-[#fffaf0] p-4 custom-scrollbar">
              @if (chatHistory().length === 0) {
                <div class="rounded-[22px] border-4 border-dashed border-[#1f2937] bg-white p-6 text-center text-sm font-bold text-[#6b7280]">
                  Start a session and Buddy’s conversation will appear here.
                </div>
              }

              @for (msg of chatHistory(); track $index) {
                @if (isBuddy(msg.role)) {
                  <div class="flex flex-row gap-2">
                    <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#1f2937] bg-[#54d38a] text-[#1f2937] text-xs font-black">B</div>
                    <div class="max-w-[82%] rounded-2xl rounded-tl-none bg-[#dcfce7] px-3 py-2 text-sm leading-relaxed break-words text-[#1f2937]">{{ msg.text }}</div>
                  </div>
                } @else {
                  <div class="flex flex-row-reverse gap-2">
                    <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#1f2937] bg-[#f97316] text-white text-xs font-black">Y</div>
                    <div class="max-w-[82%] rounded-2xl rounded-tr-none bg-[#ffedd5] px-3 py-2 text-sm leading-relaxed break-words text-[#1f2937]">{{ msg.text }}</div>
                  </div>
                }
              }
            </div>

            <div class="mt-5 space-y-3">
              <button (click)="getFeedback()"
                [disabled]="chatHistory().length < 2 || isFeedbackLoading()"
                class="w-full rounded-[22px] border-4 border-[#1f2937] bg-[#c084fc] px-4 py-4 text-sm font-black uppercase tracking-wide text-white shadow-[4px_4px_0_0_#1f2937] disabled:cursor-not-allowed disabled:opacity-50">
                {{ isFeedbackLoading() ? 'Thinking...' : 'Get Session Feedback' }}
              </button>

              @if (sessionFeedback()) {
                <div class="rounded-[24px] border-4 border-[#1f2937] bg-[#f5f3ff] p-4 text-sm leading-relaxed text-[#4c1d95] shadow-[4px_4px_0_0_#1f2937]">
                  <div class="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#7c3aed]">Star Student Summary</div>
                  {{ sessionFeedback() }}
                </div>
              }
            </div>
          </section>
        </aside>
      </main>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 999px; border: 2px solid transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #111827; }
    .confetti-piece {
      position: absolute;
      top: -10vh;
      width: 12px;
      height: 20px;
      border: 2px solid #1f2937;
      border-radius: 4px;
      animation-name: confetti-fall;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }
    @keyframes confetti-fall {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(120vh) rotate(540deg); opacity: 0.8; }
    }
  `]
})
export class App {
  private gemini = inject(GeminiLiveService);
  draftMessage = '';
  imagePromptDraft = '';
  showCelebration = false;
  confettiPieces = Array.from({ length: 28 }, (_, index) => ({
    id: index,
    left: (index * 3.7) % 100,
    delay: (index % 7) * 90,
    duration: 2200 + (index % 5) * 260,
    rotate: index * 17,
    color: ['#ffd54f', '#57c7ff', '#ff8a80', '#54d38a', '#c084fc'][index % 5]
  }));

  @ViewChild('videoFeed')      videoFeed!: ElementRef<HTMLVideoElement>;
  @ViewChild('transcriptScroll') transcriptScroll!: ElementRef<HTMLDivElement>;

  isConnected      = this.gemini.isConnected;
  isMuted          = this.gemini.isMuted;
  isCameraEnabled  = this.gemini.isCameraEnabled;
  isAnalyzing      = this.gemini.isAnalyzing;
  isFeedbackLoading = this.gemini.isFeedbackLoading;
  isGeneratingImage = this.gemini.isGeneratingImage;
  micLevel         = this.gemini.micLevel;
  userSpeaking     = this.gemini.userSpeaking;
  status           = this.gemini.status;
  chatHistory      = this.gemini.chatHistory;
  catalogItems     = this.gemini.catalogItems;
  sessionFeedback  = this.gemini.sessionFeedback;
  generatedImageUrl = this.gemini.generatedImageUrl;
  generatedImagePrompt = this.gemini.generatedImagePrompt;
  imageError       = this.gemini.imageError;

  constructor() {
    // Auto-scroll transcript on new messages
    effect(() => {
      if (this.chatHistory().length > 0) {
        setTimeout(() => {
          const el = this.transcriptScroll?.nativeElement;
          if (el) el.scrollTop = el.scrollHeight;
        }, 80);
      }
    });
  }

  async toggleConnection() {
    if (this.isConnected()) {
      const hadSessionActivity = this.chatHistory().length > 1 || this.catalogItems().length > 0;
      this.gemini.disconnect();
      if (hadSessionActivity) this.triggerCelebration();
    } else {
      await this.gemini.connect(this.videoFeed.nativeElement);
    }
  }

  toggleMute()   { this.gemini.toggleMute(); }
  toggleCamera() { this.gemini.toggleCamera(); }
  async analyzeFrame()   { await this.gemini.analyzeCurrentFrame(); }
  async getFeedback()    { await this.gemini.getSessionFeedback(); }
  async selectKey()      { await this.gemini.openKeySelector(); }
  sendTypedMessage() {
    const message = this.draftMessage.trim();
    if (!message) return;
    this.gemini.sendTypedMessage(message);
    this.draftMessage = '';
  }

  async generateImage() {
    const prompt = this.imagePromptDraft.trim();
    if (!prompt) return;
    await this.gemini.generateLearningImage(prompt);
    this.imagePromptDraft = '';
  }

  isBuddy(role: string) { return role === 'buddy'; }

  getCatalogIcon(type: string): string {
    const t = type?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      letter: '🔤', number: '🔢', word: '💬',
      shape: '🔷', drawing: '🎨', homework: '📝', object: '📦'
    };
    return map[t] ?? '👁️';
  }

  getLearnedItems(): string[] {
    const items = new Set<string>();

    for (const item of this.catalogItems()) {
      if (item.name?.trim()) items.add(item.name.trim());
    }

    const topicMatchers = [
      { label: 'Counting', pattern: /\bcount(ing)?\b/i },
      { label: 'Multiplication', pattern: /\bmultiplication\b|\btimes tables?\b/i },
      { label: 'Vowels', pattern: /\bvowels?\b/i },
      { label: 'Alphabet', pattern: /\ba to z\b|\balphabet\b/i },
      { label: 'Numbers', pattern: /\bnumbers?\b/i },
      { label: 'Letters', pattern: /\bletters?\b/i },
      { label: 'Shapes', pattern: /\bshapes?\b/i },
      { label: 'Spelling', pattern: /\bspell(ing)?\b/i }
    ];

    for (const message of this.chatHistory()) {
      for (const topic of topicMatchers) {
        if (topic.pattern.test(message.text)) items.add(topic.label);
      }
    }

    return Array.from(items).slice(0, 12);
  }

  private triggerCelebration() {
    this.showCelebration = true;
    setTimeout(() => {
      this.showCelebration = false;
    }, 2600);
  }
}
