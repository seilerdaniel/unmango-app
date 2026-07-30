import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BottomNav from '../BottomNav'

describe('BottomNav', () => {
  it('muestra las 4 pestañas', () => {
    render(<BottomNav activeTab="inicio" onChange={() => {}} />)
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Análisis')).toBeInTheDocument()
    expect(screen.getByText('Planes')).toBeInTheDocument()
    expect(screen.getByText('Historial')).toBeInTheDocument()
  })

  it('llama a onChange con el id correcto al tocar una pestaña', async () => {
    const onChange = vi.fn()
    render(<BottomNav activeTab="inicio" onChange={onChange} />)

    await userEvent.click(screen.getByText('Planes'))
    expect(onChange).toHaveBeenCalledWith('planes')
  })

  it('no rompe si se toca la pestaña ya activa', async () => {
    const onChange = vi.fn()
    render(<BottomNav activeTab="historial" onChange={onChange} />)

    await userEvent.click(screen.getByText('Historial'))
    expect(onChange).toHaveBeenCalledWith('historial')
  })
})
