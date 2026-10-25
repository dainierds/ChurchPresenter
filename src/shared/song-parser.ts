import {
  LayerBackground,
  SlideItem,
  Song,
  SongArrangement,
  SongGroup,
  SongGroupType
} from './types'

interface HeaderPattern {
  type: SongGroupType
  regex: RegExp
  defaultLabel: string
}

const HEADER_PATTERNS: HeaderPattern[] = [
  {
    type: 'pre_chorus',
    regex: /^(?:pre[- ]?coro|pre[- ]?chorus)(?:\s+(\d+))?/i,
    defaultLabel: 'Pre-Coro'
  },
  {
    type: 'chorus',
    regex: /^(?:coro|chorus)(?:\s+(\d+))?/i,
    defaultLabel: 'Coro'
  },
  {
    type: 'verse',
    regex: /^(?:verso|estrofa|verse|v)(?:\s+(\d+))?/i,
    defaultLabel: 'Verso'
  },
  {
    type: 'bridge',
    regex: /^(?:puente|bridge)(?:\s+(\d+))?/i,
    defaultLabel: 'Puente'
  },
  {
    type: 'ending',
    regex: /^(?:final|outro|ending)(?:\s+(\d+))?/i,
    defaultLabel: 'Final'
  },
  {
    type: 'intro',
    regex: /^(?:intro|introducci[oó]n)(?:\s+(\d+))?/i,
    defaultLabel: 'Intro'
  },
  {
    type: 'interlude',
    regex: /^(?:interludio|interlude)(?:\s+(\d+))?/i,
    defaultLabel: 'Interludio'
  }
]

export function parseHeaderLine(line: string): {
  type: SongGroupType
  number: number
  label: string
} | null {
  const cleanLine = line.trim().replace(/[[\]():]/g, '').trim()
  if (!cleanLine) return null

  for (const pattern of HEADER_PATTERNS) {
    const match = cleanLine.match(pattern.regex)
    if (match) {
      const num = match[1] ? parseInt(match[1], 10) : 1
      const label = num > 1 || pattern.type === 'verse' ? `${pattern.defaultLabel} ${num}` : pattern.defaultLabel
      return {
        type: pattern.type,
        number: num,
        label
      }
    }
  }

  return null
}

/**
 * Parses full song lyrics with headers into structured song groups.
 */
export function parseLyricsToGroups(rawText: string, songId: string = 'new-song'): SongGroup[] {
  const lines = rawText.split(/\r?\n/)
  const groups: SongGroup[] = []

  let currentType: SongGroupType = 'verse'
  let currentNumber: number = 1
  let currentLabel: string = 'Verso 1'
  let currentLines: string[] = []
  let sortOrder = 0

  const flushGroup = () => {
    const textContent = currentLines.join('\n').trim()
    if (textContent.length > 0) {
      groups.push({
        id: `grp_${songId}_${sortOrder + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        songId,
        groupType: currentType,
        groupNumber: currentNumber,
        label: currentLabel,
        content: textContent,
        sortOrder: sortOrder++
      })
    }
    currentLines = []
  }

  const typeCounters: Record<SongGroupType, number> = {
    verse: 0,
    chorus: 0,
    bridge: 0,
    pre_chorus: 0,
    ending: 0,
    intro: 0,
    interlude: 0
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headerInfo = parseHeaderLine(line)

    if (headerInfo) {
      flushGroup()
      currentType = headerInfo.type
      typeCounters[currentType]++
      currentNumber = headerInfo.number || typeCounters[currentType]
      currentLabel = headerInfo.label
    } else {
      currentLines.push(line)
    }
  }

  flushGroup()

  // If no headers were detected and only one group was created, default to Verso 1
  if (groups.length === 1 && groups[0].label === 'Verso 1' && groups[0].content.includes('\n\n')) {
    // If separated by double newlines, split by stanzas
    const stanzas = groups[0].content.split(/\n\s*\n/).filter((s) => s.trim().length > 0)
    if (stanzas.length > 1) {
      return stanzas.map((stanza, idx) => ({
        id: `grp_${songId}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
        songId,
        groupType: 'verse',
        groupNumber: idx + 1,
        label: `Verso ${idx + 1}`,
        content: stanza.trim(),
        sortOrder: idx
      }))
    }
  }

  return groups
}

/**
 * Splits a group's lyrics into slides based on lines per slide (e.g. 2, 4, 6 lines).
 */
export function splitGroupContentIntoSlides(
  group: SongGroup,
  linesPerSlide: number = 4,
  songTitle: string = ''
): SlideItem[] {
  const lines = group.content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return []

  const slides: SlideItem[] = []
  const effectiveLinesPerSlide = Math.max(1, linesPerSlide)
  const totalSlides = Math.ceil(lines.length / effectiveLinesPerSlide)

  for (let i = 0; i < lines.length; i += effectiveLinesPerSlide) {
    const chunk = lines.slice(i, i + effectiveLinesPerSlide)
    const slideIdx = Math.floor(i / effectiveLinesPerSlide)

    slides.push({
      id: `slide_${group.id}_${slideIdx + 1}`,
      sourceId: group.songId,
      sourceType: 'song',
      groupLabel: group.label,
      slideIndex: slideIdx + 1,
      totalSlidesInGroup: totalSlides,
      title: songTitle || group.label,
      body: chunk.join('\n'),
      subtitle: totalSlides > 1 ? `${group.label} (${slideIdx + 1}/${totalSlides})` : group.label
    })
  }

  return slides
}

/**
 * Generates all slides for a song according to the chosen arrangement.
 */
export function buildSlidesFromSong(
  song: Song,
  arrangementId?: string,
  background?: LayerBackground
): SlideItem[] {
  const groupsMap = new Map<string, SongGroup>()
  for (const g of song.groups) {
    groupsMap.set(g.id, g)
  }

  let arrangement: SongArrangement | undefined
  if (arrangementId) {
    arrangement = song.arrangements.find((a) => a.id === arrangementId)
  }
  if (!arrangement) {
    arrangement = song.arrangements.find((a) => a.isDefault) || song.arrangements[0]
  }

  const groupOrder: string[] = arrangement
    ? arrangement.groupIds
    : song.groups.map((g) => g.id)

  const slides: SlideItem[] = []
  const linesPerSlide = song.linesPerSlide || 4

  for (const groupId of groupOrder) {
    const group = groupsMap.get(groupId)
    if (!group) continue

    const groupSlides = splitGroupContentIntoSlides(group, linesPerSlide, song.title)
    for (const slide of groupSlides) {
      if (background) {
        slide.background = background
      }
      slides.push(slide)
    }
  }

  return slides
}
