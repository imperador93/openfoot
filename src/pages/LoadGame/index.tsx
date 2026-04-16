import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { listSaves, loadCareer, deleteSave, type SaveMetadata } from '../../libs/tauri/saves'

const LoadGame = () => {
  const navigate = useNavigate()
  const [saves, setSaves] = useState<SaveMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingFile, setLoadingFile] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSavesList()
  }, [])

  const loadSavesList = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listSaves()
      setSaves(list)
    } catch (err) {
      setError(`Erro ao listar saves: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLoad = async (filename: string) => {
    setLoadingFile(filename)
    setError('')
    try {
      await loadCareer(filename)
      navigate('/career', { replace: true })
    } catch (err) {
      setError(`Erro ao carregar: ${err instanceof Error ? err.message : String(err)}`)
      setLoadingFile(null)
    }
  }

  const handleDelete = async (filename: string) => {
    if (!confirm('Deseja realmente deletar este save?')) return
    
    try {
      await deleteSave(filename)
      await loadSavesList()
    } catch (err) {
      setError(`Erro ao deletar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('pt-BR')
  }

  return (
    <div className='min-h-svh bg-base-200 p-6'>
      <div className='max-w-4xl mx-auto'>
        <div className='flex items-center justify-between mb-6'>
          <h1 className='text-3xl font-bold'>Carregar Jogo</h1>
          <button
            type='button'
            className='btn btn-ghost'
            onClick={() => navigate('/')}
          >
            Voltar
          </button>
        </div>

        {error && (
          <div className='alert alert-error mb-4'>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className='flex justify-center items-center py-20'>
            <span className='loading loading-spinner loading-lg'></span>
          </div>
        ) : saves.length === 0 ? (
          <div className='bg-base-100 rounded-lg p-12 text-center'>
            <p className='text-lg opacity-60 mb-4'>Nenhum save encontrado</p>
            <button
              type='button'
              className='btn btn-primary'
              onClick={() => navigate('/new-game')}
            >
              Iniciar Nova Carreira
            </button>
          </div>
        ) : (
          <div className='space-y-3'>
            {saves.map((save) => (
              <div
                key={save.name}
                className='bg-base-100 rounded-lg p-4 flex items-center justify-between hover:bg-base-200 transition-colors'
              >
                <div className='flex-1'>
                  <div className='flex items-center gap-3 mb-2'>
                    <h3 className='font-bold text-lg'>{save.coachName}</h3>
                    <span className='badge badge-primary'>{save.leagueId}</span>
                  </div>
                  <div className='text-sm opacity-70 space-y-1'>
                    <p>Rodada {save.currentRound}</p>
                    <p>Moral: <span className={save.morale >= 50 ? 'text-success' : save.morale >= 25 ? 'text-warning' : 'text-error'}>{save.morale}%</span></p>
                    <p className='text-xs'>{formatDate(save.timestamp)}</p>
                  </div>
                </div>

                <div className='flex gap-2'>
                  <button
                    type='button'
                    className='btn btn-primary'
                    onClick={() => void handleLoad(save.name)}
                    disabled={loadingFile !== null}
                  >
                    {loadingFile === save.name ? (
                      <span className='loading loading-spinner loading-sm'></span>
                    ) : (
                      'Carregar'
                    )}
                  </button>
                  <button
                    type='button'
                    className='btn btn-ghost btn-sm'
                    onClick={() => void handleDelete(save.name)}
                    disabled={loadingFile !== null}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LoadGame
