/**
 * Redondeo compartido para montos de dinero: 2 decimales, evitando el
 * ruido de coma flotante (ej. 1000 * 1.21 = 1210.0000000000002). El
 * patrón inline `Math.round(x*100)/100` estaba repetido por toda la app;
 * este es el lugar canónico para que no diverjan.
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
