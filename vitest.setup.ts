import '@testing-library/jest-dom/vitest'

// jsdom no implementa window.matchMedia. Lo mockeamos globalmente porque
// ThemeContext lo usa para detectar la preferencia de modo oscuro del
// sistema cuando no hay nada guardado en localStorage.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
