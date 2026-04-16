<template>
  <div class="presentation-view">
    <!-- Slide Controls -->
    <div class="slide-controls" :class="{ hidden: isFullscreen }">
      <div class="controls-left">
        <button @click="goHome" class="control-btn">
          <span class="btn-icon">🏠</span>
          新しいプレゼンテーション
        </button>
        <div class="slide-counter">
          {{ currentSlideIndex + 1 }} / {{ totalSlides }}
        </div>
      </div>

      <div class="controls-center">
        <button @click="previousSlide" :disabled="currentSlideIndex === 0" class="nav-btn">
          <span class="btn-icon">⬅️</span>
        </button>

        <button @click="togglePlayPause" class="play-btn">
          <span class="btn-icon">{{ isPlaying ? '⏸️' : '▶️' }}</span>
        </button>

        <button @click="nextSlide" :disabled="currentSlideIndex >= totalSlides - 1" class="nav-btn">
          <span class="btn-icon">➡️</span>
        </button>
      </div>

      <div class="controls-right">
        <button @click="toggleFullscreen" class="control-btn fullscreen-btn">
          <span class="btn-icon">{{ isFullscreen ? '🪟' : '🖥️' }}</span>
          フルスクリーン
        </button>
      </div>
    </div>

    <!-- Slide Content -->
    <div class="slide-container" ref="slideContainer">
      <!-- Current Slide Content or Pending State -->
      <div v-if="slidesStore.canStartPresentation" class="slide-content">
        <!-- Ready Slide Content -->
        <div v-if="slidesStore.isCurrentSlideReady" class="slide-renderer" v-html="compiledSlideHTML"></div>

        <!-- Generating Slide State -->
        <div v-else-if="slidesStore.isCurrentSlideGenerating" class="slide-generating">
          <div class="generating-content">
            <div class="spinner-medium"></div>
            <h3>スライド {{ currentSlideIndex + 1 }} 生成中...</h3>
            <p>しばらくお待ちください</p>
          </div>
        </div>

        <!-- Pending Slide State -->
        <div v-else class="slide-pending">
          <div class="pending-content">
            <div class="pending-icon">⏳</div>
            <h3>スライド {{ currentSlideIndex + 1 }} 準備中...</h3>
            <p>このスライドはまだ生成されていません</p>
          </div>
        </div>

        <!-- Audio Player -->
        <audio
          v-if="currentNarration && slidesStore.isCurrentSlideReady"
          :src="currentAudio?.audioUrl"
          ref="audioPlayer"
          @ended="onAudioEnded"
          @loadstart="onAudioLoadStart"
          @canplay="onAudioCanPlay"
        ></audio>
      </div>

      <!-- No Slides Fallback -->
      <div v-else class="no-slides">
        <div class="no-slides-content">
          <span class="icon">📄</span>
          <h2>スライドが見つかりません</h2>
          <p>プレゼンテーションを生成するか、有効なスライドIDを確認してください。</p>
          <button @click="goHome" class="btn-primary">新しいプレゼンテーションを作成</button>
        </div>
      </div>
    </div>

    <!-- Slide Navigation -->
    <div class="slide-navigation" :class="{ hidden: isFullscreen, collapsed: isSlideNavCollapsed }">
      <button @click="toggleSlideNav" class="nav-toggle-btn">
        <span class="btn-icon">{{ isSlideNavCollapsed ? '◀' : '▶' }}</span>
      </button>
      <div class="nav-title">スライド一覧 ({{ slidesStore.slides.length }}/{{ slidesStore.totalSlides }})</div>
      <div class="nav-slides">
        <!-- All Slides (Completed and Pending) -->
        <div
          v-for="slideIndex in slidesStore.totalSlides"
          :key="'slide-' + (slideIndex - 1)"
          class="nav-slide"
          :class="{
            active: (slideIndex - 1) === currentSlideIndex,
            completed: getSlideStatus(slideIndex - 1) === 'completed',
            generating: getSlideStatus(slideIndex - 1) === 'generating',
            pending: getSlideStatus(slideIndex - 1) === 'pending',
            'has-audio': hasAudio(slideIndex - 1)
          }"
          @click="goToSlide(slideIndex - 1)"
        >
          <div class="nav-slide-number">{{ slideIndex }}</div>
          <div class="nav-slide-info">
            <div class="nav-slide-title">
              {{ getSlideTitle(slideIndex - 1) }}
            </div>
            <div class="nav-slide-theme">
              {{ getSlideThemeLabel(slideIndex - 1) }}
            </div>
          </div>
          <div class="slide-indicators">
            <div class="slide-status-indicator" :class="getSlideStatus(slideIndex - 1) + '-indicator'">
              <span v-if="getSlideStatus(slideIndex - 1) === 'completed'">✓</span>
              <div v-else-if="getSlideStatus(slideIndex - 1) === 'generating'" class="spinner-small"></div>
              <span v-else>⏳</span>
            </div>
            <div v-if="hasAudio(slideIndex - 1)" class="audio-indicator">🔊</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Keyboard Shortcuts Help -->
    <div v-if="showHelp" class="help-overlay" @click="showHelp = false">
      <div class="help-content" @click.stop>
        <h3>キーボードショートカット</h3>
        <div class="shortcuts">
          <div class="shortcut">
            <kbd>←</kbd> <span>前のスライド</span>
          </div>
          <div class="shortcut">
            <kbd>→</kbd> <span>次のスライド</span>
          </div>
          <div class="shortcut">
            <kbd>Space</kbd> <span>再生/一時停止</span>
          </div>
          <div class="shortcut">
            <kbd>F</kbd> <span>フルスクリーン切り替え</span>
          </div>
          <div class="shortcut">
            <kbd>A</kbd> <span>スライド一覧の表示切り替え</span>
          </div>
          <div class="shortcut">
            <kbd>H</kbd> <span>ヘルプ表示</span>
          </div>
          <div class="shortcut">
            <kbd>Esc</kbd> <span>フルスクリーン終了</span>
          </div>
        </div>
        <button @click="showHelp = false" class="help-close">閉じる</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSlidesStore } from '@/stores/slides'
import { useSlideNavigation } from '@/composables/useSlideNavigation'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useFullscreen } from '@/composables/useFullscreen'
import { useSlideRenderer } from '@/composables/useSlideRenderer'
import type { SlideTheme } from '@/types/slides'

const router = useRouter()
const route = useRoute()
const slidesStore = useSlidesStore()

const slideId = computed(() => route.params.slideId as string)

// Template refs
const slideContainer = ref<HTMLElement>()
const audioPlayer = ref<HTMLAudioElement>()

// UI-only state
const isSlideNavCollapsed = ref(false)
const showHelp = ref(false)

// Composables
const {
  currentSlideIndex,
  totalSlides,
  currentSlide,
  currentNarration,
  currentAudio,
  previousSlide,
  nextSlide,
  goToSlide,
} = useSlideNavigation(slidesStore)

const { isFullscreen, toggleFullscreen } = useFullscreen(slideContainer)

const { isPlaying, togglePlayPause, onAudioEnded, onAudioLoadStart, onAudioCanPlay, resetAudio } =
  useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)

const { compiledSlideHTML, compileCurrentSlide } = useSlideRenderer(
  currentSlide,
  computed(() => slidesStore.isCurrentSlideReady),
  currentSlideIndex
)

// Navigation helpers
const goHome = () => router.push('/')
const toggleSlideNav = () => { isSlideNavCollapsed.value = !isSlideNavCollapsed.value }

// Slide metadata helpers
const hasAudio = (slideIndex: number): boolean => !!slidesStore.getAudio(slideIndex)

const getThemeLabel = (theme: SlideTheme): string => {
  const themeLabels: Record<SlideTheme, string> = {
    'project_overview': 'プロジェクト概要',
    'project_progress': 'プロジェクト進捗',
    'issue_management': '課題管理',
    'risk_analysis': 'リスク分析',
    'team_collaboration': 'チーム協力',
    'document_management': 'ドキュメント管理',
    'codebase_activity': 'コードベース活動',
    'notifications': '通知管理',
    'predictive_analysis': '予測分析',
    'summary_plan': '総括と計画',
  }
  return themeLabels[theme] || theme
}

const getSlideStatus = (slideIndex: number): 'pending' | 'generating' | 'completed' => {
  if (slideIndex < slidesStore.slides.length) {
    return 'completed'
  }
  return slidesStore.slideGenerationStatus.get(slideIndex) || 'pending'
}

const getSlideTitle = (slideIndex: number): string => {
  if (slideIndex < slidesStore.slides.length) {
    return slidesStore.slides[slideIndex].title
  }
  const status = getSlideStatus(slideIndex)
  return status === 'generating' ? 'スライド生成中...' : 'スライド準備中...'
}

const getSlideThemeLabel = (slideIndex: number): string => {
  if (slideIndex < slidesStore.slides.length) {
    return getThemeLabel(slidesStore.slides[slideIndex].theme)
  }
  if (slideIndex < slidesStore.expectedThemes.length) {
    return getThemeLabel(slidesStore.expectedThemes[slideIndex])
  }
  const status = getSlideStatus(slideIndex)
  return status === 'generating' ? '生成中' : '準備中'
}

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      previousSlide()
      break
    case 'ArrowRight':
    case ' ':
      event.preventDefault()
      if (event.key === ' ') {
        togglePlayPause()
      } else {
        nextSlide()
      }
      break
    case 'f':
    case 'F':
      event.preventDefault()
      toggleFullscreen()
      break
    case 'a':
    case 'A':
      event.preventDefault()
      toggleSlideNav()
      break
    case 'h':
    case 'H':
      event.preventDefault()
      showHelp.value = !showHelp.value
      break
    case 'Escape':
      if (showHelp.value) {
        showHelp.value = false
      } else if (isFullscreen.value) {
        toggleFullscreen()
      }
      break
  }
}

// Watchers
watch(currentSlide, () => {
  compileCurrentSlide()
  resetAudio()
}, { immediate: true })

watch(isPlaying, (playing) => {
  if (playing && currentAudio.value && audioPlayer.value) {
    audioPlayer.value.play()
  }
})

// Lifecycle
onMounted(async () => {
  // Load Mermaid for diagram rendering
  if (!window.mermaid) {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
    script.onload = () => {
      window.mermaid.initialize({
        theme: 'default',
        themeVariables: { primaryColor: '#667eea' },
      })
    }
    document.head.appendChild(script)
  }

  document.addEventListener('keydown', handleKeydown)

  // Try to restore slides data from server if slideId exists
  if (slideId.value && !slidesStore.hasSlides) {
    const loaded = await slidesStore.loadSlidesFromServer(slideId.value)
    if (loaded && slidesStore.isGenerating) {
      slidesStore.connectWebSocket(slideId.value)
    }
  }

  compileCurrentSlide()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (isFullscreen.value) {
    document.exitFullscreen()
  }
})

declare global {
  interface Window {
    mermaid: any
  }
}
</script>

<style scoped>
.presentation-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #000;
  color: white;
  position: relative;
  overflow: hidden;
}

.slide-controls {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 0.8rem 1.5rem;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  z-index: 100;
  transition: opacity 0.3s ease;
  gap: 3.5rem;
}

.slide-controls.hidden {
  opacity: 0;
  pointer-events: none;
}

.controls-left {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
}

.controls-center {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.controls-right {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
}

.fullscreen-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
}

.control-btn, .nav-btn, .play-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-btn:hover, .nav-btn:hover, .play-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.fullscreen-btn:hover {
  background: rgba(0, 0, 0, 0.9) !important;
}

.control-btn:disabled, .nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.control-btn.active {
  background: rgba(102, 126, 234, 0.3);
  border-color: rgba(102, 126, 234, 0.5);
}

.slide-counter {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.btn-icon {
  font-size: 1.1rem;
}

.slide-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}


.slide-content {
  width: 100%;
  height: 100%;
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-renderer {
  max-width: 1200px;
  width: 100%;
  background: white;
  color: #333;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  min-height: 600px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 0 auto;
}

.no-slides {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.no-slides-content {
  text-align: center;
  max-width: 400px;
}

.no-slides-content .icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  display: block;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 1rem;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
}

.slide-navigation {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 320px;
  max-height: 85vh;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px 0 0 12px;
  overflow: visible;
  transition: all 0.3s ease;
  z-index: 200;
  border: 2px solid rgba(102, 126, 234, 0.3);
}

.slide-navigation.collapsed {
  transform: translateY(-50%) translateX(310px);
}

.slide-navigation.hidden {
  opacity: 0;
  pointer-events: none;
}

.nav-toggle-btn {
  position: absolute;
  left: -35px;
  top: 8px;
  width: 35px;
  height: 48px;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  border-radius: 6px 0px 0px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 300;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  font-size: 0.9rem;
  font-weight: normal;
  backdrop-filter: blur(10px);
}

.nav-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  color: rgba(255, 255, 255, 1);
}

.nav-toggle-btn .btn-icon {
  font-size: 1.2rem;
}

.nav-title {
  padding: 1rem;
  background: rgba(102, 126, 234, 0.2);
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-slides {
  max-height: calc(85vh - 60px);
  overflow-y: auto;
}

.nav-slide {
  display: flex;
  align-items: flex-start;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  min-height: 60px;
}

.nav-slide:hover {
  background: rgba(255, 255, 255, 0.05);
}

.nav-slide.active {
  background: rgba(102, 126, 234, 0.2);
  border-left: 3px solid #667eea;
}

.nav-slide-number {
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
  margin-right: 0.75rem;
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.nav-slide.active .nav-slide-number {
  background: #667eea;
}

.nav-slide-info {
  flex: 1;
  min-width: 0;
}

.nav-slide-title {
  font-weight: 600;
  font-size: 0.875rem;
  white-space: normal;
  overflow: visible;
  word-wrap: break-word;
  line-height: 1.3;
}

.nav-slide-theme {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 0.25rem;
}


.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.help-content {
  background: white;
  color: #333;
  padding: 2rem;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
}

.help-content h3 {
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.shortcuts {
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.shortcut kbd {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  min-width: 60px;
  text-align: center;
}

.help-close {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  font-weight: 600;
}

/* Slide content styling */
.slide-renderer :deep(h1) {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem 0;
  color: #333;
  text-align: center;
}

.slide-renderer :deep(h2) {
  font-size: 2rem;
  font-weight: 600;
  margin: 2rem 0 1rem 0;
  color: #444;
}

.slide-renderer :deep(h3) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem 0;
  color: #555;
}

.slide-renderer :deep(p) {
  line-height: 1.6;
  margin: 1rem 0;
}

.slide-renderer :deep(.mermaid) {
  text-align: center;
  margin: 2rem 0;
}

.slide-renderer :deep(.mermaid-error) {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  color: #ef4444;
  font-size: 0.875rem;
  margin: 1rem 0;
}

.slide-renderer :deep(.chart-error) {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  color: #f59e0b;
  font-size: 0.875rem;
  margin: 1rem 0;
}

.slide-renderer :deep(strong) {
  font-weight: 700;
  color: #667eea;
}

.slide-renderer :deep(em) {
  font-style: italic;
  color: #666;
}

.slide-renderer :deep(.chart-placeholder) {
  margin: 2rem 0;
  text-align: center;
  min-height: 300px;
}

.slide-renderer :deep(.chart-placeholder canvas) {
  max-width: 100%;
  height: auto;
}
</style>

<style>
/* Global styles for animations */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Global styles for Mermaid diagrams */
.mermaid svg {
  max-width: 100%;
  height: auto;
}

/* Streaming Presentation Styles */
.slide-generating,
.slide-pending {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.generating-content,
.pending-content {
  text-align: center;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.spinner-medium {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(34, 197, 94, 0.1);
  border-top: 4px solid #22c55e;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1.5rem;
}

.spinner-small {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(34, 197, 94, 0.1);
  border-top: 2px solid #22c55e;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

.pending-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.generating-content h3,
.pending-content h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.5rem;
}

.generating-content p,
.pending-content p {
  margin: 0;
  color: #666;
  font-size: 1rem;
}

/* Navigation Slide Status Styles */
.nav-slide {
  position: relative;
}

.nav-slide.completed {
  background: rgba(34, 197, 94, 0.05);
  border-left: 3px solid #22c55e;
}

.nav-slide.generating {
  background: rgba(245, 158, 11, 0.05);
  border-left: 3px solid #f59e0b;
}

.nav-slide.pending {
  background: transparent;
  border-left: 3px solid #9ca3af;
  opacity: 1;
}

/* Slide indicators container */
.slide-indicators {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
}

.slide-status-indicator {
  font-size: 0.75rem;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.audio-indicator {
  font-size: 0.75rem;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.completed-indicator {
  background: #22c55e;
  color: white;
  font-weight: bold;
}

.generating-indicator {
  background: white;
  color: #22c55e;
}

.pending-indicator {
  background: white;
  color: #666;
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .slide-controls {
    padding: 0.5rem !important;
    flex-direction: column !important;
    gap: 0.5rem !important;
    position: relative;
    z-index: 100;
  }

  .controls-left {
    order: 1;
    justify-content: center;
  }

  .controls-center {
    order: 2;
    justify-content: center;
  }

  .controls-right {
    order: 3;
    justify-content: center;
  }

  .controls-left, .controls-center, .controls-right {
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .control-btn, .nav-btn, .play-btn {
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    min-width: auto;
  }

  .fullscreen-btn {
    top: 10px;
    right: 10px;
    transform: none;
    padding: 0.4rem !important;
    font-size: 0.8rem;
    z-index: 350;
  }

  .slide-renderer {
    padding: 1rem;
    min-height: 300px;
  }

  .slide-content {
    padding: 1rem;
  }

  .nav-slide {
    padding: 0.6rem;
    min-height: 45px;
  }

  .nav-slide-number {
    width: 20px;
    height: 20px;
    font-size: 0.75rem;
  }

  .nav-slide-title {
    font-size: 0.75rem;
    line-height: 1.2;
  }

  .nav-slide-theme {
    font-size: 0.65rem;
  }

  .slide-indicators {
    top: 0.6rem;
    right: 0.6rem;
  }

  .audio-indicator {
    font-size: 0.65rem;
    width: 16px;
    height: 16px;
  }

  .slide-status-indicator {
    font-size: 0.65rem;
    width: 16px;
    height: 16px;
  }
}
</style>
