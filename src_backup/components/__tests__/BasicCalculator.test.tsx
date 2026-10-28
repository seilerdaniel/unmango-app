import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BasicCalculator from '../BasicCalculator'

describe('BasicCalculator', () => {
  it('calcula 2 + 3 = 5', async () => {
    render(<BasicCalculator />)

    await userEvent.click(screen.getByTitle('Calculadora'))
    await userEvent.click(screen.getByRole('button', { name: '2' }))
    await userEvent.click(screen.getByRole('button', { name: '+' }))
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    await userEvent.click(screen.getByRole('button', { name: '=' }))

    expect(screen.getByTestId('calculator-display')).toHaveTextContent('5')
  })

  it('el botón C reinicia la pantalla a 0', async () => {
    render(<BasicCalculator />)

    await userEvent.click(screen.getByTitle('Calculadora'))
    await userEvent.click(screen.getByRole('button', { name: '7' }))
    await userEvent.click(screen.getByRole('button', { name: 'C' }))

    expect(screen.getByTestId('calculator-display')).toHaveTextContent('0')
  })
})
