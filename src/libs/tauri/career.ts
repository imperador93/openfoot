import { invoke } from '@tauri-apps/api/core'

export interface TeamOption {
  id: string
  name: string
}

export interface SquadPlayer {
  id: string
  name: string
  position: string
  speed: number
  shooting: number
  passing: number
  dribbling: number
  defense: number
  stamina: number
  status?: string
}

export interface TeamDetail {
  id: string
  name: string
  leagueId: string
  squad: SquadPlayer[]
}

export interface LeagueDetail {
  id: string
  name: string
  country: string
  teams: TeamDetail[]
}

export interface LeagueOption {
  id: string
  name: string
  teams: TeamOption[]
}

export interface Fixture {
  homeTeamId: string
  homeTeamName: string
  homeStadium: string
  awayTeamId: string
  awayTeamName: string
}

export interface TableEntry {
  teamId: string
  teamName: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
}

export interface BackgroundLeagueSnapshot {
  leagueId: string
  currentRound: number
  totalRounds: number
  leaderTeamName: string
  leaderPoints: number
}

export interface CareerSnapshot {
  leagueId: string
  playerTeamId: string
  activeLeagueIds: string[]
  currentRound: number
  totalRounds: number
  playerPosition: number
  nextMatchDate: string
  table: TableEntry[]
  nextRoundFixtures: Fixture[]
  backgroundLeagues: BackgroundLeagueSnapshot[]
}

export interface MatchEvent {
  minute: number
  eventType: string // 'goal' | 'shot' | 'dangerous'
  teamSide: string  // 'home' | 'away'
  teamName: string
}

export interface RoundMatch {
  homeTeamId: string
  homeTeamName: string
  homeGoals: number
  awayTeamId: string
  awayTeamName: string
  awayGoals: number
  events: MatchEvent[]
}

export interface BackgroundGoalEvent {
  minute: number
  homeTeamName: string
  awayTeamName: string
  homeGoals: number
  awayGoals: number
}

export interface BackgroundMatch {
  homeTeamName: string
  awayTeamName: string
  homeGoals: number
  awayGoals: number
  goalEvents: BackgroundGoalEvent[]
}

export interface BackgroundLeagueRound {
  leagueId: string
  playedRound: number
  leaderTeamName: string
  leaderPoints: number
  matches: BackgroundMatch[]
}

export interface SimulateRoundResult {
  playedRound: number
  matches: RoundMatch[]
  backgroundLeagues: BackgroundLeagueRound[]
  snapshot: CareerSnapshot
}

export type SlotZone = 'GOL' | 'DEF' | 'MEI' | 'ATA'

export interface LineupStarterSlot {
  playerId: string
  slotZone: SlotZone
  slotIndex: number
}

export interface SavedLineup {
  starters: LineupStarterSlot[]
  bench: string[]
}

interface RawTeam {
  id?: string
  name?: string
  Id?: string
  Name?: string
}

interface RawLeague {
  id?: string
  name?: string
  teams?: RawTeam[]
  country?: string
  Id?: string
  Name?: string
  Teams?: RawTeam[]
  Country?: string
}

interface RawSquadPlayer {
  id?: string
  name?: string
  position?: string
  speed?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defense?: number
  stamina?: number
  status?: string
  Id?: string
  Name?: string
  Position?: string
  Speed?: number
  Shooting?: number
  Passing?: number
  Dribbling?: number
  Defense?: number
  Stamina?: number
  Status?: string
}

interface RawTeamDetail extends RawTeam {
  leagueId?: string
  squad?: RawSquadPlayer[]
  LeagueId?: string
  Squad?: RawSquadPlayer[]
}

interface RawLeagueDetail extends RawLeague {
  teams?: RawTeamDetail[]
  Teams?: RawTeamDetail[]
}

const normalizeTeam = (raw: RawTeam): TeamOption | null => {
  const id = raw.id ?? raw.Id
  const name = raw.name ?? raw.Name

  if (!id || !name) return null
  return { id, name }
}

const normalizeLeague = (raw: RawLeague): LeagueOption | null => {
  const id = raw.id ?? raw.Id
  const name = raw.name ?? raw.Name
  const teamsRaw = raw.teams ?? raw.Teams ?? []

  if (!id || !name) return null

  return {
    id,
    name,
    teams: teamsRaw.map(normalizeTeam).filter((team): team is TeamOption => team !== null),
  }
}

const normalizeSquadPlayer = (raw: RawSquadPlayer): SquadPlayer | null => {
  const id = raw.id ?? raw.Id
  const name = raw.name ?? raw.Name
  const position = raw.position ?? raw.Position
  const speed = raw.speed ?? raw.Speed
  const shooting = raw.shooting ?? raw.Shooting
  const passing = raw.passing ?? raw.Passing
  const dribbling = raw.dribbling ?? raw.Dribbling
  const defense = raw.defense ?? raw.Defense
  const stamina = raw.stamina ?? raw.Stamina
  const status = raw.status ?? raw.Status

  if (
    !id ||
    !name ||
    !position ||
    speed === undefined ||
    shooting === undefined ||
    passing === undefined ||
    dribbling === undefined ||
    defense === undefined ||
    stamina === undefined
  ) {
    return null
  }

  return {
    id,
    name,
    position,
    speed,
    shooting,
    passing,
    dribbling,
    defense,
    stamina,
    status,
  }
}

const normalizeTeamDetail = (raw: RawTeamDetail): TeamDetail | null => {
  const id = raw.id ?? raw.Id
  const name = raw.name ?? raw.Name
  const leagueId = raw.leagueId ?? raw.LeagueId
  const squadRaw = raw.squad ?? raw.Squad ?? []

  if (!id || !name || !leagueId) return null

  return {
    id,
    name,
    leagueId,
    squad: squadRaw
      .map(normalizeSquadPlayer)
      .filter((player): player is SquadPlayer => player !== null),
  }
}

const normalizeLeagueDetail = (raw: RawLeagueDetail): LeagueDetail | null => {
  const id = raw.id ?? raw.Id
  const name = raw.name ?? raw.Name
  const country = raw.country ?? raw.Country
  const teamsRaw = raw.teams ?? raw.Teams ?? []

  if (!id || !name || !country) return null

  return {
    id,
    name,
    country,
    teams: teamsRaw
      .map(normalizeTeamDetail)
      .filter((team): team is TeamDetail => team !== null),
  }
}

export const fetchLeagues = async () => {
  const raw = await invoke<RawLeague[]>('fetch_leagues')
  return raw.map(normalizeLeague).filter((league): league is LeagueOption => league !== null)
}

export const fetchLeague = async (id: string) => {
  const raw = await invoke<RawLeagueDetail>('fetch_league', { id })
  const normalized = normalizeLeagueDetail(raw)

  if (!normalized) {
    throw new Error(`Formato de liga invalido para '${id}'`)
  }

  return normalized
}

export const startNewCareer = async (leagueId: string, teamId: string) =>
  invoke<CareerSnapshot>('start_new_career', { leagueId, teamId })

export const startNewCareerMulti = async (
  leagueId: string,
  teamId: string,
  activeLeagueIds: string[]
) =>
  invoke<CareerSnapshot>('start_new_career_multi', {
    leagueId,
    teamId,
    activeLeagueIds,
  })

export const simulateCareerRound = async (formation: string, playStyle: string) =>
  invoke<SimulateRoundResult>('simulate_career_round', { formation, playStyle })

export const getCareerSnapshot = async () =>
  invoke<CareerSnapshot>('get_career_snapshot')

export const saveLineup = async (lineup: SavedLineup) =>
  invoke<void>('save_lineup', { lineup })

export const getLineup = async () =>
  invoke<SavedLineup>('get_lineup')
