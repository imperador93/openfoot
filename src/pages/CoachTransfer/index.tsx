import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { listCoachJobOffers, acceptCoachJobOffer, type ClubOffer } from '@/libs/tauri/career'

export default function CoachTransfer() {
  const navigate = useNavigate()
  const [offers, setOffers] = useState<ClubOffer[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const jobOffers = await listCoachJobOffers()
        setOffers(jobOffers)
      } catch (err) {
        setError(`Erro ao carregar propostas: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    void fetchOffers()
  }, [])

  const handleAcceptOffer = async () => {
    if (!selectedTeam) return

    setLoading(true)
    setError(null)
    try {
      const snapshot = await acceptCoachJobOffer(selectedTeam)
      const selectedOffer = offers.find(o => o.teamId === selectedTeam)
      alert(`Transferência para ${selectedOffer?.teamName} concluída! Boa sorte no novo desafio!`)
      navigate('/career', { replace: true })
    } catch (err) {
      setError(`Erro na transferência: ${err}`)
      setLoading(false)
    }
  }

  return (
    <div className='min-h-svh bg-base-200 flex items-center justify-center p-6'>
      <div className='bg-base-100 rounded-lg shadow-2xl p-8 max-w-2xl w-full'>
        <div className='text-center mb-8'>
          <h1 className='text-4xl font-bold mb-4 text-error'>VOCÊ FOI DEMITIDO!</h1>
          <p className='text-lg opacity-70'>
            A diretoria perdeu a confiança no seu trabalho. Mas você recebeu propostas de outros clubes:
          </p>
        </div>

        {error && (
          <div className='alert alert-error mb-6'>
            <span>{error}</span>
          </div>
        )}

        {loading && offers.length === 0 ? (
          <div className='text-center py-12'>
            <span className='loading loading-spinner loading-lg'></span>
            <p className='mt-4 text-lg'>Carregando propostas...</p>
          </div>
        ) : offers.length === 0 ? (
          <div className='text-center py-12'>
            <p className='text-lg mb-4'>Nenhuma proposta disponível no momento.</p>
            <button
              type='button'
              className='btn btn-primary'
              onClick={() => navigate('/')}
            >
              Voltar ao Menu
            </button>
          </div>
        ) : (
          <>
            <div className='space-y-3 mb-6 max-h-96 overflow-y-auto'>
              {offers.map((offer) => (
                <div
                  key={offer.teamId}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedTeam === offer.teamId
                      ? 'border-primary bg-primary/10'
                      : 'border-base-content/20 hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedTeam(offer.teamId)}
                >
                  <div className='flex items-center  justify-between'>
                    <div className='flex-1'>
                      <h3 className='text-xl font-bold'>{offer.teamName}</h3>
                      <p className='text-sm opacity-70'>{offer.leagueId}</p>
                    </div>
                    <div className='text-right'>
                      <div className='text-sm opacity-70'>Posição: <span className='font-semibold'>{offer.currentPosition}º</span></div>
                      <div className='text-sm opacity-70'>Moral: <span className={`font-semibold ${offer.morale >= 50 ? 'text-success' : offer.morale >= 25 ? 'text-warning' : 'text-error'}`}>{offer.morale}%</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className='flex gap-3'>
              <button
                type='button'
                className='btn btn-primary flex-1'
                onClick={() => void handleAcceptOffer()}
                disabled={!selectedTeam || loading}
              >
                {loading ? 'Transferindo...' : 'Aceitar Proposta'}
              </button>
              <button
                type='button'
                className='btn btn-ghost'
                onClick={() => navigate('/')}
              >
                Abandonar Carreira
              </button>
            </div>
          </>
        )}

        <div className='mt-6 p-4 bg-warning/20 rounded-lg'>
          <p className='text-sm text-center'>
            💡 <strong>Dica:</strong> Clubes em situação difícil oferecem um desafio maior, mas também uma recompense maior se você conseguir reverter!
          </p>
        </div>
      </div>
    </div>
  )
}
