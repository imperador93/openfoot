import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  fetchLeague,
  getLineup,
  getCareerSnapshot,
  getPlayerEnergies,
  saveLineup,
  simulateCareerRound,
  advanceToNextSeason,
  type CareerSnapshot,
  type MatchEvent,
  type RoundMatch,
  type SavedLineup,
  type SimulateRoundResult,
  type SlotZone as ApiSlotZone,
  type SquadPlayer,
} from '@/libs/tauri/career'
import { saveCareer } from '@/libs/tauri/saves'
import Calendar from '@/pages/Calendar'

type TabKey = 'partida' | 'escalacao' | 'calendario'
type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '5-3-2' | '4-5-1' | '3-4-3'
type PlayStyle =
  | 'Pressing Alto'
  | 'Posse de Bola'
  | 'Contra-ataque'
  | 'Bola Direta'
  | 'Jogo Aereo'
  | 'Retranca'
type SpeedKey = 'devagar' | 'normal' | 'rapido' | 'instantaneo'
type LiveState = 'idle' | 'running' | 'paused' | 'done'
type SquadStatus = 'Titular' | 'Reserva'

type SquadRow = SquadPlayer & {
  status: SquadStatus
}

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-5-1', '3-4-3']
const PLAY_STYLES: PlayStyle[] = [
  'Pressing Alto',
  'Posse de Bola',
  'Contra-ataque',
  'Bola Direta',
  'Jogo Aereo',
  'Retranca',
]
const SPEED_LABELS: Record<SpeedKey, string> = {
  devagar: 'Devagar',
  normal: 'Normal',
  rapido: 'Rapido',
  instantaneo: 'Instantaneo',
}
const SPEED_DELAYS: Record<SpeedKey, number> = {
  devagar: 150,
  normal: 60,
  rapido: 20,
  instantaneo: 0,
}

const EVENT_STYLES: Record<string, { label: string; cls: string }> = {
  goal: { label: 'GOL', cls: 'bg-primary text-primary-content' },
  nearMiss: { label: 'Chute', cls: 'bg-warning/30 text-warning-content' },
  save: { label: 'Defendido', cls: 'bg-info/30 text-info-content' },
  foul: { label: 'Falta', cls: 'bg-base-300 text-base-content' },
  yellowCard: { label: 'Amarelo 🟨', cls: 'bg-yellow-500/30 text-yellow-200' },
  redCard: { label: 'Vermelho 🟥', cls: 'bg-red-500/30 text-red-200' },
  corner: { label: 'Escanteio ⚐', cls: 'bg-accent/30 text-accent-content' },
}

type MenuItem = {
  key: TabKey | null
  label: string
  icon: string
  comingSoon?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'partida', label: 'Partida', icon: '▶' },
  { key: 'escalacao', label: 'Elenco', icon: '👥' },
  { key: 'calendario', label: 'Calendario', icon: '📅' },
  { key: null, label: 'Salvar Jogo', icon: '💾' },
  { key: null, label: 'Transferencias', icon: '💸', comingSoon: true },
  { key: null, label: 'Departamentos', icon: '🏢', comingSoon: true },
  { key: null, label: 'Estatisticas', icon: '📊', comingSoon: true },
]

const abbrevName = (name: string) => {
  const parts = name.trim().split(' ')
  if (parts.length <= 1) return name
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

const computeOvr = (player: SquadPlayer) => {
  const total =
    player.speed +
    player.shooting +
    player.passing +
    player.dribbling +
    player.defense +
    player.stamina
  return Math.round(total / 6)
}

const normalizePosition = (position: string) => position.trim().toUpperCase()

type SlotZone = 'GOL' | 'DEF' | 'MEI' | 'ATA'

type FieldSlot = {
  zone: SlotZone
  playerId: string | null
}

type BenchSlot = {
  playerId: string | null
}

type RecentSubstitution = {
  slotIdx: number
  zone: SlotZone
  outPlayerName: string
  inPlayerName: string
  minute: number
}

const ZONE_POSITIONS: Record<SlotZone, string[]> = {
  GOL: ['GOL', 'GK', 'GOALKEEPER', 'GOLEIRO'],
  DEF: ['ZAG', 'LAT_E', 'LAT_D', 'DF', 'DEFENDER', 'SB', 'SIDE_BACK', 'ZAGUEIRO', 'LATERAL'],
  MEI: ['VOL', 'MEI', 'MEI_A', 'MF', 'MIDFIELDER', 'MEIO', 'MEIA'],
  ATA: ['ATA', 'SA', 'PNT_E', 'PNT_D', 'FW', 'FORWARD', 'ATACANTE'],
}

const isPositionInZone = (zone: SlotZone, position: string) =>
  ZONE_POSITIONS[zone].includes(normalizePosition(position))

const isGoalkeeperPosition = (position: string) => isPositionInZone('GOL', position)

const classifyOutfieldLine = (position: string): 'DEF' | 'MEI' | 'ATA' | null => {
  if (isPositionInZone('DEF', position)) return 'DEF'
  if (isPositionInZone('MEI', position)) return 'MEI'
  if (isPositionInZone('ATA', position)) return 'ATA'
  return null
}

const OUTFIELD_FALLBACK: Record<Exclude<SlotZone, 'GOL'>, Array<'DEF' | 'MEI' | 'ATA'>> = {
  DEF: ['DEF', 'MEI', 'ATA'],
  MEI: ['MEI', 'DEF', 'ATA'],
  ATA: ['ATA', 'MEI', 'DEF'],
}

const FORMATION_SLOTS: Record<Formation, SlotZone[]> = {
  '4-4-2': ['GOL', 'DEF', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA'],
  '4-3-3': ['GOL', 'DEF', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA'],
  '3-5-2': ['GOL', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA'],
  '5-3-2': ['GOL', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA'],
  '4-5-1': ['GOL', 'DEF', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'MEI', 'MEI', 'ATA'],
  '3-4-3': ['GOL', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA'],
}

const BENCH_SLOT_COUNT = 7

const emptyBenchSlots = (): BenchSlot[] =>
  Array.from({ length: BENCH_SLOT_COUNT }, () => ({ playerId: null }))

const buildBenchSlotsWithIds = (ids: string[]): BenchSlot[] =>
  Array.from({ length: BENCH_SLOT_COUNT }, (_, i) => ({
    playerId: ids[i] ?? null,
  }))

const buildSlotsWithLineup = (formation: Formation, lineupIds: string[]): FieldSlot[] =>
  FORMATION_SLOTS[formation].map((zone, i) => ({
    zone,
    playerId: lineupIds[i] ?? null,
  }))

const buildSlotsWithSavedLineup = (formation: Formation, saved: SavedLineup): FieldSlot[] => {
  const next = buildSlotsWithLineup(formation, [])
  for (const starter of saved.starters) {
    const idx = starter.slotIndex
    if (idx < 0 || idx >= next.length) continue
    next[idx] = {
      ...next[idx],
      playerId: starter.playerId,
    }
  }
  return next
}

const Career = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('partida')
  const [snapshot, setSnapshot] = useState<CareerSnapshot | null>(null)
  const [lastRoundMatches, setLastRoundMatches] = useState<RoundMatch[]>([])
  const [squad, setSquad] = useState<SquadRow[]>([])
  const [formation, setFormation] = useState<Formation>('4-4-2')
  const [playStyle, setPlayStyle] = useState<PlayStyle>('Pressing Alto')
  const [simSpeed, setSimSpeed] = useState<SpeedKey>('normal')
  const [liveState, setLiveState] = useState<LiveState>('idle')
  const [liveMinute, setLiveMinute] = useState(0)
  const [expandedMatchKey, setExpandedMatchKey] = useState<string | null>(null)
  const [liveHomeGoals, setLiveHomeGoals] = useState(0)
  const [liveAwayGoals, setLiveAwayGoals] = useState(0)
  const [liveEvents, setLiveEvents] = useState<MatchEvent[]>([])
  const [bgEvents, setBgEvents] = useState<Array<{
    minute: number
    homeTeamName: string
    awayTeamName: string
    homeGoals: number
    awayGoals: number
  }>>([])
  const [focusMatch, setFocusMatch] = useState<RoundMatch | null>(null)
  const [playedRound, setPlayedRound] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Carregando carreira...')
  const [slots, setSlots] = useState<FieldSlot[]>(() => buildSlotsWithLineup('4-4-2', []))
  const [savedSlots, setSavedSlots] = useState<FieldSlot[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null)
  const [dragSource, setDragSource] = useState<{ type: 'slot' | 'bench' | 'list'; idx: number; playerId: string } | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [subsUsed, setSubsUsed] = useState(0)
  const [subWindowsUsed, setSubWindowsUsed] = useState(0)
  const [subsInCurrentPause, setSubsInCurrentPause] = useState(0)
  const [subOutSlotIdx, setSubOutSlotIdx] = useState<number | null>(null)
  const [subInPlayerId, setSubInPlayerId] = useState('')
  const [recentSubstitution, setRecentSubstitution] = useState<RecentSubstitution | null>(null)
  const [benchSlots, setBenchSlots] = useState<BenchSlot[]>(() => emptyBenchSlots())
  const [playerEnergies, setPlayerEnergies] = useState<Record<string, number>>({})
  const [filterPosition, setFilterPosition] = useState<string>('all')
  const [filterEnergy, setFilterEnergy] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [dismissedAfterMatch, setDismissedAfterMatch] = useState(false)

  const pendingResult = useRef<SimulateRoundResult | null>(null)
  const justDroppedRef = useRef(false)
  const slotRefs = useRef<Map<number, HTMLElement>>(new Map())
  const benchRefs = useRef<Map<number, HTMLElement>>(new Map())

  const titularesCount = useMemo(
    () => slots.filter((slot) => slot.playerId !== null).length,
    [slots]
  )

  const slotsByZone = useMemo(() => {
    const zoneOrder: SlotZone[] = ['ATA', 'MEI', 'DEF', 'GOL']
    return zoneOrder.map((zone) => ({
      zone,
      entries: slots
        .map((slot, idx) => ({ slot, idx }))
        .filter(({ slot }) => slot.zone === zone),
    }))
  }, [slots])



  useEffect(() => {
    const loadCareer = async () => {
      setBusy(true)

      try {
        const cached = await getCareerSnapshot()
        setSnapshot(cached)

        const league = await fetchLeague(cached.leagueId)
        const playerTeam = league.teams.find((team) => team.id === cached.playerTeamId)

        if (playerTeam) {
          const savedLineup = await getLineup().catch(() => ({
            starters: [],
            bench: [],
          }))
          const loadedSlots = buildSlotsWithSavedLineup(formation, savedLineup)
          const orderedSquad = [...playerTeam.squad]
            .map((player) => ({ ...player, status: 'Reserva' as SquadStatus }))
            .sort((a, b) => computeOvr(b) - computeOvr(a))
          const starterIds = new Set(
            loadedSlots
              .map((slot) => slot.playerId)
              .filter((id): id is string => id !== null)
          )
          const benchFromSave = savedLineup.bench
            .filter((id) => !starterIds.has(id))

          setSquad(orderedSquad)
          setSlots(loadedSlots)
          setSavedSlots(loadedSlots.map((slot) => ({ ...slot })))
          setBenchSlots(buildBenchSlotsWithIds(benchFromSave))
          setIsDirty(false)

          const energies = await getPlayerEnergies().catch(() => ({}))
          setPlayerEnergies(energies)
        }

        setStatus(`Carreira carregada: rodada ${cached.currentRound}/${cached.totalRounds}`)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Nenhuma carreira ativa')
      } finally {
        setBusy(false)
      }
    }

    void loadCareer()
  }, [])

  // Recarregar lineup quando trocar de time (transferência ou load de save)
  useEffect(() => {
    if (!snapshot) return

    const reloadLineupForNewTeam = async () => {
      try {
        const league = await fetchLeague(snapshot.leagueId)
        const playerTeam = league.teams.find((team) => team.id === snapshot.playerTeamId)

        if (playerTeam) {
          const savedLineup = await getLineup().catch(() => ({
            starters: [],
            bench: [],
          }))
          const loadedSlots = buildSlotsWithSavedLineup(formation, savedLineup)
          const orderedSquad = [...playerTeam.squad]
            .map((player) => ({ ...player, status: 'Reserva' as SquadStatus }))
            .sort((a, b) => computeOvr(b) - computeOvr(a))
          const starterIds = new Set(
            loadedSlots
              .map((slot) => slot.playerId)
              .filter((id): id is string => id !== null)
          )
          const benchFromSave = savedLineup.bench
            .filter((id) => !starterIds.has(id))

          setSquad(orderedSquad)
          setSlots(loadedSlots)
          setSavedSlots(loadedSlots.map((slot) => ({ ...slot })))
          setBenchSlots(buildBenchSlotsWithIds(benchFromSave))
          setIsDirty(false)

          const energies = await getPlayerEnergies().catch(() => ({}))
          setPlayerEnergies(energies)
        }
      } catch (error) {
        console.error('Erro ao recarregar lineup:', error)
      }
    }

    void reloadLineupForNewTeam()
  }, [snapshot?.playerTeamId, formation])

  useEffect(() => {
    if (liveState !== 'running') return

    if (liveMinute >= 90) {
      setLiveState('done')
      return
    }

    // Pausa automática no intervalo (45')
    if (liveMinute === 45) {
      setLiveState('paused')
      setStatus('Intervalo - ajuste tatica e escalacao.')
      return
    }

    const timer = setTimeout(() => {
      setLiveMinute((current) => current + 1)
    }, SPEED_DELAYS[simSpeed])

    return () => clearTimeout(timer)
  }, [liveMinute, liveState, simSpeed])

  // Verificar demissão APÓS a partida terminar
  useEffect(() => {
    if (liveState === 'done' && dismissedAfterMatch && snapshot) {
      // Pequeno delay para o usuário ver o resultado antes da mensagem
      const timer = setTimeout(() => {
        alert(`Você foi DEMITIDO! Sua moral caiu para ${snapshot.morale}% e a diretoria perdeu a confiança no seu trabalho.`)
        navigate('/coach-transfer', { replace: true })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [liveState, dismissedAfterMatch, snapshot, navigate])

  useEffect(() => {
    if (liveState !== 'running' || !focusMatch) return

    const minuteEvents = focusMatch.events.filter((event) => event.minute === liveMinute)
    if (minuteEvents.length === 0) return

    setLiveEvents((current) => [...current, ...minuteEvents])

    const homeGoals = minuteEvents.filter(
      (event) => event.eventType === 'goal' && event.teamSide === 'home'
    ).length
    const awayGoals = minuteEvents.filter(
      (event) => event.eventType === 'goal' && event.teamSide === 'away'
    ).length

    if (homeGoals > 0) {
      setLiveHomeGoals((current) => current + homeGoals)
    }
    if (awayGoals > 0) {
      setLiveAwayGoals((current) => current + awayGoals)
    }
  }, [focusMatch, liveMinute, liveState])

  useEffect(() => {
    if (liveState !== 'done') return

    const result = pendingResult.current
    if (!result) return

    setSnapshot(result.snapshot)
    setLastRoundMatches(result.matches)
    setSlots(savedSlots.map((slot) => ({ ...slot })))
    setSubsUsed(0)
    setSubWindowsUsed(0)
    setSubsInCurrentPause(0)
    setSubOutSlotIdx(null)
    setSubInPlayerId('')
    setRecentSubstitution(null)
    setIsDirty(false)
    if (result.playerEnergyAfter) setPlayerEnergies(result.playerEnergyAfter)
    setStatus(`Rodada ${result.playedRound} concluida.`)
    setBusy(false)
    pendingResult.current = null
  }, [liveState, savedSlots])

  useEffect(() => {
    if (!recentSubstitution) return

    const timer = setTimeout(() => {
      setRecentSubstitution(null)
    }, 2800)

    return () => clearTimeout(timer)
  }, [recentSubstitution])

  useEffect(() => {
    const titularIds = new Set(slots.map((slot) => slot.playerId).filter((id): id is string => id !== null))
    const squadIds = new Set(squad.map((player) => player.id))

    setBenchSlots((current) => {
      const used = new Set<string>()
      const sanitizedIds = current
        .map((slot) => slot.playerId)
        .filter((id): id is string => {
          if (!id) return false
          if (!squadIds.has(id) || titularIds.has(id) || used.has(id)) return false
          used.add(id)
          return true
        })

      return buildBenchSlotsWithIds(sanitizedIds)
    })
  }, [slots, squad])

  const skipLive = () => {
    if (!focusMatch) return

    setLiveEvents(focusMatch.events)
    setLiveHomeGoals(focusMatch.homeGoals)
    setLiveAwayGoals(focusMatch.awayGoals)
    setLiveMinute(90)
    setLiveState('done')
  }

  const pauseLive = async () => {
    if (liveState !== 'running') return
    setLiveState('paused')
    setSubsInCurrentPause(0)
    setStatus('Partida pausada. Ajuste tatica e escalacao e retome quando quiser.')
    
    // Atualiza as energias dos jogadores em tempo real
    try {
      const energies = await getPlayerEnergies()
      setPlayerEnergies(energies)
    } catch (error) {
      console.warn('Erro ao atualizar energias:', error)
    }
  }

  const resumeLive = () => {
    if (liveState !== 'paused') return

    const intervalPause = liveMinute >= 45 && liveMinute < 46
    if (subsInCurrentPause > 0 && !intervalPause) {
      setSubWindowsUsed((v) => v + 1)
    }

    // Se está no intervalo (minuto 45), avança para 46 ao retomar
    if (liveMinute === 45) {
      setLiveMinute(46)
    }

    setSubsInCurrentPause(0)
    setLiveState('running')
    setStatus(`Rodada ${playedRound} em andamento...`)
  }

  const applySubstitution = () => {
    // Substituição rápida durante a partida (sem pausar)
    const intervalPause = liveMinute >= 45 && liveMinute < 46
    const needsNewWindow = subsInCurrentPause === 0

    if (subsUsed >= 5) {
      setStatus('Limite atingido: maximo de 5 substituicoes.')
      return
    }

    if (!intervalPause && needsNewWindow && subWindowsUsed >= 3) {
      setStatus('Limite atingido: maximo de 3 janelas de substituicao.')
      return
    }

    if (subOutSlotIdx === null || !subInPlayerId) {
      setStatus('Selecione quem sai e quem entra.')
      return
    }

    const outPlayerId = slots[subOutSlotIdx]?.playerId
    if (!outPlayerId) {
      setStatus('O slot selecionado para sair esta vazio.')
      return
    }

    const outPlayer = squad.find((p) => p.id === outPlayerId)
    const inPlayer = squad.find((p) => p.id === subInPlayerId)

    if (!benchSelectionIds.includes(subInPlayerId)) {
      setStatus('Esse atleta nao esta elegivel no banco de reservas.')
      return
    }

    const inAlreadyPlaying = slots.some((slot) => slot.playerId === subInPlayerId)
    if (inAlreadyPlaying) {
      setStatus('Jogador escolhido para entrar ja esta em campo.')
      return
    }

    setSlots((curr) => curr.map((slot, idx) => (
      idx === subOutSlotIdx ? { ...slot, playerId: subInPlayerId } : slot
    )))
    setSubsUsed((v) => v + 1)
    setSubsInCurrentPause((v) => v + 1)
    setRecentSubstitution({
      slotIdx: subOutSlotIdx,
      zone: slots[subOutSlotIdx].zone,
      outPlayerName: outPlayer?.name ?? 'Saiu',
      inPlayerName: inPlayer?.name ?? 'Entrou',
      minute: liveMinute,
    })
    setSubOutSlotIdx(null)
    setSubInPlayerId('')
    
    // Incrementa janela se necessário
    if (!intervalPause && needsNewWindow) {
      setSubWindowsUsed((v) => v + 1)
    }
    
    const nextWindowCount = !intervalPause && needsNewWindow ? subWindowsUsed + 1 : subWindowsUsed
    setStatus(`Substituicao feita (${subsUsed + 1}/5 atletas, ${nextWindowCount}/3 janelas).`)
  }

  const handleInMatchSubstitution = () => {
    if (liveState !== 'paused') return

    const intervalPause = liveMinute >= 45 && liveMinute < 46
    const needsNewWindow = subsInCurrentPause === 0

    if (subsUsed >= 5) {
      setStatus('Limite atingido: maximo de 5 substituicoes.')
      return
    }

    if (!intervalPause && needsNewWindow && subWindowsUsed >= 3) {
      setStatus('Limite atingido: maximo de 3 janelas de substituicao.')
      return
    }

    if (subOutSlotIdx === null || !subInPlayerId) {
      setStatus('Selecione quem sai e quem entra.')
      return
    }

    if (!benchSelectionIds.includes(subInPlayerId)) {
      setStatus('Esse atleta nao esta elegivel no banco de reservas.')
      return
    }

    const outPlayerId = slots[subOutSlotIdx]?.playerId
    if (!outPlayerId) {
      setStatus('O slot selecionado para sair esta vazio.')
      return
    }

    const outPlayer = squad.find((p) => p.id === outPlayerId)
    const inPlayer = squad.find((p) => p.id === subInPlayerId)

    const inAlreadyPlaying = slots.some((slot) => slot.playerId === subInPlayerId)
    if (inAlreadyPlaying) {
      setStatus('Jogador escolhido para entrar ja esta em campo.')
      return
    }

    setSlots((curr) => curr.map((slot, idx) => (
      idx === subOutSlotIdx ? { ...slot, playerId: subInPlayerId } : slot
    )))
    setSubsUsed((v) => v + 1)
    setSubsInCurrentPause((v) => v + 1)
    setRecentSubstitution({
      slotIdx: subOutSlotIdx,
      zone: slots[subOutSlotIdx].zone,
      outPlayerName: outPlayer?.name ?? 'Saiu',
      inPlayerName: inPlayer?.name ?? 'Entrou',
      minute: liveMinute,
    })
    setSubOutSlotIdx(null)
    setSubInPlayerId('')
    const nextWindowCount = !intervalPause && needsNewWindow ? subWindowsUsed + 1 : subWindowsUsed
    setStatus(`Substituicao feita (${subsUsed + 1}/5 atletas, ${nextWindowCount}/3 janelas).`)
  }

  const applyBenchDrop = (targetIdx: number, playerId: string | null) => {
    if (!playerId) return
    if (!squad.some((player) => player.id === playerId)) return

    setSlots((curr) =>
      curr.map((slot) =>
        slot.playerId === playerId ? { ...slot, playerId: null } : slot
      )
    )

    setBenchSlots((curr) => {
      const next = curr.map((slot) => ({ ...slot }))
      for (let i = 0; i < next.length; i += 1) {
        if (next[i].playerId === playerId) {
          next[i].playerId = null
        }
      }
      next[targetIdx] = { playerId }
      return next
    })
  }

  const handleAutoLineup = () => {
    const remaining = [...squad].sort((a, b) => computeOvr(b) - computeOvr(a))
    const picked = new Set<string>()

    const pickBest = (candidates: SquadRow[]) => {
      if (candidates.length === 0) return null
      const best = [...candidates].sort((a, b) => computeOvr(b) - computeOvr(a))[0]
      picked.add(best.id)
      return best
    }

    const nextSlots = FORMATION_SLOTS[formation].map((zone) => {
      let chosen: SquadRow | null = null

      if (zone === 'GOL') {
        chosen = pickBest(remaining.filter((player) => !picked.has(player.id) && isGoalkeeperPosition(player.position)))
      } else {
        for (const line of OUTFIELD_FALLBACK[zone]) {
          const candidates = remaining.filter((player) => {
            if (picked.has(player.id) || isGoalkeeperPosition(player.position)) return false
            return classifyOutfieldLine(player.position) === line
          })
          chosen = pickBest(candidates)
          if (chosen) break
        }

        if (!chosen) {
          chosen = pickBest(
            remaining.filter((player) => !picked.has(player.id) && !isGoalkeeperPosition(player.position))
          )
        }
      }

      return { zone, playerId: chosen?.id ?? null }
    })

    const hasGoalkeeper = nextSlots.some((slot) => slot.zone === 'GOL' && slot.playerId !== null)
    const starters = new Set(nextSlots.map((slot) => slot.playerId).filter((id): id is string => id !== null))
    const reservePool = squad
      .filter((player) => !starters.has(player.id))
      .sort((a, b) => computeOvr(b) - computeOvr(a))

    const reserveIds: string[] = []

    const reserveGoalkeeper = reservePool.find((player) => isGoalkeeperPosition(player.position))
    if (reserveGoalkeeper) {
      reserveIds.push(reserveGoalkeeper.id)
    }

    const outfieldReserves = reservePool
      .filter((player) => !isGoalkeeperPosition(player.position) && !reserveIds.includes(player.id))
      .slice(0, 7 - reserveIds.length)
      .map((player) => player.id)

    reserveIds.push(...outfieldReserves)

    if (reserveIds.length < 7) {
      const remainingAny = reservePool
        .filter((player) => !reserveIds.includes(player.id))
        .slice(0, 7 - reserveIds.length)
        .map((player) => player.id)
      reserveIds.push(...remainingAny)
    }

    setSlots(nextSlots)
    setSelectedSlotIdx(null)
    setSubOutSlotIdx(null)
    setSubInPlayerId('')
    setBenchSlots(buildBenchSlotsWithIds(reserveIds))

    if (!hasGoalkeeper) {
      setStatus(`Escalacao automatica aplicada (titulares + banco ${reserveIds.length}/7). Sem goleiro no elenco: preencha manualmente o slot GOL.`)
      return
    }

    setStatus(`Escalacao automatica aplicada: titulares definidos e banco preenchido (${reserveIds.length}/7).`)
  }

  const handleClearLineup = () => {
    setSlots(buildSlotsWithLineup(formation, []))
    setSelectedSlotIdx(null)
    setSubOutSlotIdx(null)
    setSubInPlayerId('')
    setBenchSlots(emptyBenchSlots())
    setStatus('Elenco limpo. Titulares e banco foram esvaziados.')
  }

  const handleSaveLineup = async () => {
    const titularIds = slots
      .map((slot) => slot.playerId)
      .filter((id): id is string => id !== null)
    const starterSet = new Set(titularIds)
    const reserveIds = benchSlots
      .map((slot) => slot.playerId)
      .filter((id): id is string => id !== null && !starterSet.has(id))
    const startersPayload = slots
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot }) => slot.playerId !== null)
      .map(({ slot, idx }) => ({
        playerId: slot.playerId as string,
        slotZone: slot.zone as ApiSlotZone,
        slotIndex: idx,
      }))

    const lineupToSave: SavedLineup = {
      starters: startersPayload,
      bench: reserveIds,
    }

    if (titularIds.length < 7) {
      setStatus('Minimo de 7 jogadores. Adicione mais atletas antes de salvar.')
      return
    }

    const golSlotFilled = slots.some((s) => s.zone === 'GOL' && s.playerId !== null)

    if (!golSlotFilled) {
      setStatus('O slot de goleiro precisa estar preenchido.')
      return
    }

    setBusy(true)

    try {
      await saveLineup(lineupToSave)
      setSavedSlots(slots.map((slot) => ({ ...slot })))
      setIsDirty(false)
      setStatus(`Escalacao salva com sucesso (${titularIds.length} titulares + ${reserveIds.length} reservas).`)
    } catch (error) {
      const msg =
        typeof error === 'string'
          ? error
          : error instanceof Error
          ? error.message
          : JSON.stringify(error)
      setStatus(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleSimulateRound = async () => {
    if (!snapshot) return

    // Resetar flag de demissão ao iniciar nova rodada
    setDismissedAfterMatch(false)

    try {
      setBusy(true)
      const result = await simulateCareerRound(formation, playStyle)

      // Armazenar status de demissão para verificar APÓS a partida terminar
      setDismissedAfterMatch(result.dismissed)

      setLiveMinute(0)
      setLiveEvents([])
      setBgEvents([])
      setLiveHomeGoals(0)
      setLiveAwayGoals(0)
      setLiveState('idle')
      setSubsUsed(0)
      setSubWindowsUsed(0)
      setSubsInCurrentPause(0)
      setSubOutSlotIdx(null)
      setSubInPlayerId('')
      setRecentSubstitution(null)

      pendingResult.current = result
      const playerTeamId = result.snapshot.playerTeamId
      const allBgGoals = result.matches
        .filter(
          (match) =>
            match.homeTeamId !== playerTeamId &&
            match.awayTeamId !== playerTeamId
        )
        .flatMap((match) => {
          let homeGoals = 0
          let awayGoals = 0

          return [...match.events]
            .filter((event) => event.eventType === 'goal')
            .sort((a, b) => a.minute - b.minute)
            .map((event) => {
              if (event.teamSide === 'home') homeGoals += 1
              if (event.teamSide === 'away') awayGoals += 1

              return {
                minute: event.minute,
                homeTeamName: match.homeTeamName,
                awayTeamName: match.awayTeamName,
                homeGoals,
                awayGoals,
              }
            })
        })
        .sort((a, b) => a.minute - b.minute)

      setBgEvents(allBgGoals)
      setPlayedRound(result.playedRound)

      const playerMatch =
        result.matches.find(
          (match) =>
            match.homeTeamId === result.snapshot.playerTeamId ||
            match.awayTeamId === result.snapshot.playerTeamId
        ) ?? null

      setFocusMatch(playerMatch)

      if (simSpeed === 'instantaneo' || !playerMatch) {
        if (playerMatch) {
          setLiveEvents(playerMatch.events)
          setLiveHomeGoals(playerMatch.homeGoals)
          setLiveAwayGoals(playerMatch.awayGoals)
        }

        setLiveMinute(90)
        setSnapshot(result.snapshot)
        setLastRoundMatches(result.matches)
        if (result.playerEnergyAfter) setPlayerEnergies(result.playerEnergyAfter)
        setStatus(`Rodada ${result.playedRound} concluida.`)
        setLiveState('done')
        setBusy(false)
        pendingResult.current = null
        // Verificação de demissão será feita no useEffect
        return
      }

      setStatus(`Rodada ${result.playedRound} em andamento...`)
      setBusy(false)
      setLiveState('running')
    } catch (error) {
      const msg =
        typeof error === 'string'
          ? error
          : error instanceof Error
          ? error.message
          : JSON.stringify(error)
      setStatus(msg)
      setBusy(false)
    }
  }

  const handleAdvanceSeason = async () => {
    if (!snapshot) return

    try {
      setBusy(true)
      setStatus('Iniciando nova temporada...')
      const newSnapshot = await advanceToNextSeason()
      setSnapshot(newSnapshot)
      setLastRoundMatches([])
      setLiveState('idle')
      setStatus(`Temporada ${newSnapshot.currentSeason} iniciada! Boa sorte!`)
    } catch (error) {
      const msg =
        typeof error === 'string'
          ? error
          : error instanceof Error
          ? error.message
          : JSON.stringify(error)
      setStatus(`Erro: ${msg}`)
    } finally {
      setBusy(false)
    }
  }



  useEffect(() => {
    if (savedSlots.length === 0) {
      setIsDirty(false)
      return
    }

    if (slots.length !== savedSlots.length) {
      setIsDirty(true)
      return
    }

    const changed = slots.some(
      (slot, idx) => slot.zone !== savedSlots[idx]?.zone || slot.playerId !== savedSlots[idx]?.playerId
    )
    setIsDirty(changed)
  }, [slots, savedSlots])

  useEffect(() => {
    if (!dragSource) return

    const onMove = (e: PointerEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY })
    }

    const onUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)

      const mark = () => {
        justDroppedRef.current = true
        setTimeout(() => { justDroppedRef.current = false }, 0)
      }

      // Procura slot de titular
      slotRefs.current.forEach((ref, targetIdx) => {
        if (!ref.contains(el)) return
        if (dragSource.type === 'slot' && targetIdx !== dragSource.idx) {
          // Troca dois titulares
          setSlots((curr) => {
            const next = [...curr]
            const temp = next[dragSource.idx].playerId
            next[dragSource.idx] = { ...next[dragSource.idx], playerId: next[targetIdx].playerId }
            next[targetIdx] = { ...next[targetIdx], playerId: temp }
            return next
          })
          mark()
        } else if (dragSource.type === 'list') {
          // Jogador da lista → slot titular
          setSlots((curr) => {
            const next = [...curr]
            const existingIdx = next.findIndex((s) => s.playerId === dragSource.playerId)
            if (existingIdx !== -1)
              next[existingIdx] = { ...next[existingIdx], playerId: next[targetIdx].playerId }
            next[targetIdx] = { ...next[targetIdx], playerId: dragSource.playerId }
            return next
          })
          mark()
        } else if (dragSource.type === 'bench') {
          // Reserva → slot titular: reserva entra no campo, titular anterior vai pro banco
          const displaced = slots[targetIdx]?.playerId ?? null
          setSlots((curr) => {
            const next = [...curr]
            next[targetIdx] = { ...next[targetIdx], playerId: dragSource.playerId }
            return next
          })
          setBenchSlots((curr) => {
            const next = curr.map((s) => ({ ...s }))
            next[dragSource.idx] = { playerId: displaced }
            return next
          })
          mark()
        }
      })

      // Procura slot de reserva
      benchRefs.current.forEach((ref, targetIdx) => {
        if (!ref.contains(el)) return
        if (dragSource.type === 'bench' && targetIdx !== dragSource.idx) {
          // Troca dois reservas
          setBenchSlots((curr) => {
            const next = curr.map((s) => ({ ...s }))
            const temp = next[dragSource.idx].playerId
            next[dragSource.idx] = { playerId: next[targetIdx].playerId }
            next[targetIdx] = { playerId: temp }
            return next
          })
          mark()
        } else if (dragSource.type !== 'bench') {
          // Titular ou lista → reserva
          applyBenchDrop(targetIdx, dragSource.playerId)
          mark()
        }
      })

      setDragSource(null)
      setDragPos(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragSource])

  const handleTabChange = (tabKey: TabKey) => {
    if (activeTab === 'escalacao' && tabKey !== 'escalacao' && isDirty) {
      const shouldLeave = window.confirm(
        'Voce tem mudancas nao salvas no elenco. Deseja sair mesmo assim?'
      )

      if (!shouldLeave) return

      setSlots(savedSlots.map((slot) => ({ ...slot })))
      setSelectedSlotIdx(null)
      setIsDirty(false)
    }

    setActiveTab(tabKey)
  }

  const isLiveRunning = liveState === 'running'
  const isLivePaused = liveState === 'paused'
  const hasLiveMatchOngoing = liveState === 'running' || liveState === 'paused'
  const isHalftimePause = liveMinute >= 45 && liveMinute < 46
  const substitutionLocked =
    subsUsed >= 5 ||
    (subWindowsUsed >= 3 && !isHalftimePause && subsInCurrentPause === 0)
  const showLiveCard = focusMatch && (liveState === 'running' || liveState === 'paused' || liveState === 'done')
  const playerTeamIsHome = focusMatch?.homeTeamId === snapshot?.playerTeamId
  const currentResult = pendingResult.current
  const benchSelectionIds = useMemo(
    () => benchSlots.map((slot) => slot.playerId).filter((id): id is string => id !== null),
    [benchSlots]
  )
  const reservePlayers = squad
    .filter((player) => !slots.some((slot) => slot.playerId === player.id))
    .sort((a, b) => computeOvr(b) - computeOvr(a))
  const eligibleBenchPlayers = reservePlayers.filter((player) => benchSelectionIds.includes(player.id))

  const playerTeamName = useMemo(() => {
    if (!snapshot) return ''
    const entry = snapshot.table.find((t) => t.teamId === snapshot.playerTeamId)
    return entry?.teamName ?? ''
  }, [snapshot])

  // Determinar cor da barra de moral baseada no risco de demissão
  const getMoraleBarColor = (morale: number) => {
    if (morale >= 50) return 'bg-success' // Verde - seguro
    if (morale >= 25) return 'bg-warning' // Amarelo - atenção
    if (morale >= 10) return 'bg-orange-500' // Laranja - perigo
    return 'bg-error' // Vermelho - crítico
  }

  return (
    <div className='min-h-svh bg-base-200 text-base-content'>
      <div className='flex min-h-svh'>
        <aside className='sticky top-0 h-svh w-[220px] shrink-0 border-r border-base-content/10 bg-base-300 px-3 py-6'>
          <h1 className='mb-4 px-2 text-2xl font-bold'>Carreira</h1>

          {snapshot && (
            <div className='mb-6 px-2 text-sm space-y-3'>
              <div className='opacity-70'>
                <span className='font-semibold text-primary'>Técnico: </span>
                <span className='truncate'>{snapshot.coachName}</span>
              </div>
              <div className='opacity-70'>
                <span className='font-semibold text-success'>Clube: </span>
                <span className='truncate'>{playerTeamName}</span>
              </div>
              <div className='opacity-70'>
                <span className='font-semibold text-info'>Orçamento: </span>
                <span>R$ {(snapshot.playerTeamBudget / 1_000_000).toFixed(1)}M</span>
              </div>
              <div className='opacity-70'>
                <div className='mb-1'>
                  <span className='font-semibold text-warning'>Moral: </span>
                  <span>{snapshot.morale}%</span>
                </div>
                {/* Barra visual de moral */}
                <div className='w-full h-2 bg-base-content/10 rounded-full overflow-hidden'>
                  <div 
                    className={`h-full ${getMoraleBarColor(snapshot.morale)} transition-all duration-300`}
                    style={{ width: `${snapshot.morale}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <nav className='flex flex-col gap-2'>
            {MENU_ITEMS.map((item) => {
              const tabKey = item.key
              const isActive = tabKey !== null && activeTab === tabKey

              const handleClick = () => {
                if (item.label === 'Salvar Jogo') {
                  setShowSaveModal(true)
                } else if (tabKey !== null) {
                  handleTabChange(tabKey)
                }
              }

              return (
                <button
                  key={item.label}
                  type='button'
                  className={[
                    'flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm transition-colors',
                    item.comingSoon
                      ? 'cursor-not-allowed bg-base-200/50 opacity-45'
                      : isActive
                      ? 'bg-green-800 text-green-50'
                      : 'bg-base-200/70 hover:bg-base-100',
                  ].join(' ')}
                  onClick={handleClick}
                  disabled={item.comingSoon}
                >
                  <span className='text-base leading-none'>{item.icon}</span>
                  <span className='flex-1'>
                    {item.label}
                    {item.comingSoon ? ' (em breve)' : ''}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className='min-w-0 flex-1 p-6'>
          <div className='mx-auto flex max-w-6xl flex-col gap-4'>
            <p className='rounded-sm border border-base-content/20 bg-base-300 p-3 text-sm'>{status}</p>

            {activeTab === 'partida' && (
              <>
                {/* Cabecalho: botao + velocidade */}
                <div className='flex flex-wrap items-center gap-3'>
                  {snapshot?.isSeasonEnded ? (
                    <button
                      type='button'
                      className='btn btn-success btn-lg'
                      onClick={() => void handleAdvanceSeason()}
                      disabled={busy}
                    >
                      🏆 Avançar para Temporada {(snapshot.currentSeason || 1) + 1}
                    </button>
                  ) : (
                    <button
                      type='button'
                      className='btn btn-primary'
                      onClick={() => void handleSimulateRound()}
                      disabled={busy || !snapshot || snapshot.currentRound >= snapshot.totalRounds || hasLiveMatchOngoing}
                    >
                      ▶ Iniciar Partida
                    </button>
                  )}
                  <div className='flex items-center gap-1 ml-auto'>
                    <span className='text-xs opacity-60 mr-1'>Vel:</span>
                    {(['devagar', 'normal', 'rapido', 'instantaneo'] as SpeedKey[]).map((speed) => (
                      <button
                        key={speed}
                        type='button'
                        className={`btn btn-xs ${simSpeed === speed ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setSimSpeed(speed)}
                      >
                        {SPEED_LABELS[speed]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card da proxima partida + Tabela de classificação */}
                {snapshot && !hasLiveMatchOngoing && liveState !== 'done' && (() => {
                  const nextMatch = snapshot.nextRoundFixtures.find(
                    (f) => f.homeTeamId === snapshot.playerTeamId || f.awayTeamId === snapshot.playerTeamId
                  )
                  if (!nextMatch) return null
                  
                  const isHome = nextMatch.homeTeamId === snapshot.playerTeamId
                  return (
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[calc(100vh-250px)]'>
                      {/* Coluna esquerda: Próxima partida */}
                      <div className='bg-base-100 border border-primary/30 rounded-lg p-5'>
                        <div className='flex items-center justify-between mb-3'>
                          <div>
                            <span className='text-xs uppercase tracking-widest opacity-40'>Proxima partida</span>
                            <div className='text-xs opacity-50 mt-0.5'>
                              Rodada {snapshot.currentRound + 1}/{snapshot.totalRounds} · {snapshot.nextMatchDate}
                            </div>
                          </div>
                          <div className='text-right'>
                            <div className='text-xs opacity-40'>{isHome ? '🏠 Mandante' : '✈ Visitante'}</div>
                            <div className='text-xs opacity-50 mt-0.5'>{nextMatch.homeStadium}</div>
                          </div>
                        </div>

                        <div className='flex items-center justify-center gap-4'>
                          <div className={`flex-1 text-right ${isHome ? 'text-primary' : ''}`}>
                            <div className='text-lg font-bold'>{nextMatch.homeTeamName}</div>
                            <div className='text-xs opacity-60 mt-0.5'>Técnico: {nextMatch.homeCoachName}</div>
                          </div>
                          <div className='text-2xl font-mono opacity-30 px-2'>vs</div>
                          <div className={`flex-1 ${!isHome ? 'text-primary' : ''}`}>
                            <div className='text-lg font-bold'>{nextMatch.awayTeamName}</div>
                            <div className='text-xs opacity-60 mt-0.5'>Técnico: {nextMatch.awayCoachName}</div>
                          </div>
                        </div>

                        <div className='mt-4 pt-3 border-t border-base-content/10 flex items-center justify-between text-xs opacity-50'>
                          <span>📊 {snapshot.playerPosition}º na classificacao</span>
                          <span>{snapshot.leagueId}</span>
                        </div>
                      </div>

                      {/* Coluna direita: Tabela de classificação */}
                      <div className='bg-base-100 border border-base-content/10 rounded-lg p-4 flex flex-col overflow-hidden'>
                        <div className='text-xs uppercase tracking-widest opacity-40 mb-3'>
                          Classificação
                        </div>
                        <div className='overflow-auto flex-1'>
                          <table className='w-full text-sm'>
                            <thead className='sticky top-0 bg-base-100'>
                              <tr className='border-b border-base-content/10'>
                                <th className='text-left py-2 pr-2 text-xs opacity-50'>#</th>
                                <th className='text-left py-2 pr-3 text-xs opacity-50'>Time</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>P</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>J</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>V</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>E</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>D</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>GP</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>GC</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>SG</th>
                              </tr>
                            </thead>
                            <tbody>
                              {snapshot.table.map((entry, idx) => {
                                const isPlayerTeam = entry.teamId === snapshot.playerTeamId
                                const totalTeams = snapshot.table.length
                                const isRelegation = idx >= totalTeams - 4
                                const isPromotion = idx < 4 && snapshot.leagueDivisionLevel > 1
                                
                                const zoneClass = isRelegation 
                                  ? 'bg-error/10' 
                                  : isPromotion 
                                  ? 'bg-success/10' 
                                  : ''
                                
                                return (
                                  <tr
                                    key={entry.teamId}
                                    className={`border-b border-base-content/5 ${isPlayerTeam ? 'font-semibold' : ''} ${zoneClass}`}
                                  >
                                    <td className='py-1.5 pr-2 text-xs opacity-60'>{idx + 1}</td>
                                    <td className={`py-1.5 pr-3 truncate max-w-[100px] text-xs ${isPlayerTeam ? 'text-primary' : ''}`}>
                                      {entry.teamName}
                                    </td>
                                    <td className='text-center py-1.5 px-1 font-bold text-xs'>{entry.points}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.played}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.wins}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.draws}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.losses}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.goalsFor}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.goalsAgainst}</td>
                                    <td className={`text-center py-1.5 px-1 font-semibold text-xs ${entry.goalDiff > 0 ? 'text-success' : entry.goalDiff < 0 ? 'text-error' : 'opacity-50'}`}>
                                      {entry.goalDiff > 0 ? '+' : ''}{entry.goalDiff}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Grids ao vivo em layout 2x2 */}
                {isLiveRunning && (
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-3 h-[660px]'>
                    {/* Grid 1: Card da partida ao vivo - ALTURA FIXA 330px */}
                    {showLiveCard && focusMatch && (
                      <div className='bg-base-100 border-2 border-primary/50 rounded-lg p-3 flex flex-col h-[330px]'>
                        <div className='flex items-center justify-between mb-2'>
                          <span className='text-[10px] uppercase tracking-widest opacity-50'>
                            Partida em andamento
                          </span>
                          <div className='flex items-center gap-2'>
                            <button type='button' className='btn btn-ghost btn-xs' onClick={pauseLive}>
                              Pausar
                            </button>
                            {hasLiveMatchOngoing && (
                              <button type='button' className='btn btn-ghost btn-xs' onClick={skipLive}>
                                Pular
                              </button>
                            )}
                            <span className='font-mono text-xl font-bold text-primary tabular-nums'>
                              {String(liveMinute).padStart(2, '0')}&apos;
                            </span>
                          </div>
                        </div>

                        <div className='flex items-center justify-center gap-4 mb-2'>
                          <div className={`flex-1 text-right ${playerTeamIsHome ? 'text-primary' : ''}`}>
                            <div className='text-sm font-semibold leading-tight'>{focusMatch.homeTeamName}</div>
                            <div className='text-[10px] opacity-60 mt-0.5'>Técnico: {focusMatch.homeCoachName}</div>
                          </div>
                          <div className='text-3xl font-mono font-bold text-primary min-w-[5rem] text-center tabular-nums'>
                            {liveHomeGoals} - {liveAwayGoals}
                          </div>
                          <div className={`flex-1 ${playerTeamIsHome ? '' : 'text-primary'}`}>
                            <div className='text-sm font-semibold leading-tight'>{focusMatch.awayTeamName}</div>
                            <div className='text-[10px] opacity-60 mt-0.5'>Técnico: {focusMatch.awayCoachName}</div>
                          </div>
                        </div>

                        <div className='w-full bg-base-300 rounded-full h-1.5 mb-1'>
                          <div
                            className='bg-primary h-1.5 rounded-full transition-all duration-100'
                            style={{ width: `${(liveMinute / 90) * 100}%` }}
                          />
                        </div>
                        <div className='flex justify-between text-[10px] opacity-30 mb-2'>
                          <span>0&apos;</span>
                          <span>45&apos;</span>
                          <span>90&apos;</span>
                        </div>

                        <div className='bg-base-200 rounded p-2 h-[170px] overflow-y-auto'>
                          {liveEvents.length === 0 && (
                            <p className='text-xs opacity-30 text-center mt-4'>Aguardando lances...</p>
                          )}
                          {[...liveEvents].reverse().map((event, index) => {
                            const isHome = event.teamSide === 'home'
                            const eventStyle = EVENT_STYLES[event.eventType] ?? {
                              label: event.eventType,
                              cls: 'bg-base-300 text-base-content',
                            }
                            
                            // Formata descrição com nome do jogador quando disponível
                            let description = event.teamName
                            if (event.playerName) {
                              if (event.eventType === 'goal') {
                                description = `⚽ ${event.playerName}`
                              } else if (event.eventType === 'save') {
                                description = `🧤 ${event.playerName}`
                              } else if (event.eventType === 'nearMiss') {
                                description = `💨 ${event.playerName}`
                              }
                            }
                            
                            return (
                              <div
                                key={`${event.minute}-${event.eventType}-${index}`}
                                className={`flex items-center gap-1.5 py-0.5 text-xs font-mono ${isHome ? '' : 'flex-row-reverse'}`}
                              >
                                <span className='text-[10px] opacity-40 w-6 shrink-0 text-right'>{event.minute}&apos;</span>
                                <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${eventStyle.cls}`}>
                                  {eventStyle.label}
                                </span>
                                <span className={event.eventType === 'goal' ? 'font-bold text-primary' : 'opacity-70'}>
                                  {description}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Grid NOVO: Alterações Rápidas - altura 330px */}
                    <div className='bg-base-100 border border-base-content/10 rounded-lg p-3 h-[330px] flex flex-col overflow-y-auto'>
                      <div className='text-xs uppercase tracking-widest opacity-40 mb-3'>
                        Alterações Rápidas
                      </div>
                      
                      <div className='space-y-3 flex-1'>
                        {/* Formação */}
                        <div>
                          <label className='text-xs opacity-60 mb-1 block'>Formação</label>
                          <select
                            className='select select-sm select-bordered w-full'
                            value={formation}
                            onChange={(e) => {
                              const newFormation = e.target.value as Formation
                              setFormation(newFormation)
                              const lineupIds = slots.map(s => s.playerId).filter((id): id is string => id !== null)
                              setSlots(buildSlotsWithLineup(newFormation, lineupIds))
                            }}
                          >
                            {FORMATIONS.map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>

                        {/* Estilo de Jogo */}
                        <div>
                          <label className='text-xs opacity-60 mb-1 block'>Estilo de Jogo</label>
                          <select
                            className='select select-sm select-bordered w-full'
                            value={playStyle}
                            onChange={(e) => setPlayStyle(e.target.value as PlayStyle)}
                          >
                            {PLAY_STYLES.map((ps) => (
                              <option key={ps} value={ps}>{ps}</option>
                            ))}
                          </select>
                        </div>

                        {/* Substituições Rápidas */}
                        <div className='flex-1'>
                          <div className='flex items-center justify-between mb-2'>
                            <label className='text-xs opacity-60'>Substituição Rápida</label>
                            <span className='text-xs opacity-40'>
                              {subsUsed}/5 • {subWindowsUsed}/3 janelas
                            </span>
                          </div>
                          
                          {(() => {
                            const fieldPlayerIds = slots.map(s => s.playerId).filter((id): id is string => id !== null)
                            const fieldPlayers = squad.filter(p => fieldPlayerIds.includes(p.id))
                            const benchPlayerIds = benchSlots.map(b => b.playerId).filter((id): id is string => id !== null)
                            const benchPlayers = squad.filter(p => benchPlayerIds.includes(p.id))
                            
                            const canSubstitute = subsUsed < 5 && (subWindowsUsed < 3 || subsInCurrentPause > 0)
                            
                            if (!canSubstitute) {
                              return (
                                <div className='text-xs opacity-50 text-center py-3'>
                                  ❌ Substituições esgotadas
                                </div>
                              )
                            }
                            
                            return (
                              <div className='space-y-2'>
                                {/* Seleção: Quem sai */}
                                <div>
                                  <label className='text-[10px] opacity-50 mb-0.5 block'>Sai do campo</label>
                                  <select
                                    className='select select-xs select-bordered w-full'
                                    value={subOutSlotIdx !== null ? slots[subOutSlotIdx]?.playerId || '' : ''}
                                    onChange={(e) => {
                                      const playerId = e.target.value
                                      const slotIdx = slots.findIndex(s => s.playerId === playerId)
                                      setSubOutSlotIdx(slotIdx >= 0 ? slotIdx : null)
                                    }}
                                  >
                                    <option value=''>-- Selecione --</option>
                                    {fieldPlayers.map((player) => {
                                      const energy = playerEnergies[player.id] ?? 100
                                      const energyIcon = energy > 70 ? '🟢' : energy > 40 ? '🟡' : '🔴'
                                      return (
                                        <option key={player.id} value={player.id}>
                                          {energyIcon} {player.name}
                                        </option>
                                      )
                                    })}
                                  </select>
                                </div>

                                {/* Seleção: Quem entra */}
                                <div>
                                  <label className='text-[10px] opacity-50 mb-0.5 block'>Entra no campo</label>
                                  <select
                                    className='select select-xs select-bordered w-full'
                                    value={subInPlayerId}
                                    onChange={(e) => setSubInPlayerId(e.target.value)}
                                  >
                                    <option value=''>-- Selecione --</option>
                                    {benchPlayers.map((player) => (
                                      <option key={player.id} value={player.id}>
                                        {player.name} ({player.position})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Botão de substituição */}
                                <button
                                  type='button'
                                  className='btn btn-primary btn-xs w-full'
                                  disabled={subOutSlotIdx === null || !subInPlayerId}
                                  onClick={applySubstitution}
                                >
                                  🔄 Substituir
                                </button>

                                {/* Última substituição */}
                                {recentSubstitution && (
                                  <div className='text-[10px] opacity-50 text-center mt-1 p-1 bg-base-200 rounded'>
                                    {recentSubstitution.minute}&apos; {recentSubstitution.outPlayerName} ⇆ {recentSubstitution.inPlayerName}
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Grid 3: Estatísticas da partida - altura 330px */}
                    {showLiveCard && focusMatch && (
                      <div className='bg-base-100 border border-base-content/10 rounded-lg p-3 h-[330px] overflow-y-auto'>
                        <div className='text-xs uppercase tracking-widest opacity-40 mb-3'>
                          Estatísticas da Partida
                        </div>
                        
                        {(() => {
                          // Contar eventos por tipo e time
                          const homeEvents = liveEvents.filter(e => e.teamSide === 'home')
                          const awayEvents = liveEvents.filter(e => e.teamSide === 'away')
                          
                          const homeShots = homeEvents.filter(e => ['nearMiss', 'save', 'goal'].includes(e.eventType)).length
                          const awayShots = awayEvents.filter(e => ['nearMiss', 'save', 'goal'].includes(e.eventType)).length
                          
                          const homeShotsOnTarget = homeEvents.filter(e => ['save', 'goal'].includes(e.eventType)).length
                          const awayShotsOnTarget = awayEvents.filter(e => ['save', 'goal'].includes(e.eventType)).length
                          
                          const homeCorners = homeEvents.filter(e => e.eventType === 'corner').length
                          const awayCorners = awayEvents.filter(e => e.eventType === 'corner').length
                          
                          const homeFouls = homeEvents.filter(e => e.eventType === 'foul').length
                          const awayFouls = awayEvents.filter(e => e.eventType === 'foul').length
                          
                          const homeYellows = homeEvents.filter(e => e.eventType === 'yellowCard').length
                          const awayYellows = awayEvents.filter(e => e.eventType === 'yellowCard').length
                          
                          const homeReds = homeEvents.filter(e => e.eventType === 'redCard').length
                          const awayReds = awayEvents.filter(e => e.eventType === 'redCard').length
                          
                          // Aproximar posse baseada na proporção de eventos ofensivos
                          const totalOffensiveEvents = homeShots + awayShots + homeCorners + awayCorners
                          const homePossession = totalOffensiveEvents > 0 
                            ? Math.round(((homeShots + homeCorners) / totalOffensiveEvents) * 100)
                            : 50
                          const awayPossession = 100 - homePossession
                          
                          const StatRow = ({ label, homeValue, awayValue, isPercentage = false }: { 
                            label: string, 
                            homeValue: number, 
                            awayValue: number,
                            isPercentage?: boolean 
                          }) => {
                            const total = homeValue + awayValue
                            const homePercent = total > 0 ? (homeValue / total) * 100 : 50
                            const awayPercent = total > 0 ? (awayValue / total) * 100 : 50
                            
                            return (
                              <div className='mb-2'>
                                <div className='flex items-center justify-between text-xs mb-1'>
                                  <span className='font-mono font-bold min-w-[30px] text-right'>
                                    {isPercentage ? `${homeValue}%` : homeValue}
                                  </span>
                                  <span className='text-[10px] opacity-60'>{label}</span>
                                  <span className='font-mono font-bold min-w-[30px]'>
                                    {isPercentage ? `${awayValue}%` : awayValue}
                                  </span>
                                </div>
                                {!isPercentage && (
                                  <div className='flex items-center gap-0.5 h-1.5'>
                                    <div 
                                      className='bg-primary/60 h-full rounded-l transition-all'
                                      style={{ width: `${homePercent}%` }}
                                    />
                                    <div 
                                      className='bg-secondary/60 h-full rounded-r transition-all'
                                      style={{ width: `${awayPercent}%` }}
                                    />
                                  </div>
                                )}
                                {isPercentage && (
                                  <div className='flex items-center gap-0.5 h-1.5'>
                                    <div 
                                      className='bg-primary/60 h-full rounded-l transition-all'
                                      style={{ width: `${homeValue}%` }}
                                    />
                                    <div 
                                      className='bg-secondary/60 h-full rounded-r transition-all'
                                      style={{ width: `${awayValue}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          }
                          
                          return (
                            <div>
                              <div className='flex items-center justify-between mb-3 text-xs font-semibold'>
                                <span className={playerTeamIsHome ? 'text-primary' : ''}>
                                  {focusMatch.homeTeamName}
                                </span>
                                <span className={!playerTeamIsHome ? 'text-primary' : ''}>
                                  {focusMatch.awayTeamName}
                                </span>
                              </div>
                              
                              <StatRow label='Posse de Bola' homeValue={homePossession} awayValue={awayPossession} isPercentage />
                              <StatRow label='Chutes' homeValue={homeShots} awayValue={awayShots} />
                              <StatRow label='Chutes no Gol' homeValue={homeShotsOnTarget} awayValue={awayShotsOnTarget} />
                              <StatRow label='Escanteios' homeValue={homeCorners} awayValue={awayCorners} />
                              <StatRow label='Faltas' homeValue={homeFouls} awayValue={awayFouls} />
                              {(homeYellows > 0 || awayYellows > 0) && (
                                <StatRow label='Cartões Amarelos' homeValue={homeYellows} awayValue={awayYellows} />
                              )}
                              {(homeReds > 0 || awayReds > 0) && (
                                <StatRow label='Cartões Vermelhos' homeValue={homeReds} awayValue={awayReds} />
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Grid 2: Outras partidas - altura 330px */}
                    {bgEvents.length > 0 && (() => {
                      const matchMap = new Map<string, {
                        homeTeamName: string
                        awayTeamName: string
                        homeGoals: number
                        awayGoals: number
                        lastGoalMinute: number
                        lastGoalTeam: string
                      }>()

                      bgEvents
                        .filter((e) => e.minute <= liveMinute)
                        .forEach((e) => {
                          const key = `${e.homeTeamName}-${e.awayTeamName}`
                          matchMap.set(key, {
                            homeTeamName: e.homeTeamName,
                            awayTeamName: e.awayTeamName,
                            homeGoals: e.homeGoals,
                            awayGoals: e.awayGoals,
                            lastGoalMinute: e.minute,
                            lastGoalTeam: e.homeGoals > (matchMap.get(key)?.homeGoals ?? 0)
                              ? e.homeTeamName
                              : e.awayTeamName,
                          })
                        })

                      const allMatches = (currentResult?.matches ?? []).filter((match) => {
                        if (!focusMatch) return true
                        return !(
                          match.homeTeamId === focusMatch.homeTeamId &&
                          match.awayTeamId === focusMatch.awayTeamId
                        )
                      })

                      return (
                        <div className='bg-base-100 border border-base-content/10 rounded-lg p-3 flex flex-col h-[330px]'>
                          <div className='text-xs uppercase tracking-widest opacity-40 mb-2'>
                            Outras partidas
                          </div>
                          <div className='space-y-1 flex-1 overflow-y-auto'>
                            {allMatches.map((match) => {
                              const key = `${match.homeTeamName}-${match.awayTeamName}`
                              const live = matchMap.get(key)
                              const homeGoals = live?.homeGoals ?? 0
                              const awayGoals = live?.awayGoals ?? 0

                              return (
                                <div
                                  key={key}
                                  className='flex items-center justify-between text-sm gap-2'
                                >
                                  <div className='flex items-center gap-2 min-w-0'>
                                    <span className='truncate opacity-80'>{match.homeTeamName}</span>
                                    <span className='font-mono font-bold tabular-nums shrink-0'>
                                      {homeGoals} - {awayGoals}
                                    </span>
                                    <span className='truncate opacity-80'>{match.awayTeamName}</span>
                                  </div>
                                  {live && (
                                    <span className='shrink-0 text-xs opacity-50 whitespace-nowrap'>
                                      ⚽ {live.lastGoalTeam.split(' ')[0]} {live.lastGoalMinute}&apos;
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {showLiveCard && focusMatch && liveState === 'done' && snapshot && (() => {
                  const nextMatch = snapshot.nextRoundFixtures.find(
                    (f) => f.homeTeamId === snapshot.playerTeamId || f.awayTeamId === snapshot.playerTeamId
                  )
                  const isHome = nextMatch ? nextMatch.homeTeamId === snapshot.playerTeamId : false
                  
                  return (
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[calc(100vh-250px)]'>
                      {/* Coluna esquerda: Próxima partida + Resultados */}
                      <div className='flex flex-col gap-4'>
                        {/* Próxima partida */}
                        {nextMatch && (
                          <div className='bg-base-100 border border-primary/30 rounded-lg p-4'>
                            <div className='flex items-center justify-between mb-3'>
                              <div>
                                <span className='text-xs uppercase tracking-widest opacity-40'>Proxima partida</span>
                                <div className='text-xs opacity-50 mt-0.5'>
                                  Rodada {snapshot.currentRound + 1}/{snapshot.totalRounds} · {snapshot.nextMatchDate}
                                </div>
                              </div>
                              <div className='text-right'>
                                <div className='text-xs opacity-40'>{isHome ? '🏠 Mandante' : '✈ Visitante'}</div>
                                <div className='text-xs opacity-50 mt-0.5'>{nextMatch.homeStadium}</div>
                              </div>
                            </div>

                            <div className='flex items-center justify-center gap-4'>
                              <div className={`flex-1 text-right ${isHome ? 'text-primary' : ''}`}>
                                <div className='text-base font-bold'>{nextMatch.homeTeamName}</div>
                                <div className='text-xs opacity-60 mt-0.5'>Técnico: {nextMatch.homeCoachName}</div>
                              </div>
                              <div className='text-xl font-mono opacity-30 px-2'>vs</div>
                              <div className={`flex-1 ${!isHome ? 'text-primary' : ''}`}>
                                <div className='text-base font-bold'>{nextMatch.awayTeamName}</div>
                                <div className='text-xs opacity-60 mt-0.5'>Técnico: {nextMatch.awayCoachName}</div>
                              </div>
                            </div>

                            <div className='mt-3 pt-2 border-t border-base-content/10 flex items-center justify-between text-xs opacity-50'>
                              <span>📊 {snapshot.playerPosition}º na classificacao</span>
                              <span>{snapshot.leagueId}</span>
                            </div>
                          </div>
                        )}

                        {/* Resultados da rodada */}
                        <div className='bg-base-100 border border-base-content/10 rounded-lg p-4 flex-1 overflow-hidden flex flex-col'>
                          <div className='text-xs uppercase tracking-widest opacity-40 mb-3'>
                            Todos os jogos - Rodada {playedRound}
                          </div>
                          <div className='space-y-2 overflow-y-auto pr-1'>
                            {lastRoundMatches.map((match) => {
                              const matchKey = `${match.homeTeamId}-${match.awayTeamId}`
                              const isPlayerMatch = match.homeTeamId === focusMatch.homeTeamId && match.awayTeamId === focusMatch.awayTeamId
                              const isExpanded = expandedMatchKey === matchKey
                              const homeGoals = match.events.filter(e => e.eventType === 'goal' && e.teamSide === 'home')
                              const awayGoals = match.events.filter(e => e.eventType === 'goal' && e.teamSide === 'away')
                              
                              return (
                                <div
                                  key={matchKey}
                                  className={`rounded overflow-hidden ${isPlayerMatch ? 'border-2 border-primary/40' : 'border border-base-content/10'}`}
                                >
                                  {/* Placar - clicável */}
                                  <button
                                    type='button'
                                    onClick={() => setExpandedMatchKey(isExpanded ? null : matchKey)}
                                    className={`w-full flex items-center justify-between text-sm p-2.5 transition-colors ${
                                      isPlayerMatch ? 'bg-primary/10 hover:bg-primary/15' : 'bg-base-200 hover:bg-base-300'
                                    }`}
                                  >
                                    <span className='truncate flex-1 opacity-80 text-left text-xs'>{match.homeTeamName}</span>
                                    <span className='font-mono font-bold mx-2 tabular-nums text-xs'>
                                      {match.homeGoals} - {match.awayGoals}
                                    </span>
                                    <span className='truncate flex-1 text-right opacity-80 text-xs'>{match.awayTeamName}</span>
                                    {(homeGoals.length > 0 || awayGoals.length > 0) && (
                                      <span className='ml-2 text-xs opacity-40'>
                                        {isExpanded ? '▲' : '▼'}
                                      </span>
                                    )}
                                  </button>
                                  
                                  {/* Gols expandidos */}
                                  {isExpanded && (homeGoals.length > 0 || awayGoals.length > 0) && (
                                    <div className='bg-base-100/50 px-2.5 py-1.5 space-y-1'>
                                      {match.events
                                        .filter(e => e.eventType === 'goal')
                                        .map((event, idx) => {
                                          const isHomeGoal = event.teamSide === 'home'
                                          return (
                                            <div
                                              key={`${matchKey}-goal-${idx}`}
                                              className='flex items-center text-xs'
                                            >
                                              {isHomeGoal ? (
                                                <>
                                                  <span className='flex-1 text-left opacity-80'>
                                                    ⚽ {event.playerName || event.teamName}
                                                  </span>
                                                  <span className='opacity-40 text-[10px] mx-2'>{event.minute}&apos;</span>
                                                  <span className='flex-1'></span>
                                                </>
                                              ) : (
                                                <>
                                                  <span className='flex-1'></span>
                                                  <span className='opacity-40 text-[10px] mx-2'>{event.minute}&apos;</span>
                                                  <span className='flex-1 text-right opacity-80'>
                                                    ⚽ {event.playerName || event.teamName}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                          )
                                        })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Coluna direita: Tabela de classificação (altura total) */}
                      <div className='bg-base-100 border border-base-content/10 rounded-lg p-4 flex flex-col overflow-hidden'>
                        <div className='text-xs uppercase tracking-widest opacity-40 mb-3'>
                          Classificação
                        </div>
                        <div className='overflow-auto flex-1'>
                          <table className='w-full text-sm'>
                            <thead className='sticky top-0 bg-base-100'>
                              <tr className='border-b border-base-content/10'>
                                <th className='text-left py-2 pr-2 text-xs opacity-50'>#</th>
                                <th className='text-left py-2 pr-3 text-xs opacity-50'>Time</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>P</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>J</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>V</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>E</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>D</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>GP</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>GC</th>
                                <th className='text-center py-2 px-1 text-xs opacity-50'>SG</th>
                              </tr>
                            </thead>
                            <tbody>
                              {snapshot.table.map((entry, idx) => {
                                const isPlayerTeam = entry.teamId === snapshot.playerTeamId
                                const totalTeams = snapshot.table.length
                                const isRelegation = idx >= totalTeams - 4
                                const isPromotion = idx < 4 && snapshot.leagueDivisionLevel > 1
                                
                                const zoneClass = isRelegation 
                                  ? 'bg-error/10' 
                                  : isPromotion 
                                  ? 'bg-success/10' 
                                  : ''
                                
                                return (
                                  <tr
                                    key={entry.teamId}
                                    className={`border-b border-base-content/5 ${isPlayerTeam ? 'font-semibold' : ''} ${zoneClass}`}
                                  >
                                    <td className='py-1.5 pr-2 text-xs opacity-60'>{idx + 1}</td>
                                    <td className={`py-1.5 pr-3 truncate max-w-[100px] text-xs ${isPlayerTeam ? 'text-primary' : ''}`}>
                                      {entry.teamName}
                                    </td>
                                    <td className='text-center py-1.5 px-1 font-bold text-xs'>{entry.points}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.played}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.wins}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.draws}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.losses}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.goalsFor}</td>
                                    <td className='text-center py-1.5 px-1 opacity-70 text-xs'>{entry.goalsAgainst}</td>
                                    <td className={`text-center py-1.5 px-1 font-semibold text-xs ${entry.goalDiff > 0 ? 'text-success' : entry.goalDiff < 0 ? 'text-error' : 'opacity-50'}`}>
                                      {entry.goalDiff > 0 ? '+' : ''}{entry.goalDiff}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {isLivePaused && (
                  <div className='bg-base-100 border border-base-content/20 rounded-sm p-4 space-y-3'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-sm font-semibold uppercase tracking-widest opacity-70'>
                        Pausado: substituicoes
                      </h3>
                      <button type='button' className='btn btn-primary btn-xs' onClick={resumeLive}>
                        Retomar partida
                      </button>
                    </div>

                    <div className='text-xs opacity-65'>
                      Regras FIFA: ate 5 atletas e no maximo 3 janelas.
                      <span className='ml-2'>Usadas: {subsUsed}/5 atletas</span>
                      <span className='ml-2'>{subWindowsUsed}/3 janelas</span>
                      <span className='ml-2 opacity-70'>Intervalo nao conta janela.</span>
                    </div>

                    {recentSubstitution && (
                      <div className='rounded border border-success/30 bg-success/10 px-3 py-2 text-xs'>
                        <span className='font-semibold text-success'>Substituicao</span>
                        <span className='ml-2 opacity-80'>
                          {recentSubstitution.minute}&apos; · {recentSubstitution.zone} · Saiu {recentSubstitution.outPlayerName.split(' ')[0]} · Entrou {recentSubstitution.inPlayerName.split(' ')[0]}
                        </span>
                      </div>
                    )}

                    <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
                      <select
                        className='select select-bordered w-full select-sm'
                        value={formation}
                        onChange={(event) => {
                          const f = event.target.value as Formation
                          setFormation(f)
                          setSlots((current) => {
                            const lineupIds = current
                              .map((slot) => slot.playerId)
                              .filter((id): id is string => id !== null)
                            return buildSlotsWithLineup(f, lineupIds)
                          })
                          setSubOutSlotIdx(null)
                        }}
                        disabled={busy}
                      >
                        {FORMATIONS.map((item) => (
                          <option key={item} value={item}>Formacao {item}</option>
                        ))}
                      </select>
                      <select
                        className='select select-bordered w-full select-sm'
                        value={playStyle}
                        onChange={(event) => setPlayStyle(event.target.value as PlayStyle)}
                        disabled={busy}
                      >
                        {PLAY_STYLES.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>

                    <div className='grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]'>
                      <div className='rounded-md border border-base-content/10 bg-base-200/60 p-3'>
                        <div className='mb-2 text-[10px] uppercase tracking-widest opacity-45'>
                          Mini escalacao em campo · clique para escolher quem sai
                        </div>
                        <div className='space-y-2'>
                          {slotsByZone.map(({ zone, entries }) => (
                            <div key={`pause-${zone}`} className='space-y-1'>
                              <div className='text-[10px] uppercase tracking-wider opacity-40'>{zone}</div>
                              <div className='flex flex-wrap gap-1.5'>
                                {entries.map(({ slot, idx }) => {
                                  const player = squad.find((p) => p.id === slot.playerId)
                                  const isOpen = selectedSlotIdx === idx
                                  const isFilled = slot.playerId !== null
                                  const availablePlayers = squad.filter(
                                    (p) => !slots.some((s) => s.playerId === p.id) || p.id === slot.playerId
                                  )

                                  // Jogadores compatíveis com a zona do slot primeiro, depois os demais - ambos por OVR
                                  const compatible = availablePlayers
                                    .filter((p) => isPositionInZone(slot.zone, p.position))
                                    .sort((a, b) => computeOvr(b) - computeOvr(a))
                                  const others = availablePlayers
                                    .filter((p) => !isPositionInZone(slot.zone, p.position))
                                    .sort((a, b) => computeOvr(b) - computeOvr(a))
                                  const sortedPlayers = [...compatible, ...others]

                                  return (
                                    <button
                                      key={idx}
                                      type='button'
                                      onClick={() => {
                                        if (justDroppedRef.current) return
                                        setSelectedSlotIdx(isOpen ? null : idx)
                                      }}
                                      onPointerDown={(e) => {
                                        if (!isFilled) return
                                        setDragSource({ type: 'slot', idx, playerId: slot.playerId ?? '' })
                                        setDragPos({ x: e.clientX, y: e.clientY })
                                      }}
                                      className={[
                                        'min-w-[5.25rem] rounded border px-2 py-1 text-left text-[11px] transition-all border-2',
                                        isFilled ? 'cursor-move' : '',
                                        isOpen
                                          ? 'border-yellow-400 bg-yellow-400/20 text-yellow-100 shadow-lg shadow-yellow-400/20'
                                          : isFilled
                                          ? 'border-green-400/60 bg-green-900/70 text-green-100 hover:border-green-300'
                                          : 'border-green-600/40 bg-green-900/20 text-green-500 border-dashed hover:border-green-500',
                                      ].join(' ')}
                                    >
                                      <div className='font-bold text-[8px] opacity-50 mb-0.5'>{zone}</div>
                                      <div className='font-semibold truncate leading-tight text-[11px]'>
                                        {player ? abbrevName(player.name) : 'Vazio'}
                                      </div>
                                      {player && (() => {
                                        const e = playerEnergies[player.id] ?? 100
                                        const ec = e >= 70 ? 'bg-success' : e >= 40 ? 'bg-warning' : 'bg-error'
                                        return (
                                          <>
                                            <div className='font-mono text-[9px] opacity-60 mt-0.5'>{computeOvr(player)}</div>
                                            <div className='mt-1 h-1 w-full rounded-full bg-black/30 overflow-hidden'>
                                              <div className={`h-full rounded-full ${ec}`} style={{ width: `${Math.round(e)}%` }} />
                                            </div>
                                          </>
                                        )
                                      })()}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className='rounded-md border border-base-content/10 bg-base-200/60 p-3'>
                        <div className='mb-2 text-[10px] uppercase tracking-widest opacity-45'>
                          Banco · clique para escolher quem entra
                        </div>
                        <div className='max-h-52 space-y-1 overflow-y-auto pr-1'>
                          {eligibleBenchPlayers.map((player) => {
                            const selected = subInPlayerId === player.id
                            const energy = playerEnergies[player.id] ?? 100
                            const energyColor =
                              energy >= 70 ? 'bg-success' : energy >= 40 ? 'bg-warning' : 'bg-error'
                            return (
                              <button
                                key={`pause-bench-${player.id}`}
                                type='button'
                                onClick={() => setSubInPlayerId(player.id)}
                                disabled={busy || substitutionLocked}
                                className={[
                                  'flex w-full items-center justify-between rounded border px-2 py-1.5 text-xs transition-colors',
                                  selected
                                    ? 'border-primary/60 bg-primary/20'
                                    : 'border-base-content/15 bg-base-100 hover:border-primary/40',
                                ].join(' ')}
                              >
                                <div className='min-w-0 flex-1 text-left'>
                                  <div className='truncate'>{abbrevName(player.name)} ({player.position})</div>
                                  <div className='mt-0.5 h-1 w-full rounded-full bg-base-300 overflow-hidden'>
                                    <div
                                      className={`h-full rounded-full ${energyColor}`}
                                      style={{ width: `${Math.round(energy)}%` }}
                                    />
                                  </div>
                                  <div className='text-[9px] opacity-50 mt-0.5'>{Math.round(energy)}% nrg</div>
                                </div>
                                <span className='ml-2 shrink-0 font-mono font-bold'>OVR {computeOvr(player)}</span>
                              </button>
                            )
                          })}
                          {eligibleBenchPlayers.length === 0 && (
                            <p className='text-xs opacity-45'>Sem reservas elegiveis. Configure no menu Elenco.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className='flex flex-wrap items-center gap-2'>
                      <button
                        type='button'
                        className='btn btn-primary btn-sm'
                        onClick={handleInMatchSubstitution}
                        disabled={busy || substitutionLocked || subOutSlotIdx === null || !subInPlayerId}
                      >
                        Confirmar substituicao
                      </button>
                      <button
                        type='button'
                        className='btn btn-ghost btn-sm'
                        onClick={() => {
                          setSubOutSlotIdx(null)
                          setSubInPlayerId('')
                        }}
                        disabled={busy || (subOutSlotIdx === null && !subInPlayerId)}
                      >
                        Limpar selecao
                      </button>

                      <span className='text-xs opacity-60'>
                        Sai: {subOutSlotIdx !== null ? `slot ${subOutSlotIdx + 1}` : '-'} · Entra:{' '}
                        {subInPlayerId ? (squad.find((p) => p.id === subInPlayerId)?.name ?? '-') : '-'}
                      </span>
                    </div>

                    <p className='text-[11px] opacity-55'>
                      Apos o fim da partida, a escalação volta para a que estava salva antes do jogo.
                    </p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'escalacao' && (
              <div className='bg-base-100 border border-base-content/20 rounded-sm p-4'>
                <div className='grid grid-cols-2 gap-3 mb-4'>
                  <select
                    className='select select-bordered w-full'
                    value={formation}
                    onChange={(event) => {
                      const f = event.target.value as Formation
                      setFormation(f)
                      setSlots(buildSlotsWithLineup(f, []))
                      setSelectedSlotIdx(null)
                    }}
                    disabled={busy}
                  >
                    {FORMATIONS.map((item) => (
                      <option key={item} value={item}>Formacao {item}</option>
                    ))}
                  </select>
                  <select
                    className='select select-bordered w-full'
                    value={playStyle}
                    onChange={(event) => setPlayStyle(event.target.value as PlayStyle)}
                    disabled={busy}
                  >
                    {PLAY_STYLES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <div className='mb-4 flex flex-wrap items-center gap-2'>
                  <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    onClick={handleAutoLineup}
                    disabled={busy || squad.length === 0}
                  >
                    Escalacao automatica
                  </button>
                  <button
                    type='button'
                    className='btn btn-ghost btn-sm'
                    onClick={handleClearLineup}
                    disabled={busy}
                  >
                    Limpar escalacao
                  </button>
                </div>

                <div className='flex items-center justify-between mb-3'>
                  <h2 className='text-xl font-semibold'>Elenco</h2>
                  <span className={`text-sm font-semibold ${
                    titularesCount >= 11 ? 'text-success' : titularesCount >= 7 ? 'text-warning' : 'text-error'
                  }`}>
                    {titularesCount}/11
                  </span>
                </div>

                <div className='flex flex-col lg:flex-row gap-4'>
                  {/* Campo visual */}
                  <div
                    className='flex-shrink-0 bg-green-800 rounded-lg p-3 flex flex-col gap-2 transition-shadow lg:w-[420px]'
                  >
                    {slotsByZone.map(({ zone, entries }, zoneIdx) => (
                      <div
                        key={zone}
                        className={`flex flex-col gap-1.5 ${zoneIdx < slotsByZone.length - 1 ? 'border-b border-white/10 pb-2' : ''}`}
                      >
                        <span className='text-green-300/40 text-[9px] font-bold uppercase tracking-widest text-center'>
                          {zone === 'ATA' ? 'Ataque' : zone === 'MEI' ? 'Meio-Campo' : zone === 'DEF' ? 'Defesa' : 'Goleiro'}
                        </span>
                        <div className='flex justify-center gap-1.5 flex-wrap'>
                          {entries.map(({ slot, idx }) => {
                            const player = squad.find((p) => p.id === slot.playerId)
                            const isOpen = selectedSlotIdx === idx
                            const isFilled = slot.playerId !== null
                            const availablePlayers = squad.filter(
                              (p) => !slots.some((s) => s.playerId === p.id) || p.id === slot.playerId
                            )

                            // Jogadores compatíveis com a zona do slot primeiro, depois os demais - ambos por OVR
                            const compatible = availablePlayers
                              .filter((p) => isPositionInZone(slot.zone, p.position))
                              .sort((a, b) => computeOvr(b) - computeOvr(a))
                            const others = availablePlayers
                              .filter((p) => !isPositionInZone(slot.zone, p.position))
                              .sort((a, b) => computeOvr(b) - computeOvr(a))
                            const sortedPlayers = [...compatible, ...others]

                            return (
                              <div
                                key={idx}
                                className='relative'
                                ref={(el) => {
                                  if (el) slotRefs.current.set(idx, el)
                                  else slotRefs.current.delete(idx)
                                }}
                              >
                                <button
                                  type='button'
                                  onPointerDown={(e) => {
                                    if (!isFilled) return
                                    setDragSource({ type: 'slot', idx, playerId: slot.playerId ?? '' })
                                    setDragPos({ x: e.clientX, y: e.clientY })
                                  }}
                                  onClick={() => {
                                    if (justDroppedRef.current) return
                                    setSelectedSlotIdx(isOpen ? null : idx)
                                  }}
                                  className={[
                                    'rounded-md px-2 py-1.5 text-center w-[5.5rem] text-xs transition-all border-2',
                                    isFilled ? 'cursor-move' : '',
                                    isOpen
                                      ? 'border-yellow-400 bg-yellow-400/20 text-yellow-100 shadow-lg shadow-yellow-400/20'
                                      : isFilled
                                      ? 'border-green-400/60 bg-green-900/70 text-green-100 hover:border-green-300'
                                      : 'border-green-600/40 bg-green-900/20 text-green-500 border-dashed hover:border-green-500',
                                  ].join(' ')}
                                >
                                  <div className='font-bold text-[8px] opacity-50 mb-0.5'>{zone}</div>
                                  <div className='font-semibold truncate leading-tight text-[11px]'>
                                    {player ? abbrevName(player.name) : 'Vazio'}
                                  </div>
                                  {player && (() => {
                                    const e = playerEnergies[player.id] ?? 100
                                    const ec = e >= 70 ? 'bg-success' : e >= 40 ? 'bg-warning' : 'bg-error'
                                    return (
                                      <>
                                        <div className='font-mono text-[9px] opacity-60 mt-0.5'>{computeOvr(player)}</div>
                                        <div className='mt-1 h-1 w-full rounded-full bg-black/30 overflow-hidden'>
                                          <div className={`h-full rounded-full ${ec}`} style={{ width: `${Math.round(e)}%` }} />
                                        </div>
                                      </>
                                    )
                                  })()}
                                </button>

                                {/* Dropdown do slot */}
                                {isOpen && (
                                  <div className='absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 w-44 bg-base-100 border border-base-content/20 rounded-lg shadow-xl overflow-hidden'>
                                    <div className='px-2 py-1.5 text-[10px] uppercase tracking-widest opacity-40 border-b border-base-content/10'>
                                      Slot {zone}
                                    </div>
                                    <div className='max-h-48 overflow-y-auto'>
                                      {isFilled && (
                                        <button
                                          type='button'
                                          className='w-full text-left px-3 py-1.5 text-xs hover:bg-error/20 text-error'
                                          onClick={() => {
                                            setSlots((curr) => curr.map((s, i) => i === idx ? { ...s, playerId: null } : s))
                                            setSelectedSlotIdx(null)
                                          }}
                                        >
                                          Remover jogador
                                        </button>
                                      )}
                                      {sortedPlayers.length === 0 && (
                                        <p className='px-3 py-2 text-xs opacity-40'>Nenhum disponivel</p>
                                      )}
                                      {compatible.length > 0 && (
                                        <div className='px-2 py-1 text-[10px] opacity-30 uppercase tracking-widest'>
                                          Posicao ideal
                                        </div>
                                      )}
                                      {compatible.map((p) => (
                                        <button
                                          key={p.id}
                                          type='button'
                                          className='w-full text-left px-3 py-1.5 text-xs hover:bg-primary/20 flex items-center justify-between gap-2'
                                          onClick={() => {
                                            setSlots((curr) => {
                                              const next = [...curr]
                                              const existingIdx = next.findIndex((s) => s.playerId === p.id)
                                              if (existingIdx !== -1) {
                                                next[existingIdx] = { ...next[existingIdx], playerId: next[idx].playerId }
                                              }
                                              next[idx] = { ...next[idx], playerId: p.id }
                                              return next
                                            })
                                            setSelectedSlotIdx(null)
                                          }}
                                        >
                                          <div className='min-w-0'>
                                            <div className='font-semibold truncate'>{abbrevName(p.name)}</div>
                                            <div className='opacity-40'>{p.position}</div>
                                          </div>
                                          <span className='font-mono font-bold shrink-0'>{computeOvr(p)}</span>
                                        </button>
                                      ))}
                                      {others.length > 0 && compatible.length > 0 && (
                                        <div className='px-2 py-1 text-[10px] opacity-30 uppercase tracking-widest border-t border-base-content/10'>
                                          Outros
                                        </div>
                                      )}
                                      {others.map((p) => (
                                        <button
                                          key={p.id}
                                          type='button'
                                          className='w-full text-left px-3 py-1.5 text-xs hover:bg-base-300 flex items-center justify-between gap-2 opacity-60'
                                          onClick={() => {
                                            setSlots((curr) => {
                                              const next = [...curr]
                                              const existingIdx = next.findIndex((s) => s.playerId === p.id)
                                              if (existingIdx !== -1) {
                                                next[existingIdx] = {
                                                  ...next[existingIdx],
                                                  playerId: next[idx].playerId,
                                                }
                                              }
                                              next[idx] = { ...next[idx], playerId: p.id }
                                              return next
                                            })
                                            setSelectedSlotIdx(null)
                                          }}
                                        >
                                          <div className='min-w-0'>
                                            <div className='font-semibold truncate'>{abbrevName(p.name)}</div>
                                            <div className='opacity-40'>{p.position}</div>
                                          </div>
                                          <span className='font-mono font-bold shrink-0'>{computeOvr(p)}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className='w-full lg:w-40 flex-shrink-0 rounded-lg border border-slate-500/40 bg-slate-900/85 p-3'>
                    <div className='mb-2 flex items-center justify-between'>
                      <h3 className='text-xs font-semibold uppercase tracking-widest text-slate-200/90'>Reservas</h3>
                      <span className='text-[10px] text-slate-300/70'>
                        {benchSelectionIds.length}/{BENCH_SLOT_COUNT}
                      </span>
                    </div>

                    <div className='space-y-1.5'>
                      {benchSlots.map((benchSlot, benchIdx) => {
                        const player = squad.find((p) => p.id === benchSlot.playerId)
                        return (
                          <button
                            key={`bench-slot-${benchIdx}`}
                            type='button'
                            ref={(el) => {
                              if (el) benchRefs.current.set(benchIdx, el)
                              else benchRefs.current.delete(benchIdx)
                            }}
                            className={[
                              'w-full rounded-md border-2 px-2 py-1.5 text-left text-xs transition-colors',
                              player
                                ? 'border-sky-400/55 bg-slate-800 text-slate-100 hover:border-sky-300'
                                : 'border-slate-600/60 bg-slate-800/35 text-slate-400 border-dashed hover:border-slate-500',
                            ].join(' ')}
                            onPointerDown={(e) => {
                              if (!player) return
                              setDragSource({ type: 'bench', idx: benchIdx, playerId: player.id })
                              setDragPos({ x: e.clientX, y: e.clientY })
                            }}
                            onClick={() => {
                              if (!player) return
                              if (justDroppedRef.current) return
                              setBenchSlots((curr) => {
                                const next = curr.map((slot) => ({ ...slot }))
                                next[benchIdx] = { playerId: null }
                                return next
                              })
                            }}
                          >
                            <div className='flex items-center justify-between gap-2'>
                              <span className='font-bold text-[10px] tracking-wide opacity-80'>RES</span>
                              <span className='text-[10px] opacity-60'>#{benchIdx + 1}</span>
                            </div>
                            <div className='truncate font-semibold leading-tight'>
                              {player ? abbrevName(player.name) : 'Vazio'}
                            </div>
                            <div className='text-[10px] opacity-65'>
                              {player ? `OVR ${computeOvr(player)}` : 'Arraste um jogador'}
                            </div>
                            {player && (() => {
                              const e = playerEnergies[player.id] ?? 100
                              const ec = e >= 70 ? 'bg-success' : e >= 40 ? 'bg-warning' : 'bg-error'
                              return (
                                <div className='mt-1 h-1 w-full rounded-full bg-black/30 overflow-hidden'>
                                  <div className={`h-full rounded-full ${ec}`} style={{ width: `${Math.round(e)}%` }} />
                                </div>
                              )
                            })()}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Lista de jogadores expandida com atributos */}
                  <div className='flex-1 flex flex-col gap-2'>
                    {/* Filtros */}
                    <div className='flex gap-2 items-center'>
                      <select
                        className='select select-bordered select-sm flex-1'
                        value={filterPosition}
                        onChange={(e) => setFilterPosition(e.target.value)}
                      >
                        <option value='all'>Todas posicoes</option>
                        <option value='GOL'>Goleiros</option>
                        <option value='ZAG'>Zagueiros</option>
                        <option value='LAT'>Laterais</option>
                        <option value='VOL'>Volantes</option>
                        <option value='MEI'>Meias</option>
                        <option value='ATA'>Atacantes</option>
                      </select>
                      <select
                        className='select select-bordered select-sm flex-1'
                        value={filterEnergy}
                        onChange={(e) => setFilterEnergy(e.target.value as 'all' | 'high' | 'medium' | 'low')}
                      >
                        <option value='all'>Qualquer energia</option>
                        <option value='high'>≥ 70% energia</option>
                        <option value='medium'>40-69% energia</option>
                        <option value='low'>&lt; 40% energia</option>
                      </select>
                    </div>

                    {/* Lista de jogadores com atributos */}
                    <div className='overflow-y-auto flex-1 space-y-1 pr-1' style={{ maxHeight: '500px' }}>
                      {squad
                        .filter((player) => {
                          // Filtro de posição
                          if (filterPosition !== 'all') {
                            if (filterPosition === 'LAT') {
                              if (player.position !== 'LAT-E' && player.position !== 'LAT-D') return false
                            } else if (filterPosition === 'ATA') {
                              if (!['ATA', 'SA', 'PNT-E', 'PNT-D'].includes(player.position)) return false
                            } else if (filterPosition === 'MEI') {
                              if (!['MEI', 'MEI-A', 'VOL'].includes(player.position)) return false
                            } else {
                              if (!player.position.startsWith(filterPosition)) return false
                            }
                          }
                          
                          // Filtro de energia
                          const energy = playerEnergies[player.id] ?? 100
                          if (filterEnergy === 'high' && energy < 70) return false
                          if (filterEnergy === 'medium' && (energy < 40 || energy >= 70)) return false
                          if (filterEnergy === 'low' && energy >= 40) return false
                          
                          return true
                        })
                        .map((player) => {
                          const isStarter = slots.some((s) => s.playerId === player.id)
                          const isBench = benchSlots.some((s) => s.playerId === player.id)
                          const isAssigned = isStarter || isBench
                          const energy = playerEnergies[player.id] ?? 100
                          const energyColor =
                            energy >= 70 ? 'bg-success' : energy >= 40 ? 'bg-warning' : 'bg-error'

                          const handleUnassign = () => {
                            if (isStarter) {
                              setSlots((curr) => curr.map((s) => s.playerId === player.id ? { ...s, playerId: null } : s))
                            } else if (isBench) {
                              setBenchSlots((curr) => curr.map((s) => s.playerId === player.id ? { playerId: null } : s))
                            }
                          }

                          return (
                            <div
                              key={player.id}
                              onPointerDown={(e) => {
                                if (isAssigned) return
                                setDragSource({ type: 'list', idx: -1, playerId: player.id })
                                setDragPos({ x: e.clientX, y: e.clientY })
                              }}
                              onClick={() => {
                                if (isAssigned) handleUnassign()
                              }}
                              className={[
                                'rounded-md border px-2.5 py-2 text-xs transition-colors select-none',
                                isAssigned
                                  ? 'cursor-pointer hover:bg-error/15 border-error/30 bg-error/5'
                                  : 'cursor-grab hover:bg-primary/15 border-base-content/20',
                              ].join(' ')}
                            >
                              {/* Nome e badges */}
                              <div className='flex items-center justify-between gap-2 mb-1.5'>
                                <div className='flex items-center gap-1.5 min-w-0 flex-1'>
                                  <span className='font-semibold truncate'>{player.name}</span>
                                  {isStarter && (
                                    <span className='shrink-0 rounded bg-primary/30 px-1.5 py-0.5 text-[9px] font-bold text-primary'>
                                      TIT
                                    </span>
                                  )}
                                  {isBench && (
                                    <span className='shrink-0 rounded bg-base-content/20 px-1.5 py-0.5 text-[9px] font-bold opacity-70'>
                                      RES
                                    </span>
                                  )}
                                </div>
                                <div className='flex items-center gap-2 shrink-0'>
                                  <span className='opacity-60 text-[10px]'>{player.position}</span>
                                  <span className='font-mono font-bold text-sm'>{computeOvr(player)}</span>
                                </div>
                              </div>

                              {/* Idade e Nacionalidade */}
                              {(player.age || player.nationality) && (
                                <div className='flex items-center gap-2 text-[10px] opacity-60 mb-1.5'>
                                  {player.age && <span>🎂 {player.age} anos</span>}
                                  {player.nationality && <span>🌍 {player.nationality}</span>}
                                </div>
                              )}

                              {/* Grid de atributos */}
                              <div className='grid grid-cols-6 gap-x-2 gap-y-1 text-[10px] mb-1.5'>
                                <div className='flex flex-col items-center'>
                                  <span className='opacity-50 font-medium'>VEL</span>
                                  <span className='font-bold'>{player.speed}</span>
                                </div>
                                <div className='flex flex-col items-center'>
                                  <span className='opacity-50 font-medium'>FIN</span>
                                  <span className='font-bold'>{player.shooting}</span>
                                </div>
                                <div className='flex flex-col items-center'>
                                  <span className='opacity-50 font-medium'>PAS</span>
                                  <span className='font-bold'>{player.passing}</span>
                                </div>
                                <div className='flex flex-col items-center'>
                                  <span className='opacity-50 font-medium'>DRI</span>
                                  <span className='font-bold'>{player.dribbling}</span>
                                </div>
                                <div className='flex flex-col items-center'>
                                  <span className='opacity-50 font-medium'>DEF</span>
                                  <span className='font-bold'>{player.defense}</span>
                                </div>
                                <div className='flex flex-col items-center'>
                                  <span className='opacity-50 font-medium'>RES</span>
                                  <span className='font-bold'>{player.stamina}</span>
                                </div>
                              </div>

                              {/* Barra de energia */}
                              <div className='flex items-center gap-2'>
                                <div className='flex-1 h-1.5 rounded-full bg-base-300 overflow-hidden'>
                                  <div
                                    className={`h-full rounded-full transition-all ${energyColor}`}
                                    style={{ width: `${Math.round(energy)}%` }}
                                  />
                                </div>
                                <span className='text-[9px] opacity-60 font-mono w-8 text-right'>{Math.round(energy)}%</span>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>

                {/* Fechar dropdown ao clicar fora */}
                {selectedSlotIdx !== null && (
                  <div
                    className='fixed inset-0 z-40'
                    onClick={() => setSelectedSlotIdx(null)}
                  />
                )}

                <div className='mt-4 flex items-center gap-3'>
                  <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    onClick={() => void handleSaveLineup()}
                    disabled={busy || titularesCount < 7}
                  >
                    Salvar Elenco
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'calendario' && <Calendar />}


          </div>
        </main>

        {dragSource && dragPos && (
          <div
            style={{ position: 'fixed', left: dragPos.x - 36, top: dragPos.y - 24, zIndex: 9999, pointerEvents: 'none' }}
            className='rounded-md px-2 py-1.5 text-center w-[4.5rem] text-xs bg-yellow-400/20 border-2 border-yellow-400 text-yellow-100'
          >
            {abbrevName(squad.find((p) => p.id === dragSource.playerId)?.name ?? '')}
          </div>
        )}

        {/* Modal de Save Game */}
        {showSaveModal && (
          <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/50'>
            <div className='bg-base-100 rounded-lg shadow-2xl p-8 w-full max-w-md'>
              <h2 className='text-3xl font-bold mb-6 text-center'>Salvar Jogo</h2>

              <div className='form-control mb-4'>
                <label className='label'>
                  <span className='label-text'>Nome do Save</span>
                </label>
                <input
                  type='text'
                  placeholder='Minha Carreira no Flamengo'
                  className='input input-bordered w-full'
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void (async () => {
                        if (!saveName.trim()) {
                          setSaveStatus('Digite um nome para o save')
                          return
                        }

                        setSaving(true)
                        setSaveStatus('')

                        try {
                          const filename = await saveCareer(saveName.trim())
                          setSaveStatus(`Jogo salvo com sucesso! (${filename})`)
                          setTimeout(() => {
                            setShowSaveModal(false)
                            setSaveName('')
                            setSaveStatus('')
                          }, 1500)
                        } catch (error) {
                          setSaveStatus(`Erro ao salvar: ${error instanceof Error ? error.message : String(error)}`)
                        } finally {
                          setSaving(false)
                        }
                      })()
                    } else if (e.key === 'Escape') {
                      setShowSaveModal(false)
                      setSaveName('')
                      setSaveStatus('')
                    }
                  }}
                  autoFocus
                  maxLength={50}
                />
              </div>

              {saveStatus && (
                <div className={`alert ${saveStatus.includes('Erro') ? 'alert-error' : 'alert-success'} mb-4`}>
                  {saveStatus}
                </div>
              )}

              <div className='flex gap-3'>
                <button
                  type='button'
                  className='btn btn-primary flex-1'
                  onClick={async () => {
                    if (!saveName.trim()) {
                      setSaveStatus('Digite um nome para o save')
                      return
                    }

                    setSaving(true)
                    setSaveStatus('')

                    try {
                      const filename = await saveCareer(saveName.trim())
                      setSaveStatus(`Jogo salvo com sucesso! (${filename})`)
                      setTimeout(() => {
                        setShowSaveModal(false)
                        setSaveName('')
                        setSaveStatus('')
                      }, 1500)
                    } catch (error) {
                      setSaveStatus(`Erro ao salvar: ${error instanceof Error ? error.message : String(error)}`)
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving || !saveName.trim()}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type='button'
                  className='btn btn-ghost'
                  onClick={() => {
                    setShowSaveModal(false)
                    setSaveName('')
                    setSaveStatus('')
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Career
