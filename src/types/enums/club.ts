/**
 * Níveis de reputação do clube
 * Categoriza-o com base em sua visibilidade, sucesso e reconhecimento no cenário do futebol.
 *
 * @enum {number}
 */
export enum ClubReputation {
  /** Clube conhecido principalmente em sua região, cidade ou comunidade local. - ex.: Inter de Minas (MG) */
  LOCAL = 1,
  /** Clube competitivo em nível estadual. - ex.: Athletic Club (MG) */
  STATE = 2,
  /** Clube com grande relevância em seu país. - ex.: Botafogo */
  NATIONAL = 3,
  /** Clube de destaque em seu continente. - ex.: Boca Juniors */
  CONTINENTAL = 4,
  /** Clube de destaque em nível internacional. - ex.: Real Madrid */
  INTERNATIONAL = 5,
}
