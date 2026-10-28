import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { useAsyncData } from '../useAsyncData'

describe('useAsyncData', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('arranca en loading y pasa a data cuando el loader resuelve', async () => {
    const loader = vi.fn(async () => ({ total: 42 }))
    const { result } = renderHook(() => useAsyncData(loader, 'Error'))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ total: 42 })
    expect(result.current.error).toBeNull()
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('un loader que devuelve null deja data en null sin error', async () => {
    const loader = vi.fn(async () => null)
    const { result } = renderHook(() => useAsyncData(loader, 'Error'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('setea el mensaje de error si el loader falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loader = vi.fn(async () => {
      throw new Error('boom')
    })
    const { result } = renderHook(() => useAsyncData(loader, 'Mensaje de error'))

    await waitFor(() => expect(result.current.error).toBe('Mensaje de error'))
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    consoleSpy.mockRestore()
  })

  it('refetch vuelve a correr el loader en background sin re-encender loading', async () => {
    let call = 0
    const loader = vi.fn(async () => ({ n: ++call }))
    const { result } = renderHook(() => useAsyncData(loader, 'Error'))

    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }))

    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.data).toEqual({ n: 2 })
    expect(result.current.loading).toBe(false)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('vuelve a cargar automáticamente cuando cambia el loader', async () => {
    const first = vi.fn(async () => 'primero')
    const second = vi.fn(async () => 'segundo')
    const { result, rerender } = renderHook(({ l }: { l: () => Promise<string | null> }) => useAsyncData(l, 'Error'), {
      initialProps: { l: first },
    })

    await waitFor(() => expect(result.current.data).toBe('primero'))

    rerender({ l: second })
    await waitFor(() => expect(result.current.data).toBe('segundo'))
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('en un error conserva los datos previos y no los vacía', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldFail = false
    const loader = vi.fn(async () => {
      if (shouldFail) throw new Error('boom')
      return 'datos'
    })
    const { result } = renderHook(() => useAsyncData(loader, 'Error'))

    await waitFor(() => expect(result.current.data).toBe('datos'))

    shouldFail = true
    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.data).toBe('datos')
    expect(result.current.error).toBe('Error')
    consoleSpy.mockRestore()
  })
})
