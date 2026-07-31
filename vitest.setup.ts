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

// jsdom no implementa Element.prototype.scrollIntoView en absoluto (a
// diferencia de window.scrollTo, que existe pero solo tira un warning
// de "not implemented"). Varios componentes lo usan para desplazar
// hasta su propia tarjeta al editar un ítem — en navegadores reales es
// una API estándar bien soportada, esto es solo para que los tests no
// exploten al no encontrar la función.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
