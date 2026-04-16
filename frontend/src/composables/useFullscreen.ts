import { ref, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

/**
 * Manages fullscreen state for a container element.
 * Registers the fullscreenchange event listener during the component lifecycle
 * and keeps `isFullscreen` in sync with the actual browser state.
 */
export function useFullscreen(container: Ref<HTMLElement | undefined>) {
  const isFullscreen = ref(false)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      container.value?.requestFullscreen()
      isFullscreen.value = true
    } else {
      document.exitFullscreen()
      isFullscreen.value = false
    }
  }

  const onFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  })

  return { isFullscreen, toggleFullscreen }
}
