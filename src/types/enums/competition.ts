/**
 * Tipos de participantes na competição
 * Indica se a competição é disputada por clubes ou seleções nacionais.
 *
 * @enum {string}
 */
export enum CompetitionParticipantType {
  /** Competição entre clubes. - ex.: Brasileirão */
  CLUB = 'CLUB',
  /** Competição entre seleções nacionais. - ex.: Copa do Mundo */
  NATIONAL = 'NATIONAL',
}

/**
 * Escopo da competição
 * Indica a abrangência geográfica e o nível de participação dos clubes ou seleções envolvidas.
 *
 * @enum {string}
 */
export enum CompetitionScope {
  /** Competição disputada por clubes dentro de um estado ou região específica. - ex.: Campeonato Mineiro */
  STATE = 'STATE',
  /** Competição disputada por clubes de um país inteiro. - ex.: Campeonato Brasileiro */
  NATIONAL = 'NATIONAL',
  /** Competição disputada por clubes ou seleções de múltiplos países dentro de um continente. - ex.: Copa Libertadores e Copa América */
  CONTINENTAL = 'CONTINENTAL',
  /** Competição disputada por clubes ou seleções de múltiplos países em diferentes continentes. - ex.: Mundial de Clubes e Copa do Mundo */
  INTERNATIONAL = 'INTERNATIONAL',
}
