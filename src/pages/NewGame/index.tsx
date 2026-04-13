import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  fetchLeagues,
  startNewCareerMulti,
  type LeagueOption,
} from '@/libs/tauri/career'

const NewGame = () => {
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<LeagueOption[]>([])
  const [activeLeagueIds, setActiveLeagueIds] = useState<string[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [status, setStatus] = useState('Carregando ligas...')
  const [busy, setBusy] = useState(false)

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === leagueId) ?? null,
    [leagues, leagueId]
  )

  useEffect(() => {
    const loadLeagues = async () => {
      setBusy(true)

      try {
        const loadedLeagues = await fetchLeagues()
        setLeagues(loadedLeagues)

        if (loadedLeagues.length === 0) {
          setStatus('Nenhuma liga encontrada.')
          return
        }

        const firstLeague = loadedLeagues[0]
        setLeagueId(firstLeague.id)
        setTeamId(firstLeague.teams?.[0]?.id ?? '')
        setActiveLeagueIds([firstLeague.id])
        setStatus('Escolha liga e time para iniciar carreira.')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Falha ao carregar ligas')
      } finally {
        setBusy(false)
      }
    }

    void loadLeagues()
  }, [])

  useEffect(() => {
    const fallbackTeam = selectedLeague?.teams[0]?.id ?? ''
    const teamStillExists = selectedLeague?.teams.some((team) => team.id === teamId)

    if (!teamStillExists && fallbackTeam !== teamId) {
      setTeamId(fallbackTeam)
    }
  }, [selectedLeague, teamId])

  useEffect(() => {
    if (!leagueId) return

    setActiveLeagueIds((current) => {
      if (current.includes(leagueId)) return current
      return [...current, leagueId]
    })
  }, [leagueId])

  const toggleActiveLeague = (id: string) => {
    if (id === leagueId) return

    setActiveLeagueIds((current) =>
      current.includes(id) ? current.filter((league) => league !== id) : [...current, id]
    )
  }

  const handleStartCareer = async () => {
    if (!leagueId || !teamId) {
      setStatus('Selecione uma liga e um time antes de iniciar.')
      return
    }

    const selectedIds = activeLeagueIds.includes(leagueId)
      ? activeLeagueIds
      : [...activeLeagueIds, leagueId]

    setBusy(true)

    try {
      await startNewCareerMulti(leagueId, teamId, selectedIds)
      navigate('/career', { replace: true })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao iniciar carreira')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='min-h-svh p-6 bg-base-200 text-base-content'>
      <h1 className='text-3xl font-bold mb-4'>Novo Jogo</h1>

      <div className='flex flex-col gap-4 max-w-4xl'>
        <p className='text-sm bg-base-300 p-3 rounded-sm border border-base-content/20'>{status}</p>

        <div className='flex flex-col md:flex-row gap-3'>
          <select
            className='select select-bordered w-full'
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            disabled={busy || leagues.length === 0}
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>

          <select
            className='select select-bordered w-full'
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={busy || !selectedLeague}
          >
            {(selectedLeague?.teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className='bg-base-100 border border-base-content/20 rounded-sm p-4'>
          <h3 className='text-lg font-semibold mb-2'>Ligas em background</h3>
          <p className='text-sm opacity-80 mb-3'>
            Marque as ligas que devem ser simuladas a cada rodada junto da liga principal.
          </p>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
            {leagues.map((league) => {
              const checked = activeLeagueIds.includes(league.id)
              const locked = league.id === leagueId

              return (
                <label
                  key={league.id}
                  className='flex items-center gap-2 border border-base-content/15 rounded-sm p-2'
                >
                  <input
                    type='checkbox'
                    className='checkbox checkbox-primary checkbox-sm'
                    checked={checked}
                    disabled={busy || locked}
                    onChange={() => toggleActiveLeague(league.id)}
                  />
                  <span className={locked ? 'font-semibold text-primary' : ''}>{league.name}</span>
                  {locked && <span className='text-xs opacity-70'>(liga principal)</span>}
                </label>
              )
            })}
          </div>
        </div>

        <div className='flex gap-3'>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => void handleStartCareer()}
            disabled={busy || !leagueId || !teamId}
          >
            Iniciar carreira
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewGame
