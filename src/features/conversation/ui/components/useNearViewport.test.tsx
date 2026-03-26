import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { useNearViewport } from './useNearViewport'

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = []

  private readonly callback: IntersectionObserverCallback
  private target: Element | null = null

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    IntersectionObserverMock.instances.push(this)
  }

  observe(target: Element) {
    this.target = target
  }

  unobserve() {}

  disconnect() {}

  emit(entry: Partial<IntersectionObserverEntry>) {
    this.callback(
      [{
        isIntersecting: false,
        intersectionRatio: 0,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        target: this.target ?? document.createElement('div'),
        time: 0,
        ...entry,
      } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

function createRect(top: number, bottom: number, left = 0, right = 320): DOMRect {
  return {
    x: left,
    y: top,
    top,
    bottom,
    left,
    right,
    width: right - left,
    height: bottom - top,
    toJSON() {
      return {}
    },
  } as DOMRect
}

function NearViewportProbe() {
  const targetRef = useRef<HTMLDivElement | null>(null)
  const isNearViewport = useNearViewport({
    targetRef,
    rootMarginPx: 160,
  })

  return (
    <div className="message-list-viewport">
      <div ref={targetRef} data-testid="target">
        <span data-testid="state">{isNearViewport ? 'visible' : 'hidden'}</span>
      </div>
    </div>
  )
}

describe('useNearViewport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    IntersectionObserverMock.instances = []
  })

  it('marks already visible nodes as near viewport even before IntersectionObserver emits', async () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock as unknown as typeof IntersectionObserver)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function mockRect(this: Element) {
      const element = this as HTMLElement
      if (element.classList.contains('message-list-viewport')) {
        return createRect(0, 480)
      }
      if (element.dataset.testid === 'target') {
        return createRect(120, 260)
      }
      return createRect(800, 900)
    })

    render(<NearViewportProbe />)

    await waitFor(() => {
      expect(IntersectionObserverMock.instances).toHaveLength(1)
      expect(screen.getByTestId('state')).toHaveTextContent('visible')
    })
  })
})
