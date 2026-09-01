export const MODERATOR_PERMISSIONS = [
  "PLAYERS_MANAGE",
  "MATCHES_MANAGE",
  "MATCH_ATTENDANCE_MANAGE",
  "MATCHES_CANCEL",
  "SEPARATIONS_MANAGE",
  "MATCH_RESULTS_MANAGE",
  "CAREER_VOTES_MANAGE",
  "BALANCE_CONFIG_MANAGE",
  "FINANCE_MANAGE",
] as const;

export type ModeratorPermission = typeof MODERATOR_PERMISSIONS[number];

export const MODERATOR_PERMISSION_DEFINITIONS: ReadonlyArray<{
  key: ModeratorPermission;
  label: string;
  description: string;
}> = [
  { key: "PLAYERS_MANAGE", label: "Jogadores", description: "Cadastrar, editar, desativar e excluir jogadores, incluindo notas e atributos." },
  { key: "MATCHES_MANAGE", label: "Criar e editar partidas", description: "Criar partidas e alterar data, local, prazo e regras enquanto estiverem abertas." },
  { key: "MATCH_ATTENDANCE_MANAGE", label: "Presenças e lista de espera", description: "Confirmar presença ou ausência e administrar convidados na lista de espera." },
  { key: "MATCHES_CANCEL", label: "Cancelar partidas", description: "Cancelar partidas abertas e notificar os participantes." },
  { key: "SEPARATIONS_MANAGE", label: "Times e rascunhos", description: "Dentro das partidas, gerar, ajustar e publicar times, editar a ordem de chegada e trabalhar com rascunhos." },
  { key: "MATCH_RESULTS_MANAGE", label: "Súmula e resultado", description: "Registrar e corrigir placar, gols, assistências e o rascunho da súmula." },
  { key: "CAREER_VOTES_MANAGE", label: "Votações da partida", description: "Consultar votos, remover votos inválidos e encerrar uma votação antecipadamente." },
  { key: "BALANCE_CONFIG_MANAGE", label: "Pesos do algoritmo", description: "Alterar os pesos e limites usados pelo algoritmo de equilíbrio." },
  { key: "FINANCE_MANAGE", label: "Financeiro", description: "Visualizar o caixa e a inadimplência, configurar mensalidades e administrar cobranças, pagamentos, despesas, estornos e fechamentos." },
];

export function isModeratorPermission(value: unknown): value is ModeratorPermission {
  return MODERATOR_PERMISSIONS.includes(String(value) as ModeratorPermission);
}
