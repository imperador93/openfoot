import { useEffect, useMemo, useState } from 'react'
import {
  getCalendarData,
  type CalendarData,
  type CalendarRound,
} from '@/libs/tauri/career'

// Função para calcular data de início da temporada dinamicamente
const getSeasonStart = (season: number) => {
  const year = 2026 + (season - 1)
  return new Date(year, 1, 1) // Mês 1 = fevereiro (0-indexed)
}

interface DayCell {
  date: Date
  dayOfMonth: number
  isCurrentMonth: boolean
  round: CalendarRound | null
  isToday: boolean
}

interface MonthData {
  year: number
  month: number // 0-indexed
  monthName: string
  weeks: DayCell[][]
}

// ===== COMPONENTE PRINCIPAL =====
export default function Calendar() {
  const [data, setData] = useState<CalendarData | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [currentMonthView, setCurrentMonthView] = useState<Date>(new Date(2026, 1, 1)) // Fevereiro 2026
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCalendar()
  }, [])

  const loadCalendar = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await getCalendarData()
      
      setData(result)
      
      // Seleciona automaticamente o próximo jogo
      if (result.currentRound > 0 && result.currentRound <= result.totalRounds) {
        const nextRound = result.rounds[result.currentRound - 1]
        if (nextRound) {
          const seasonStart = getSeasonStart(result.currentSeason)
          const roundDate = new Date(seasonStart)
          roundDate.setDate(roundDate.getDate() + (nextRound.roundNumber - 1) * 7)
          setSelectedDate(roundDate)
          setCurrentMonthView(new Date(roundDate.getFullYear(), roundDate.getMonth(), 1))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar calendário')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Mapeia datas para rodadas do jogador
  const dateToRoundMap = useMemo(() => {
    if (!data) return new Map<string, CalendarRound>()
    
    const seasonStart = getSeasonStart(data.currentSeason)
    const map = new Map<string, CalendarRound>()
    data.rounds.forEach((round) => {
      // Apenas rodadas com jogo do jogador
      const hasPlayerMatch = round.matches.some((m) => m.isPlayerMatch)
      if (hasPlayerMatch) {
        const roundDate = new Date(seasonStart)
        roundDate.setDate(roundDate.getDate() + (round.roundNumber - 1) * 7)
        const key = `${roundDate.getFullYear()}-${roundDate.getMonth()}-${roundDate.getDate()}`
        map.set(key, round)
      }
    })
    return map
  }, [data])

  // Constrói o calendário mensal
  const buildMonthCalendar = (year: number, month: number): MonthData => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDayOfWeek = firstDay.getDay() // 0 = domingo
    
    const weeks: DayCell[][] = []
    let currentWeek: DayCell[] = []
    
    // Preenche dias do mês anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i)
      currentWeek.push({
        date,
        dayOfMonth: date.getDate(),
        isCurrentMonth: false,
        round: null,
        isToday: false,
      })
    }
    
    // Preenche dias do mês atual
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      const key = `${year}-${month}-${day}`
      const round = dateToRoundMap.get(key) || null
      
      currentWeek.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: true,
        round,
        isToday: false,
      })
      
      if (date.getDay() === 6) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    }
    
    // Completa a última semana com dias do próximo mês
    if (currentWeek.length > 0) {
      let nextDay = 1
      while (currentWeek.length < 7) {
        const nextDate = new Date(year, month + 1, nextDay)
        currentWeek.push({
          date: nextDate,
          dayOfMonth: nextDate.getDate(),
          isCurrentMonth: false,
          round: null,
          isToday: false,
        })
        nextDay++
      }
      weeks.push(currentWeek)
    }
    
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    
    return {
      year,
      month,
      monthName: monthNames[month],
      weeks,
    }
  }

  const monthData = useMemo(
    () => buildMonthCalendar(currentMonthView.getFullYear(), currentMonthView.getMonth()),
    [currentMonthView, dateToRoundMap]
  )

  const selectedRound = useMemo(() => {
    if (!selectedDate || !data) return null
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`
    return dateToRoundMap.get(key) || null
  }, [selectedDate, dateToRoundMap, data])

  // Encontra o jogo do jogador na rodada selecionada
  const selectedPlayerMatch = useMemo(() => {
    if (!selectedRound) return null
    return selectedRound.matches.find((m) => m.isPlayerMatch) || null
  }, [selectedRound])

  const goToPrevMonth = () => {
    setCurrentMonthView(
      new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1)
    )
  }

  const goToNextMonth = () => {
    setCurrentMonthView(
      new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1)
    )
  }

  const goToCurrentRound = () => {
    if (!data) return
    const nextRound = data.rounds[data.currentRound - 1]
    if (nextRound) {
      const roundDate = new Date(SEASON_START)
      roundDate.setDate(roundDate.getDate() + (nextRound.roundNumber - 1) * 7)
      setSelectedDate(roundDate)
      setCurrentMonthView(new Date(roundDate.getFullYear(), roundDate.getMonth(), 1))
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-error">❌ {error}</div>
        <button onClick={loadCalendar} className="btn btn-primary">
          Tentar Novamente
        </button>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {monthData.monthName} {monthData.year}
          </h1>
          <p className="text-sm opacity-70">
            {data.leagueName} · Rodada {data.currentRound} de {data.totalRounds}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={goToPrevMonth} className="btn btn-ghost btn-sm">
            ←
          </button>
          <button onClick={goToCurrentRound} className="btn btn-accent btn-sm">
            Próximo Jogo
          </button>
          <button onClick={goToNextMonth} className="btn btn-ghost btn-sm">
            →
          </button>
        </div>
      </div>

      {/* Grid do Calendário */}
      <div className="flex-1 overflow-auto rounded-lg border-2 border-base-300 bg-base-200">
        <table className="h-full w-full table-fixed">
          <thead>
            <tr className="border-b-2 border-base-300">
              {weekDays.map((day) => (
                <th
                  key={day}
                  className="border-r border-base-300 p-2 text-center text-sm font-bold last:border-r-0"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthData.weeks.map((week, weekIdx) => (
              <tr key={weekIdx} className="border-b border-base-300">
                {week.map((cell, dayIdx) => {
                  const isSelected =
                    selectedDate &&
                    cell.date.getDate() === selectedDate.getDate() &&
                    cell.date.getMonth() === selectedDate.getMonth() &&
                    cell.date.getFullYear() === selectedDate.getFullYear()

                  return (
                    <td
                      key={dayIdx}
                      className={`relative border-r border-base-300 p-2 align-top last:border-r-0 ${
                        !cell.isCurrentMonth ? 'bg-base-300/30' : ''
                      } ${isSelected ? 'ring-2 ring-primary ring-inset' : ''} ${
                        cell.round ? 'cursor-pointer hover:bg-base-100' : ''
                      }`}
                      onClick={() => cell.round && setSelectedDate(cell.date)}
                    >
                      <div className="flex h-full min-h-[70px] flex-col">
                        <span
                          className={`text-sm font-semibold ${
                            !cell.isCurrentMonth ? 'opacity-40' : ''
                          }`}
                        >
                          {cell.dayOfMonth}
                        </span>
                        
                        {cell.round && (
                          <div className="mt-2 flex-1">
                            <div
                              className={`rounded-md p-2 text-center text-xs font-bold ${
                                cell.round.isPlayed
                                  ? 'bg-success/20 text-success-content'
                                  : 'bg-primary text-primary-content'
                              }`}
                            >
                              {cell.round.isPlayed ? '✓ Jogado' : '⚽ Jogo'}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalhes do Jogo Selecionado */}
      {selectedPlayerMatch && (
        <div className="rounded-lg border-2 border-primary bg-base-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-right">
              <p className="text-xl font-bold">
                {selectedPlayerMatch.homeTeamName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {selectedPlayerMatch.homeGoals !== null && selectedPlayerMatch.awayGoals !== null ? (
                <div className="flex items-center gap-3 rounded-lg bg-base-300 px-6 py-3 font-bold">
                  <span className="text-3xl">{selectedPlayerMatch.homeGoals}</span>
                  <span className="opacity-50">×</span>
                  <span className="text-3xl">{selectedPlayerMatch.awayGoals}</span>
                </div>
              ) : (
                <div className="rounded-lg bg-base-300 px-6 py-3 text-lg opacity-70">
                  {selectedRound?.isPlayed ? '-- × --' : 'vs'}
                </div>
              )}
            </div>

            <div className="flex-1 text-left">
              <p className="text-xl font-bold">
                {selectedPlayerMatch.awayTeamName}
              </p>
            </div>
          </div>

          <div className="mt-3 text-center text-sm opacity-70">
            Rodada {selectedRound?.roundNumber} · {selectedDate?.toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-primary"></div>
          <span>Próximo Jogo ou A Jogar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-success/20"></div>
          <span>Jogo Realizado</span>
        </div>
      </div>
    </div>
  )
}
