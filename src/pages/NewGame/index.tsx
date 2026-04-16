import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { fetchLeagues, startNewCareerMulti, type LeagueOption } from '@/libs/tauri/career'

type Step = 1 | 2 | 3 | 4

const STEP_LABELS = ['Nome do Técnico', 'Países', 'Escolha seu Time', 'Confirmar']

const StepIndicator = ({ current }: { current: Step }) => (
  <div className='flex items-center gap-2 text-sm mb-6'>
    {STEP_LABELS.map((label, i) => {
      const num = (i + 1) as Step
      const active = num === current
      const done = num < current
      return (
        <span key={label} className='flex items-center gap-2'>
          {i > 0 && <span className='opacity-30'>→</span>}
          <span
            className={
              active
                ? 'text-success font-semibold'
                : done
                  ? 'text-success/60'
                  : 'opacity-40'
            }
          >
            {active || done ? '●' : '○'} {label}
          </span>
        </span>
      )
    })}
  </div>
)

const NewGame = () => {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [coachName, setCoachName] = useState('')
  const [leagues, setLeagues] = useState<LeagueOption[]>([])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedLeagueId, setSelectedLeagueId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Accordion states
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null)
  const [expandedLeagueId, setExpandedLeagueId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLeagues()
        setLeagues(data)
      } catch (e) {
        console.error('Erro ao carregar ligas:', e)
        setError(e instanceof Error ? e.message : 'Falha ao carregar ligas')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // Países únicos disponíveis (ordem alfabética)
  const countries = useMemo(
    () => [...new Set(leagues.map((l) => l.country).filter(Boolean))].sort(),
    [leagues],
  )

  // Ligas de todos os países selecionados (background)
  const selectedLeagueIds = useMemo(
    () => leagues.filter((l) => selectedCountries.includes(l.country)).map((l) => l.id),
    [leagues, selectedCountries],
  )

  const selectedLeague = useMemo(
    () => leagues.find((l) => l.id === selectedLeagueId) ?? null,
    [leagues, selectedLeagueId],
  )

  const selectedMainCountry = useMemo(
    () => selectedLeague?.country ?? '',
    [selectedLeague],
  )

  const toggleCountry = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country],
    )
  }

  const selectAllCountries = () => {
    setSelectedCountries([...countries])
  }

  const goToStep2 = () => {
    if (!coachName.trim()) return
    setStep(2)
  }

  const goToStep3 = () => {
    if (selectedCountries.length === 0) return
    setStep(3)
  }

  const goToStep4 = () => {
    if (!selectedLeagueId || !teamId) return
    setStep(4)
  }

  const handleStart = async () => {
    if (!selectedLeagueId || !teamId || !coachName.trim()) return
    setBusy(true)
    setError(null)
    try {
      // Todas as ligas dos países selecionados
      const allIds = selectedLeagueIds.includes(selectedLeagueId)
        ? selectedLeagueIds
        : [...selectedLeagueIds, selectedLeagueId]
      await startNewCareerMulti(selectedLeagueId, teamId, coachName.trim(), allIds)
      navigate('/career', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao iniciar carreira')
    } finally {
      setBusy(false)
    }
  }

  const selectedTeamName = selectedLeague?.teams.find((t) => t.id === teamId)?.name ?? ''
  const backgroundLeagues = leagues.filter(
    (l) => l.id !== selectedLeagueId && selectedLeagueIds.includes(l.id),
  )

  return (
    <div className='min-h-svh bg-base-200 text-base-content flex flex-col'>
      <div className='flex-1 p-6 max-w-4xl mx-auto w-full flex flex-col'>
        <h1 className='text-3xl font-bold mb-4'>Novo Jogo</h1>

        {loading ? (
          <p className='text-sm opacity-70'>Carregando ligas...</p>
        ) : error && step !== 4 ? (
          <p className='text-sm text-error'>{error}</p>
        ) : (
          <>
            <StepIndicator current={step} />

            {/* ── Passo 1: Nome do Técnico ── */}
            {step === 1 && (
              <div className='flex flex-col gap-4'>
                <p className='text-sm opacity-70'>
                  Digite o seu nome como técnico. Este nome será exibido durante toda a carreira.
                </p>
                
                <div className='bg-base-100 border border-base-content/20 rounded-md p-6 max-w-md'>
                  <label className='form-control'>
                    <div className='label'>
                      <span className='label-text font-semibold'>Nome do Técnico</span>
                    </div>
                    <input
                      type='text'
                      placeholder='Digite seu nome...'
                      className='input input-bordered w-full'
                      value={coachName}
                      onChange={(e) => setCoachName(e.target.value)}
                      maxLength={30}
                      autoFocus
                    />
                    <div className='label'>
                      <span className='label-text-alt opacity-50'>Máximo 30 caracteres</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* ── Passo 2: Escolher países (lista com checkboxes) ── */}
            {step === 2 && (
              <div className='flex flex-col gap-4'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm opacity-70'>
                    Selecione os países que rodarão na simulação (background). Todas as ligas desses países serão incluídas.
                  </p>
                  <button
                    type='button'
                    className='btn btn-sm btn-outline'
                    onClick={selectAllCountries}
                  >
                    Selecionar todos
                  </button>
                </div>
                
                <div className='bg-base-100 border border-base-content/20 rounded-md divide-y divide-base-content/10 max-h-[500px] overflow-y-auto'>
                  {countries.map((country) => {
                    const selected = selectedCountries.includes(country)
                    const leagueCount = leagues.filter((l) => l.country === country).length
                    return (
                      <label
                        key={country}
                        className='flex items-center gap-3 p-3 hover:bg-base-200 cursor-pointer transition-colors'
                      >
                        <input
                          type='checkbox'
                          className='checkbox checkbox-success'
                          checked={selected}
                          onChange={() => toggleCountry(country)}
                        />
                        <div className='flex-1'>
                          <div className='font-semibold'>{country}</div>
                          <div className='text-xs opacity-60'>
                            {leagueCount} {leagueCount === 1 ? 'liga' : 'ligas'}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Passo 3: Escolher país → liga → time (accordion) ── */}
            {step === 3 && (
              <div className='flex flex-col gap-4'>
                <p className='text-sm opacity-70'>
                  Escolha o time que você vai gerenciar. Expanda o país e a liga para ver os times disponíveis.
                </p>
                
                <div className='bg-base-100 border border-base-content/20 rounded-md divide-y divide-base-content/10 max-h-[75vh] overflow-y-auto'>
                  {[...selectedCountries].sort().map((country) => {
                    const countryLeagues = leagues.filter((l) => l.country === country)
                    const isCountryExpanded = expandedCountry === country
                    
                    return (
                      <div key={country}>
                        {/* País header */}
                        <button
                          type='button'
                          className='w-full flex items-center justify-between p-2 hover:bg-base-200 transition-colors text-left'
                          onClick={() => setExpandedCountry(isCountryExpanded ? null : country)}
                        >
                          <div className='flex items-center gap-2'>
                            <span className='text-base'>{isCountryExpanded ? '▼' : '▶'}</span>
                            <span className='font-semibold text-sm'>{country}</span>
                            <span className='text-xs opacity-50'>
                              ({countryLeagues.length} {countryLeagues.length === 1 ? 'liga' : 'ligas'})
                            </span>
                          </div>
                        </button>
                        
                        {/* Ligas */}
                        {isCountryExpanded && (
                          <div className='bg-base-200/50'>
                            {countryLeagues.sort((a, b) => a.name.localeCompare(b.name)).map((league) => {
                              const isLeagueExpanded = expandedLeagueId === league.id
                              
                              return (
                                <div key={league.id} className='border-t border-base-content/10'>
                                  {/* Liga header */}
                                  <button
                                    type='button'
                                    className='w-full flex items-center justify-between p-2 pl-8 hover:bg-base-300 transition-colors text-left'
                                    onClick={() => setExpandedLeagueId(isLeagueExpanded ? null : league.id)}
                                  >
                                    <div className='flex items-center gap-2'>
                                      <span className='text-sm'>{isLeagueExpanded ? '▼' : '▶'}</span>
                                      <span className='font-medium text-sm'>{league.name}</span>
                                      <span className='text-xs opacity-50'>
                                        ({league.teams.length} times)
                                      </span>
                                    </div>
                                  </button>
                                  
                                  {/* Times */}
                                  {isLeagueExpanded && (
                                    <div className='bg-base-100'>
                                      {league.teams.sort((a, b) => a.name.localeCompare(b.name)).map((team) => {
                                        const isSelected = teamId === team.id && selectedLeagueId === league.id
                                        
                                        return (
                                          <button
                                            key={team.id}
                                            type='button'
                                            className={`w-full flex items-center justify-between gap-2 p-1.5 pl-12 hover:bg-base-200 transition-colors text-left border-t border-base-content/5 ${
                                              isSelected ? 'bg-success/10 border-l-4 border-l-success' : ''
                                            }`}
                                            onClick={() => {
                                              setSelectedLeagueId(league.id)
                                              setTeamId(team.id)
                                            }}
                                          >
                                            <div className='flex items-center gap-2 flex-1'>
                                              <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                isSelected ? 'border-success bg-success' : 'border-base-content/30'
                                              }`}>
                                                {isSelected && (
                                                  <div className='w-1.5 h-1.5 bg-success-content rounded-full' />
                                                )}
                                              </div>
                                              <span className={`text-sm ${isSelected ? 'font-semibold text-success' : ''}`}>
                                                {team.name}
                                              </span>
                                            </div>
                                            {team.budget !== undefined && (
                                              <span className='text-xs opacity-60 pr-2'>
                                                R$ {(team.budget / 1_000_000).toFixed(1)}M
                                              </span>
                                            )}
                                          </button>
                                        )
                                      })}
                                    </div>
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
            )}

            {/* ── Passo 4: Confirmar ── */}
            {step === 4 && (
              <div className='flex flex-col gap-4'>
                <p className='text-sm opacity-70'>
                  Confirme os dados antes de iniciar sua carreira.
                </p>

                <div className='bg-base-100 border border-base-content/20 rounded-md p-5 flex flex-col gap-5'>
                  <div>
                    <div className='text-xs opacity-60 uppercase tracking-wide mb-1'>Técnico</div>
                    <div className='text-lg font-semibold text-primary'>{coachName}</div>
                  </div>

                  <div>
                    <div className='text-xs opacity-60 uppercase tracking-wide mb-1'>
                      Liga principal
                    </div>
                    <div className='text-lg font-semibold text-success'>{selectedLeague?.name}</div>
                    <div className='text-sm opacity-60'>{selectedMainCountry}</div>
                  </div>

                  <div>
                    <div className='text-xs opacity-60 uppercase tracking-wide mb-1'>Seu time</div>
                    <div className='text-lg font-semibold'>{selectedTeamName}</div>
                  </div>

                  <div>
                    <div className='text-xs opacity-60 uppercase tracking-wide mb-2'>
                      Países na simulação
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      {selectedCountries.map((c) => (
                        <span
                          key={c}
                          className='text-xs bg-base-300 rounded-sm px-2 py-1 border border-base-content/15'
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {backgroundLeagues.length > 0 && (
                    <div>
                      <div className='text-xs opacity-60 uppercase tracking-wide mb-2'>
                        Ligas em background
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        {backgroundLeagues.map((l) => (
                          <span
                            key={l.id}
                            className='text-xs bg-base-300 rounded-sm px-2 py-1 border border-base-content/15'
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error && <p className='text-sm text-error'>{error}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Rodapé com navegação ── */}
      {!loading && (
        <div className='sticky bottom-0 bg-base-300 border-t border-base-content/15 px-6 py-4 flex justify-between items-center'>
          <div>
            {step > 1 && (
              <button
                type='button'
                className='btn btn-ghost'
                onClick={() => setStep((step - 1) as Step)}
                disabled={busy}
              >
                ← Voltar
              </button>
            )}
          </div>

          <div>
            {step === 1 && (
              <button
                type='button'
                className='btn btn-primary'
                onClick={goToStep2}
                disabled={!coachName.trim()}
              >
                Próximo →
              </button>
            )}

            {step === 2 && (
              <button
                type='button'
                className='btn btn-primary'
                onClick={goToStep3}
                disabled={selectedCountries.length === 0}
              >
                Próximo →
              </button>
            )}

            {step === 3 && (
              <button
                type='button'
                className='btn btn-primary'
                onClick={goToStep4}
                disabled={!selectedLeagueId || !teamId}
              >
                Próximo →
              </button>
            )}

            {step === 4 && (
              <button
                type='button'
                className='btn btn-success'
                onClick={() => void handleStart()}
                disabled={busy}
              >
                {busy ? (
                  <span className='loading loading-spinner loading-sm' />
                ) : (
                  '✅ Iniciar Carreira'
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NewGame
