/**
 * Níveis de reputação do treinador
 * Categoriza-o com base em seu desempenho, resultados e reconhecimento no mundo do futebol.
 *
 * @enum {number}
 */
export enum CoachReputation {
  /** Treinador com histórico de desempenho e resultados ruins. - ex.: Fernando Diniz */
  BAD = 1,
  /** Treinador com histórico de sucesso moderado e consistência. - ex.: Jorge Sampaoli */
  AVERAGE = 2,
  /** Treinador com histórico de desempenho sólido e resultados positivos. - ex.: Abel Ferreira */
  GOOD = 3,
  /** Treinador com histórico de alto desempenho e sucesso. - ex.: José Mourinho */
  EXCELLENT = 4,
  /** Treinador de elite com histórico de reconhecimento global por suas habilidades e conquistas excepcionais. - ex.: Pep Guardiola */
  WORLD_CLASS = 5,
}
