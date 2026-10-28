/**
 * Redirige a la URL de checkout de Mercado Pago (init_point) en la misma
 * pestaña. Separado del componente para que los tests lo mockeen fácil
 * (jsdom no permite espiar window.location.assign).
 */
export function redirectToCheckout(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.assign(url)
  }
}
