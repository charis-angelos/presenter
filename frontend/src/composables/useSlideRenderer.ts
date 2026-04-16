import { ref, nextTick } from 'vue'
import type { ComputedRef } from 'vue'
import { slidevProcessor } from '@/services/slidev'
import { logMarkdown } from '@/utils/markdownLogger'
import type { SlideContent } from '@/types/slides'

declare global {
  interface Window {
    mermaid: any
  }
}

/**
 * Handles compiling the current slide's markdown into HTML,
 * then initialising Mermaid diagrams and Chart.js charts in the DOM.
 */
export function useSlideRenderer(
  currentSlide: ComputedRef<SlideContent | null | undefined>,
  isCurrentSlideReady: ComputedRef<boolean>,
  currentSlideIndex: ComputedRef<number>
) {
  const compiledSlideHTML = ref('')

  const initializeMermaidDiagrams = async () => {
    if (!window.mermaid) {
      console.warn('Mermaid not available')
      return
    }

    try {
      const mermaidElements = document.querySelectorAll('.slide-renderer .mermaid')
      if (mermaidElements.length === 0) return

      mermaidElements.forEach((element, index) => {
        if (!element.id) {
          element.id = `mermaid-${Date.now()}-${index}`
        }
      })

      await window.mermaid.run()
    } catch (mermaidError) {
      console.warn('Mermaid rendering failed:', mermaidError)

      const failedElements = document.querySelectorAll('.slide-renderer .mermaid')
      failedElements.forEach((element) => {
        element.innerHTML = '<div class="mermaid-error">📊 図表の表示に失敗しました</div>'
        element.classList.remove('mermaid')
      })

      if (currentSlide.value?.markdown) {
        console.error('Original slide markdown:', currentSlide.value.markdown)
      }
    }
  }

  const initializeChartComponents = async () => {
    await nextTick()
    const chartPlaceholders = document.querySelectorAll('.chart-placeholder')

    chartPlaceholders.forEach(async (placeholder) => {
      try {
        const configStr = placeholder.getAttribute('data-chart-config')
        const chartId = placeholder.getAttribute('data-chart-id')

        if (configStr && chartId) {
          const chartConfig = JSON.parse(configStr)

          const canvas = document.createElement('canvas')
          canvas.id = chartId
          canvas.width = 400
          canvas.height = 300
          placeholder.appendChild(canvas)

          const { Chart, registerables } = await import('chart.js')
          Chart.register(...registerables)

          new Chart(canvas, {
            ...chartConfig,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top' as const },
                title: {
                  display: !!chartConfig.options?.plugins?.title?.text,
                  text: chartConfig.options?.plugins?.title?.text || '',
                },
              },
              ...chartConfig.options,
            },
          })
        }
      } catch (error) {
        console.error('Failed to create chart:', error)
        placeholder.innerHTML = '<p>チャートの表示に失敗しました</p>'
      }
    })
  }

  const compileCurrentSlide = async () => {
    if (!currentSlide.value || !isCurrentSlideReady.value) {
      compiledSlideHTML.value = ''
      return
    }

    try {
      if (currentSlide.value.markdown) {
        logMarkdown(currentSlide.value.markdown, currentSlideIndex.value, currentSlide.value.title)
      }

      if (currentSlide.value.html && currentSlide.value.html.trim() !== '') {
        compiledSlideHTML.value = currentSlide.value.html
      } else if (currentSlide.value.markdown && currentSlide.value.markdown.trim() !== '') {
        const processedSlideData = await slidevProcessor.processSlide(currentSlide.value)
        compiledSlideHTML.value = slidevProcessor.convertToHTML(processedSlideData)
      } else {
        compiledSlideHTML.value = '<p>スライド内容が見つかりません</p>'
      }

      await nextTick()
      await initializeMermaidDiagrams()
      initializeChartComponents()
    } catch (error) {
      console.error('Failed to compile slide:', error)
      compiledSlideHTML.value = '<p>スライドの表示に失敗しました</p>'
    }
  }

  return { compiledSlideHTML, compileCurrentSlide }
}
