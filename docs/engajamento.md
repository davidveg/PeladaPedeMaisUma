# Engajamento por histórico esportivo

As conquistas, retrospectivas pessoais e resenhas da rodada são projeções automáticas dos dados oficiais. Elas não alteram overall, balanceamento ou momentum e não exigem lançamentos administrativos adicionais.

## Resenha da rodada

Cada resultado do Modo Carreira recebe uma resenha com:

- placar e equipe vencedora;
- líderes de gols e assistências, quando a súmula detalhada estiver ativa;
- Man of the Match, após o encerramento da votação;
- recorde de gols em uma partida;
- conquistas liberadas naquela rodada.

A resenha aparece nos detalhes da escalação no site e no aplicativo e possui compartilhamento nativo. Enquanto a votação estiver aberta, o texto é atualizado automaticamente quando o resultado final da votação for consolidado.

## Conquistas

O perfil do jogador exibe uma coleção calculada sobre todo o histórico:

- estreia e marcos de partidas;
- primeira vitória e marcos de vitórias;
- primeiro gol, primeira assistência e marcos das duas contribuições;
- hat-trick e três assistências no mesmo jogo;
- sequências de três e cinco vitórias;
- primeiro Man of the Match;
- primeira seleção e primeiro prêmio de jogador do mês;
- pódios das temporadas encerradas.

Os próximos objetivos de jogos, vitórias, gols e assistências mostram o progresso atual. Correções no histórico são refletidas no próximo carregamento, mantendo as conquistas coerentes com os registros oficiais.

## Retrospectiva pessoal

A retrospectiva considera somente a temporada corrente armazenada no snapshot das partidas. Ela apresenta jogos, vitórias, empates, derrotas, aproveitamento, gols, assistências, melhor sequência de vitórias, reconhecimentos e parceria mais frequente. O resumo pode ser compartilhado pelo site ou pelo aplicativo.

Jogadores sem partidas na temporada recebem um estado vazio informativo. Métricas dependentes da súmula ou das votações permanecem zeradas quando esses módulos não produziram dados oficiais.

## Implementação

- `lib/player-engagement.ts`: cálculos puros e modelos públicos;
- `lib/player-engagement-store.ts`: leitura batelada do histórico e das premiações;
- `GET /api/member-profile`: inclui `engagement` para o jogador associado;
- `GET /api/separations` e `GET /api/mobile/separations`: incluem `career.recap` nas partidas com resultado.

