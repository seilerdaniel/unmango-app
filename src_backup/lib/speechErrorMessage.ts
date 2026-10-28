/**
 * Traduce los códigos de error de la Web Speech API
 * (SpeechRecognitionErrorEvent.error) a mensajes en español que tienen
 * sentido para quien está usando la app — los códigos nativos son en
 * inglés y no dicen qué hacer al respecto.
 */
export function speechErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'permission-denied':
      return 'No pudimos acceder al micrófono. Revisá los permisos del navegador para este sitio.'
    case 'no-speech':
      return 'No se detectó ninguna voz. Probá de nuevo, hablando después de tocar el micrófono.'
    case 'audio-capture':
      return 'No se encontró ningún micrófono disponible en este dispositivo.'
    case 'network':
      return 'El reconocimiento de voz necesita conexión a internet — revisá tu señal.'
    case 'aborted':
      return '' // el usuario lo canceló a propósito (tocó "parar"), no hace falta mostrar nada
    default:
      return 'No pudimos entender el audio. Probá de nuevo, o escribí la frase a mano.'
  }
}
