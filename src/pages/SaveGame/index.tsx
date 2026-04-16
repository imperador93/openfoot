import { useState } from 'react'
import { useNavigate } from 'react-router'
import { saveCareer } from '../../libs/tauri/saves'

export default function SaveGame() {
  const navigate = useNavigate()
  const [saveName, setSaveName] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!saveName.trim()) {
      setStatus('Digite um nome para o save')
      return
    }

    setSaving(true)
    setStatus('')

    try {
      const filename = await saveCareer(saveName.trim())
      setStatus(`Jogo salvo com sucesso! (${filename})`)
      setTimeout(() => {
        navigate('/career')
      }, 1500)
    } catch (error) {
      setStatus(
        `Erro ao salvar: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='min-h-svh bg-base-200 flex items-center justify-center p-4'>
      <div className='bg-base-100 rounded-lg shadow-xl p-8 w-full max-w-md'>
        <h1 className='text-3xl font-bold mb-6 text-center'>Salvar Jogo</h1>

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
              if (e.key === 'Enter') void handleSave()
            }}
            autoFocus
            maxLength={50}
          />
        </div>

        {status && (
          <div
            className={`alert ${
              status.includes('Erro') ? 'alert-error' : 'alert-success'
            } mb-4`}
          >
            {status}
          </div>
        )}

        <div className='flex gap-3'>
          <button
            type='button'
            className='btn btn-primary flex-1'
            onClick={() => void handleSave()}
            disabled={saving || !saveName.trim()}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            type='button'
            className='btn btn-ghost'
            onClick={() => navigate('/career')}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>

        <div className='mt-6 text-center text-sm opacity-60'>
          <p>O save será salvo automaticamente</p>
          <p>no diretório do jogo</p>
        </div>
      </div>
    </div>
  )
}
