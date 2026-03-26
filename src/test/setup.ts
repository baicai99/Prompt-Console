import '@testing-library/jest-dom/vitest'
import '../index.css'

const ALLOWED_TEST_STDERR_PATTERNS = [
  /not wrapped in act/i,
  /invalid value for the `height` css style property/i,
  /could not parse css stylesheet/i,
]

const nativeConsoleError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  const message = args
    .map((item) => (typeof item === 'string' ? item : item instanceof Error ? item.message : ''))
    .join(' ')
  if (ALLOWED_TEST_STDERR_PATTERNS.some((pattern) => pattern.test(message))) {
    return
  }
  nativeConsoleError(...args)
}

if (!('__APP_VERSION__' in globalThis)) {
  Object.defineProperty(globalThis, '__APP_VERSION__', {
    value: 'test',
    configurable: true,
    writable: true,
  })
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).ResizeObserver = ResizeObserverMock
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

const nativeGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = ((elt: Element, pseudoElt?: string) => {
  if (pseudoElt) {
    return nativeGetComputedStyle(elt)
  }
  const styles = nativeGetComputedStyle(elt, pseudoElt)
  const fallbackPixelProps = new Set([
    'padding-top',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'margin-top',
    'margin-bottom',
    'margin-left',
    'margin-right',
    'border-top-width',
    'border-bottom-width',
    'border-left-width',
    'border-right-width',
    'height',
    'min-height',
    'max-height',
  ])

  return new Proxy(styles, {
    get(target, prop, receiver) {
      if (prop === 'getPropertyValue') {
        return (name: string) => {
          const value = target.getPropertyValue(name)
          if (value) {
            return value
          }
          if (name === '--message-list-top-clearance' && elt instanceof HTMLElement && elt.classList.contains('chat-body')) {
            return elt.classList.contains('chat-body-multi') ? '82px' : '104px'
          }
          return fallbackPixelProps.has(name) ? '0px' : value
        }
      }
      const value = Reflect.get(target, prop, receiver)
      if (typeof prop === 'string' && fallbackPixelProps.has(prop) && !value) {
        return '0px'
      }
      return value
    },
  })
}) as typeof window.getComputedStyle
