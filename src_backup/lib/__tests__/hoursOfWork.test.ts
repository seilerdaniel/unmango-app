import { describe, it, expect } from 'vitest'
import { computeHoursOfWork } from '../hoursOfWork'

describe('computeHoursOfWork', () => {
  it('calcula las horas correctamente (valor hora simple)', () => {
    const result = computeHoursOfWork(18000, 160000, 160)
    expect(result?.hours).toBeCloseTo(18)
  })

  it('calcula las jornadas de 8 horas equivalentes', () => {
    const result = computeHoursOfWork(16000, 160000, 160)
    expect(result?.workDays).toBeCloseTo(2)
  })

  it('devuelve null si no hay ingreso configurado', () => {
    expect(computeHoursOfWork(1000, 0, 160)).toBeNull()
  })

  it('devuelve null si el monto es 0 o negativo', () => {
    expect(computeHoursOfWork(0, 160000, 160)).toBeNull()
    expect(computeHoursOfWork(-500, 160000, 160)).toBeNull()
  })
})
