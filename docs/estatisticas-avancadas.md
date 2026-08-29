# Estatísticas avançadas

O módulo de estatísticas avançadas usa apenas partidas com resultado registrado no Modo Carreira e participantes presentes no snapshot da separação. Gols, assistências e votos entram somente quando existem nas tabelas oficiais. Ausência de informação não é convertida em zero: a interface mostra **Dados insuficientes** ou recalibra apenas os componentes disponíveis.

A implementação está separada em quatro camadas:

- `lib/statistics-data.ts`: consulta batelada dos dados brutos;
- `lib/statistics-engine.ts`: cálculos puros, sem acesso ao banco ou à interface;
- `app/api/public-statistics/advanced/route.ts`: filtros e entrega da API;
- `app/estatisticas/avancadas/`: dashboard web; o aplicativo possui uma visualização compacta no fluxo **Meu card**.

As fórmulas próprias são versionadas por `STATISTICS_VERSION`, em `lib/statistics-engine-config.ts`. As novas separações também guardam `balanceAlgorithmVersion` no snapshot para permitir comparações futuras.

## Dados canônicos

| Informação | Origem | Tratamento de ausência |
| --- | --- | --- |
| Participação e equipe | `team_separations.snapshot` | jogador não entra na partida |
| Placar e vencedor | `career_matches` | partida não entra no conjunto canônico |
| Gols e assistências | `career_match_contributions` | componente ofensivo usa somente eventos existentes |
| Avaliações | `career_votes`, após encerramento | componente é removido do IPI |
| Temporada | `career_matches.config_snapshot` | temporada 1 para snapshots legados |
| Força prevista | métricas do snapshot da separação | qualidade prevista fica indisponível |
| Ajuste manual | `team_separations.manually_adjusted` | excluído da correlação do algoritmo |

## IPI — Índice de Performance Individual

**Intervalo:** 0 a 100.

Para cada jogador, o motor calcula seis componentes na mesma escala:

1. resultado: aproveitamento, em que vitória vale 3 pontos e empate vale 1;
2. impacto: percentil do saldo por partida entre jogadores da mesma posição;
3. ofensivo: percentil de gols e assistências por partida, com pesos próprios da posição;
4. consistência;
5. forma: aproveitamento na janela recente selecionada;
6. avaliação: saldo normalizado de pontos positivos e negativos recebidos nas votações encerradas.

O valor bruto é a média ponderada dos componentes disponíveis:

```text
IPI_bruto = Σ(componente × peso_da_posição) / Σ(pesos_disponíveis)
```

Os pesos centralizados são:

| Posição | Resultado | Impacto | Ofensivo | Consistência | Forma | Votação |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Goleiro | 27% | 31% | 2% | 18% | 14% | 8% |
| Defesa | 22% | 28% | 8% | 17% | 15% | 10% |
| Meio-campo | 18% | 20% | 22% | 15% | 15% | 10% |
| Ataque | 17% | 15% | 30% | 13% | 15% | 10% |

O componente ofensivo distribui gols/assistências assim: goleiro 20/80, defesa 45/55, meio-campo 35/65 e ataque 70/30.

Para reduzir extremos de amostras pequenas, o IPI publicado aproxima o valor bruto de 50 até 15 partidas:

```text
confiabilidade = min(1, partidas / 15)
IPI = 50 + confiabilidade × (IPI_bruto - 50)
```

Confiança: **Baixa** abaixo de 5 partidas, **Média** entre 5 e 14 e **Alta** a partir de 15.

Limitações: não há minutos, substituições, desarmes, defesas ou finalizações. Por isso o cálculo representa a partida inteira e usa somente os sinais atualmente armazenados.

## Estatística +/-

Para cada partida em que o jogador participou:

```text
+/- da partida = gols do seu time - gols do adversário
+/- total = soma dos saldos das partidas
+/- por jogo = +/- total / partidas
```

Também são exibidos gols pró e contra enquanto o jogador participou. Não há cálculo por minuto porque o sistema não registra tempo em campo.

## Forma recente

Janelas disponíveis: 5, 10 ou 20 partidas, sempre em ordem cronológica. São exibidos V/E/D, aproveitamento, gols, assistências e saldo. A tendência compara a janela recente com as partidas anteriores do mesmo filtro:

```text
tendência = aproveitamento_recente - aproveitamento_das_partidas_anteriores
```

Se não houver uma base anterior, a tendência é **Dados insuficientes**, evitando comparar uma amostra consigo mesma.

## Consistência

Cada partida recebe uma pontuação observada de 0 a 100, formada por resultado, saldo, gols e assistências. A consistência usa o desvio-padrão dessas pontuações:

```text
consistência_bruta = limitar(100 - 2 × desvio_padrão, 0, 100)
consistência = 50 + min(1, partidas / 15) × (consistência_bruta - 50)
```

São necessárias ao menos 3 partidas. A aproximação de 50 evita regularidade extrema em amostras pequenas.

## Impacto com e sem o jogador

**Com o jogador** considera os resultados do time em que ele participou. **Sem o jogador** considera as observações de equipe nas partidas válidas do mesmo filtro em que ele não esteve. São comparados aproveitamento, gols pró/jogo, gols contra/jogo e saldo/jogo.

```text
impacto_aproveitamento = aproveitamento_com - aproveitamento_sem
impacto_saldo = saldo_médio_com - saldo_médio_sem
```

É uma associação descritiva. Não demonstra que o jogador causou a diferença e pode ser afetada por adversários, companheiros, frequência e tamanho da amostra.

## Duplas e índice de entrosamento

Para cada par que atuou no mesmo time são calculados jogos, V/E/D, aproveitamento, gols pró/contra, saldo e saldo por jogo. O filtro padrão exige 3 jogos juntos.

```text
entrosamento_bruto = 70% × aproveitamento + 30% × limitar(50 + 10 × saldo_por_jogo)
confiabilidade = jogos / (jogos + 5)
entrosamento = 50 + confiabilidade × (entrosamento_bruto - 50)
```

**Intervalo:** 0 a 100. A regularização impede que uma dupla com uma partida e 100% apareça automaticamente acima de uma parceria consolidada.

## Qualidade do balanceamento

São usadas as forças dos times-base armazenadas no snapshot da separação. Separações ajustadas manualmente não entram na correlação entre previsão e resultado.

O dashboard apresenta:

- equilíbrio médio previsto;
- diferença média absoluta do placar;
- percentual de jogos decididos por um gol;
- percentual de empates;
- percentual de goleadas, configuradas como diferença de 4 ou mais gols;
- correlação de Pearson entre vantagem prevista e diferença observada.

O erro médio de placar não é exibido porque o algoritmo atual estima força/custo de equilíbrio, mas não produz um placar esperado calibrado. Inventar essa conversão daria uma precisão falsa.

## Rankings por posição e recordes

Os rankings respeitam a posição dominante observada nos snapshots. Os pesos do IPI adaptam a comparação para Goleiro, Defesa, Meio-campo e Ataque.

As sequências são percorridas cronologicamente e incluem vitórias, invencibilidade, derrotas, partidas marcando e partidas assistindo. Também são detectados gols e assistências em uma partida, maior goleada, partida com mais gols, maior saldo acumulado, aproveitamento, IPI e consistência.

## Filtros, custo e privacidade

Filtros disponíveis: período, temporada, posição, mínimo de partidas, janela recente e mínimo de jogos da dupla. A rota usa quatro consultas bateladas e índices por data/status, sem consultas N+1. As métricas são calculadas sob demanda; isso evita persistir valores derivados e simplifica a evolução das fórmulas no volume atual.

A rota segue a mesma visibilidade da página pública de estatísticas existente e retorna somente campos públicos dos jogadores. Nenhuma credencial, e-mail, observação privada ou identificador de conta é exposto.

## Evolução recomendada

Para uma versão futura, vale começar a armazenar minutos e substituições, finalizações, desarmes, defesas do goleiro, clean sheets e uma previsão calibrada de gols. Esses eventos permitiriam +/- por tempo em campo, métricas defensivas mais específicas e erro real de previsão.
