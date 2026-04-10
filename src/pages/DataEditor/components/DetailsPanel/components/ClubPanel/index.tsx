import type { ClubDetails } from '../../types'
import dayjs from 'dayjs'
import IconSeat from '~icons/mdi/seat'
import IconStadium from '~icons/mdi/stadium-variant'
import IconTshirtCrew from '~icons/mdi/tshirt-crew'
import IconWhistle from '~icons/mdi/whistle'

import Table from '@/components/Table'
import { useIntl } from '@/hooks/useIntl'
import { useTheme } from '@/hooks/useTheme'
import type { Player } from '@/types/entities/player'
import { PlayerPosition } from '@/types/enums/player'
import { cn } from '@/utils/styles'

interface ClubPanelProps {
  club: ClubDetails
}

const POSITION_COLOR: Record<PlayerPosition, string> = {
  [PlayerPosition.GOALKEEPER]: 'bg-warning/20 text-warning',
  [PlayerPosition.DEFENDER]: 'bg-info/20 text-info',
  [PlayerPosition.SIDE_BACK]: 'bg-info/20 text-info',
  [PlayerPosition.MIDFIELDER]: 'bg-success/20 text-success',
  [PlayerPosition.FORWARD]: 'bg-error/20 text-error',
}

const RatingBar = ({
  label,
  value,
  max,
  displayValue,
}: {
  label: string
  value: number
  max: number
  displayValue?: string
}) => {
  const percentage = (value / max) * 100

  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-baseline justify-between'>
        <span className='text-[10px] font-semibold tracking-wider text-base-content/40 uppercase'>
          {label}
        </span>
        <span className='text-xs font-bold text-primary'>{displayValue ?? `${value}/${max}`}</span>
      </div>
      <div className='h-1.5 bg-base-300 rounded-full overflow-hidden'>
        <div
          className='h-full bg-primary rounded-full transition-all'
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

const ColorSwatch = ({ color, label }: { color: string; label: string }) => (
  <div className='flex items-center gap-1.5'>
    <div
      className='w-4 h-4 rounded-sm border border-base-content/20'
      style={{ backgroundColor: color }}
    />
    <span className='text-xs text-base-content/60'>{label}</span>
  </div>
)

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className='flex justify-between items-center py-1'>
    <span className='text-xs text-base-content/50'>{label}</span>
    <span className='text-xs font-medium text-base-content'>{value}</span>
  </div>
)

const SectionHeader = ({
  icon: Icon,
  title,
  badge,
}: {
  icon: React.ElementType
  title: string
  badge?: string
}) => (
  <div className='flex items-center gap-2 mb-2'>
    <Icon className='text-primary text-sm' />
    <h3 className='text-xs font-bold tracking-widest text-base-content uppercase m-0'>{title}</h3>
    {badge && (
      <span className='ml-auto text-[10px] font-medium text-base-content/50 bg-base-300 px-1.5 py-0.5 rounded-sm'>
        {badge}
      </span>
    )}
  </div>
)

const KitSlot = ({
  label,
  imageRef,
  fallback,
}: {
  label: string
  imageRef: string | null
  fallback: string
}) => (
  <div className='flex flex-col items-center gap-1.5'>
    <div className='w-14 h-14 rounded-sm bg-base-300 border border-base-content/10 flex items-center justify-center overflow-hidden'>
      {imageRef ? (
        <img src={imageRef} alt={label} className='w-full h-full object-cover' />
      ) : (
        <span className='text-[9px] text-base-content/30 text-center leading-tight'>
          {fallback}
        </span>
      )}
    </div>
    <span className='text-[10px] text-base-content/50'>{label}</span>
  </div>
)

const PlayerRow = ({ player, td }: { player: Player; td: (id: string) => string }) => {
  const age = player.birthdate ? dayjs().diff(dayjs(player.birthdate), 'year') : '—'

  return (
    <tr>
      <td>
        <span className='font-medium'>{player.name}</span>
        {player.specialSkills.length > 0 && (
          <div className='flex gap-0.5 mt-0.5'>
            {player.specialSkills.map((skill) => (
              <span
                key={skill}
                className='text-[9px] bg-accent/15 text-accent px-1 py-px rounded-sm font-medium'
              >
                {td(`dataEditor.detailsPanel.clubPanel.specialSkills.${skill}`)}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className='text-center'>
        <span
          className={cn(
            'text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-sm',
            POSITION_COLOR[player.position]
          )}
        >
          {player.position}
        </span>
      </td>
      <td className='text-center'>{age}</td>
      <td className='text-center'>{td(`static.countries.${player.country}.countryName`)}</td>
      <td className='text-center'>
        {td(`dataEditor.detailsPanel.clubPanel.feet.${player.dominantFoot}`)}
      </td>
      <td className='text-center'>
        {td(`dataEditor.detailsPanel.clubPanel.playerReputationLevels.${player.reputation}`)}
      </td>
    </tr>
  )
}

const ClubPanel = ({ club }: ClubPanelProps) => {
  const { t, td } = useIntl()
  const theme = useTheme({
    primary: club.primaryColor,
    secondary: club.secondaryColor,
    tertiary: club.tertiaryColor,
  })

  return (
    <div className='flex-1 flex flex-col overflow-y-auto bg-base-300' style={theme}>
      {/* ── Header ── */}
      <div className='p-5'>
        <div className='flex items-start gap-4'>
          <div
            className='w-16 h-16 rounded-sm flex items-center justify-center shrink-0 border border-base-content/10'
            style={{ backgroundColor: club.primaryColor }}
          >
            {club.logoRef ? (
              <img src={club.logoRef} alt={club.shortName} className='w-12 h-12 object-contain' />
            ) : (
              <span className='text-2xl font-black' style={{ color: club.secondaryColor }}>
                {club.abbrName}
              </span>
            )}
          </div>

          <div className='flex-1 min-w-0'>
            <h2 className='text-lg font-bold text-base-content m-0 leading-tight'>{club.name}</h2>
            <div className='flex items-center gap-2 mt-1'>
              <span className='text-xs text-base-content/50'>{club.shortName}</span>
              <span className='text-base-content/20'>·</span>
              <span className='text-xs text-base-content/50'>
                {td(`static.countries.${club.country}.countryName`)}
              </span>
              {club.state && (
                <>
                  <span className='text-base-content/20'>·</span>
                  <span className='text-xs text-base-content/50'>
                    {td(`static.brazilianStates.${club.state}.name`)}
                  </span>
                </>
              )}
            </div>

            <div className='flex items-center gap-3 mt-2'>
              <ColorSwatch
                color={club.primaryColor}
                label={t('dataEditor.detailsPanel.clubPanel.primaryColor')}
              />
              <ColorSwatch
                color={club.secondaryColor}
                label={t('dataEditor.detailsPanel.clubPanel.secondaryColor')}
              />
              {club.tertiaryColor && (
                <ColorSwatch
                  color={club.tertiaryColor}
                  label={t('dataEditor.detailsPanel.clubPanel.tertiaryColor')}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='h-px bg-base-content/10 mx-5' />

      {/* ── Ratings ── */}
      <div className='p-5 flex flex-col gap-3'>
        <RatingBar
          label={t('dataEditor.detailsPanel.clubPanel.reputation')}
          value={club.reputation}
          max={5}
          displayValue={td(`dataEditor.detailsPanel.clubPanel.reputationLevels.${club.reputation}`)}
        />
        <RatingBar
          label={t('dataEditor.detailsPanel.clubPanel.competitivePower')}
          value={club.competitivePower}
          max={25}
        />
        <RatingBar
          label={t('dataEditor.detailsPanel.clubPanel.financialPower')}
          value={club.financialPower}
          max={25}
        />
      </div>

      {/* ── Uniforms ── */}
      <div className='px-5 pb-5'>
        <div className='bg-base-100 rounded-sm p-3 border border-base-content/5'>
          <SectionHeader
            icon={IconTshirtCrew}
            title={t('dataEditor.detailsPanel.clubPanel.uniformsSection')}
          />
          <div className='flex items-center gap-4 mt-2'>
            <KitSlot
              label={t('dataEditor.detailsPanel.clubPanel.primaryKit')}
              imageRef={club.primaryKitRef}
              fallback={t('dataEditor.detailsPanel.clubPanel.noKit')}
            />
            <KitSlot
              label={t('dataEditor.detailsPanel.clubPanel.secondaryKit')}
              imageRef={club.secondaryKitRef}
              fallback={t('dataEditor.detailsPanel.clubPanel.noKit')}
            />
            {club.tertiaryKitRef !== undefined && (
              <KitSlot
                label={t('dataEditor.detailsPanel.clubPanel.tertiaryKit')}
                imageRef={club.tertiaryKitRef}
                fallback={t('dataEditor.detailsPanel.clubPanel.noKit')}
              />
            )}
            <KitSlot
              label={t('dataEditor.detailsPanel.clubPanel.goalkeeperKit')}
              imageRef={club.goalkeeperKitRef}
              fallback={t('dataEditor.detailsPanel.clubPanel.noKit')}
            />
          </div>
        </div>
      </div>

      {/* ── Stadium & Coach ── */}
      <div className='grid grid-cols-2 gap-2 px-5 pb-5'>
        <div className='bg-base-100 rounded-sm p-3 border border-base-content/5'>
          <SectionHeader
            icon={IconStadium}
            title={t('dataEditor.detailsPanel.clubPanel.stadiumSection')}
          />
          <div className='flex flex-col gap-0.5 mt-1'>
            <InfoRow
              label={t('dataEditor.detailsPanel.clubPanel.stadiumName')}
              value={club.stadium.name}
            />
            {club.stadium.nickname && (
              <InfoRow
                label={t('dataEditor.detailsPanel.clubPanel.stadiumNickname')}
                value={club.stadium.nickname}
              />
            )}
            <InfoRow
              label={t('dataEditor.detailsPanel.clubPanel.stadiumCapacity')}
              value={
                <span className='flex items-center gap-1'>
                  <IconSeat className='text-[10px] text-base-content/40' />
                  {club.stadium.capacity.toLocaleString('pt-BR')}
                </span>
              }
            />
          </div>
        </div>

        <div className='bg-base-100 rounded-sm p-3 border border-base-content/5'>
          <SectionHeader
            icon={IconWhistle}
            title={t('dataEditor.detailsPanel.clubPanel.coachSection')}
          />
          {club.coach ? (
            <div className='flex flex-col gap-0.5 mt-1'>
              <InfoRow
                label={t('dataEditor.detailsPanel.clubPanel.coachName')}
                value={club.coach.name}
              />
              <InfoRow
                label={t('dataEditor.detailsPanel.clubPanel.coachCountry')}
                value={td(`static.countries.${club.coach.country}.countryName`)}
              />
              {club.coach.favoriteTactic && (
                <InfoRow
                  label={t('dataEditor.detailsPanel.clubPanel.coachTactic')}
                  value={
                    <span className='font-mono text-primary'>{club.coach.favoriteTactic}</span>
                  }
                />
              )}
              <InfoRow
                label={t('dataEditor.detailsPanel.clubPanel.coachReputation')}
                value={td(
                  `dataEditor.detailsPanel.clubPanel.coachReputationLevels.${club.coach.reputation}`
                )}
              />
            </div>
          ) : (
            <p className='text-xs text-base-content/40 italic m-0 mt-2'>
              {t('dataEditor.detailsPanel.clubPanel.noCoach')}
            </p>
          )}
        </div>
      </div>

      {/* ── Players ── */}
      <div className='px-5 pb-5 flex-1'>
        <SectionHeader
          icon={IconTshirtCrew}
          title={t('dataEditor.detailsPanel.clubPanel.playersSection')}
          badge={t('dataEditor.detailsPanel.clubPanel.playersCount', {
            count: club.players.length,
          })}
        />

        {club.players.length === 0 ? (
          <div className='flex items-center justify-center py-8'>
            <p className='text-xs text-base-content/40 italic m-0'>
              {t('dataEditor.detailsPanel.clubPanel.noPlayers')}
            </p>
          </div>
        ) : (
          <Table
            size='xs'
            zebra
            pinRows
            wrapperClassName='rounded-sm border border-base-content/5 bg-base-100'
          >
            <thead>
              <tr>
                <th>{t('dataEditor.detailsPanel.clubPanel.playerName')}</th>
                <th className='text-center'>
                  {t('dataEditor.detailsPanel.clubPanel.playerPosition')}
                </th>
                <th className='text-center'>{t('dataEditor.detailsPanel.clubPanel.playerAge')}</th>
                <th className='text-center'>
                  {t('dataEditor.detailsPanel.clubPanel.playerCountry')}
                </th>
                <th className='text-center'>{t('dataEditor.detailsPanel.clubPanel.playerFoot')}</th>
                <th className='text-center'>
                  {t('dataEditor.detailsPanel.clubPanel.playerReputation')}
                </th>
              </tr>
            </thead>
            <tbody>
              {club.players.map((player) => (
                <PlayerRow key={player.id} player={player} td={td} />
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}

export default ClubPanel
