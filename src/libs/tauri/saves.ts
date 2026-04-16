import { invoke } from '@tauri-apps/api/core'
import type { CareerSnapshot } from './career'

export interface SaveMetadata {
  name: string
  coachName: string
  teamName: string
  leagueId: string
  currentRound: number
  morale: number
  timestamp: number
}

export const saveCareer = async (saveName: string): Promise<string> =>
  invoke<string>('save_career', { saveName })

export const loadCareer = async (filename: string): Promise<CareerSnapshot> =>
  invoke<CareerSnapshot>('load_career', { filename })

export const listSaves = async (): Promise<SaveMetadata[]> =>
  invoke<SaveMetadata[]>('list_saves')

export const deleteSave = async (filename: string): Promise<void> =>
  invoke('delete_save', { filename })
