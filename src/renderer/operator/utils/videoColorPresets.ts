import { LayerColorCorrection } from '../../../shared/types'

export interface VideoColorPreset {
  id: string
  name: string
  shortName: string
  description: string
  tag: string
  accentColor: string
  settings: Required<Omit<LayerColorCorrection, 'preset'>>
}

export const VIDEO_COLOR_PRESETS: VideoColorPreset[] = [
  {
    id: 'anti_tungsten_strong',
    name: 'Anti-Amarillo Intenso (Altar / Focos Cálidos)',
    shortName: 'Anti-Amarillo Max',
    description: 'Especialmente calibrado para eliminar el tinte amarillo excesivo de los focos de escenario. Devuelve el blanco neutro a pantallas y cortinas, mejorando la nitidez de los predicadores.',
    tag: 'Recomendado',
    accentColor: '#38BDF8',
    settings: {
      temperature: -44, // Cooling down warm tungsten ~3200K -> 5600K
      tint: -5,
      contrast: 114,
      brightness: 97,
      saturation: 104
    }
  },
  {
    id: 'anti_tungsten_soft',
    name: 'Anti-Amarillo Suave (Balance Natural)',
    shortName: 'Anti-Amarillo Suave',
    description: 'Atenúa el exceso de amarillo manteniendo la calidez sutil y acogedora del templo sin enfriar demasiado la imagen.',
    tag: 'Equilibrado',
    accentColor: '#60A5FA',
    settings: {
      temperature: -24,
      tint: -3,
      contrast: 108,
      brightness: 99,
      saturation: 102
    }
  },
  {
    id: 'daylight_clean',
    name: 'Luz Día 5600K (Estudio Broadcast)',
    shortName: 'Luz Día 5600K',
    description: 'Balance de blancos neutro estilo televisión profesional. Colores puros, máxima fidelidad y gran claridad general.',
    tag: 'Estudio',
    accentColor: '#0EA5E9',
    settings: {
      temperature: -15,
      tint: 0,
      contrast: 106,
      brightness: 101,
      saturation: 105
    }
  },
  {
    id: 'portrait_preach',
    name: 'Rostros y Predicación (Tono de Piel)',
    shortName: 'Rostros & Piel',
    description: 'Elimina el halo amarillo de fondo y resalta la luminosidad y tono natural en la piel del orador en el púlpito.',
    tag: 'Predicación',
    accentColor: '#F59E0B',
    settings: {
      temperature: -18,
      tint: 4,
      contrast: 107,
      brightness: 103,
      saturation: 108
    }
  },
  {
    id: 'stage_vivid',
    name: 'Escenario Vivo (Alabanza y Músicos)',
    shortName: 'Escenario Vivo',
    description: 'Mayor contraste y saturación con negros profundos. Ideal para momentos de adoración, instrumentos y juego de luces dinámicas.',
    tag: 'Alabanza',
    accentColor: '#EC4899',
    settings: {
      temperature: -10,
      tint: 0,
      contrast: 118,
      brightness: 96,
      saturation: 116
    }
  },
  {
    id: 'cool_cinematic',
    name: 'Estudio Frío / Cinematográfico',
    shortName: 'Estudio Frío',
    description: 'Look moderno azulado/teal frío muy usado en producciones de streaming contemporáneas de alta fidelidad.',
    tag: 'Cine',
    accentColor: '#2DD4BF',
    settings: {
      temperature: -50,
      tint: -8,
      contrast: 115,
      brightness: 96,
      saturation: 96
    }
  },
  {
    id: 'warm_cozy',
    name: 'Calidez Agradable (Golden Hour)',
    shortName: 'Cálido Suave',
    description: 'Aporta calidez dorada y luminosidad acogedora si la cámara se encuentra en un ambiente frío o con fluorescentes pálidos.',
    tag: 'Cálido',
    accentColor: '#F97316',
    settings: {
      temperature: 25,
      tint: 2,
      contrast: 105,
      brightness: 101,
      saturation: 110
    }
  },
  {
    id: 'cinema_bw',
    name: 'Blanco y Negro Dramático',
    shortName: 'B&W Cine',
    description: 'Escala de grises pura con alto contraste y sombras marcadas para momentos de reflexión especial.',
    tag: 'Clásico',
    accentColor: '#9CA3AF',
    settings: {
      temperature: 0,
      tint: 0,
      contrast: 125,
      brightness: 100,
      saturation: 0
    }
  },
  {
    id: 'original',
    name: 'Original (Sin Filtro / Directo)',
    shortName: 'Original',
    description: 'Señal directa de la cámara sin ningún procesamiento ni corrección digital aplicada.',
    tag: 'Directo',
    accentColor: '#6B7280',
    settings: {
      temperature: 0,
      tint: 0,
      contrast: 100,
      brightness: 100,
      saturation: 100
    }
  }
]

/**
 * Converts a LayerColorCorrection object into a hardware-accelerated CSS filter string
 * that is 100% compatible with both DOM elements (style.filter) and Canvas 2D (ctx.filter).
 */
export function getColorCorrectionFilter(correction?: LayerColorCorrection | null): string {
  if (!correction) return 'none'

  const {
    temperature = 0,
    tint = 0,
    contrast = 100,
    brightness = 100,
    saturation = 100
  } = correction

  if (
    temperature === 0 &&
    tint === 0 &&
    contrast === 100 &&
    brightness === 100 &&
    saturation === 100
  ) {
    return 'none'
  }

  // Hue rotation derived from temperature (-100 to 100) and tint (-100 to 100):
  // Negative temperature rotates hue negative (countering yellow/orange towards neutral/cyan)
  // Tint balances the green-magenta axis
  const hueDeg = Math.round((temperature * 0.32) + (tint * 0.2))

  const parts: string[] = []
  if (brightness !== 100) {
    parts.push(`brightness(${(brightness / 100).toFixed(2)})`)
  }
  if (contrast !== 100) {
    parts.push(`contrast(${(contrast / 100).toFixed(2)})`)
  }
  if (saturation !== 100) {
    parts.push(`saturate(${(saturation / 100).toFixed(2)})`)
  }
  if (hueDeg !== 0) {
    parts.push(`hue-rotate(${hueDeg}deg)`)
  }

  return parts.length > 0 ? parts.join(' ') : 'none'
}
