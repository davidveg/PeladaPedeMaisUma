# Prompt para criação do aplicativo mobile — Pelada Pede Mais Uma

Crie um aplicativo mobile para **iOS e Android** integrado à aplicação web existente **Pelada Pede Mais Uma**, um sistema para organização de peladas, separação equilibrada de times, registro de partidas e acompanhamento dos jogadores.

O aplicativo deve ser uma versão simplificada e focada nos fluxos usados no dia da partida. Ele não deve reproduzir todo o painel administrativo web.

## Objetivo

Entregar um aplicativo nativo, rápido, responsivo e simples de operar pelo celular ou tablet, permitindo:

- login de jogadores e administradores;
- consulta das separações salvas;
- visualização do card do jogador associado ao login;
- criação de novas separações por administradores;
- organização da ordem de chegada de cada equipe;
- registro provisório e confirmação do resultado da partida;
- compartilhamento de times e votações pelo WhatsApp;
- ajuste administrativo apenas dos pesos do algoritmo.

## Tecnologia sugerida

Utilize **React Native com Expo e TypeScript**, preferencialmente com:

- Expo Router para navegação;
- TanStack Query para cache, carregamento e invalidação dos dados da API;
- React Hook Form e Zod para formulários e validações;
- Expo SecureStore para armazenar tokens de autenticação;
- Expo Linking/Sharing para links externos e compartilhamento;
- suporte a tema claro, acessibilidade e diferentes tamanhos de tela.

Se outra tecnologia for escolhida, justifique a decisão e mantenha uma única base de código para iOS e Android.

## Integração com a aplicação existente

A aplicação web existente continua sendo a fonte oficial dos dados e das regras de negócio. O aplicativo mobile deve consumir sua API, sem manter um banco de dados independente e sem recalcular regras importantes de forma divergente.

Configure a URL do servidor por variável de ambiente, por exemplo:

```env
EXPO_PUBLIC_API_BASE_URL=https://peladapedemaisuma.exemplo.com
```

Reutilize, adapte ou versione os contratos existentes, incluindo os fluxos equivalentes a:

- `/api/member-auth`: autenticação de jogador ou administrador;
- `/api/member-profile`: perfil e card do jogador associado;
- `/api/separations`: listar, criar e atualizar a ordem de chegada;
- `/api/players`: jogadores disponíveis para criação de times, somente para administradores;
- `/api/config`: pesos e parâmetros de equilíbrio, somente para administradores;
- `/api/career/draft`: rascunho de gols e assistências;
- `/api/career/match`: confirmação e eventual correção do resultado;
- `/api/career/admin`: informações administrativas do Modo Carreira;
- `/api/public-config`: configurações públicas necessárias para apresentação;
- `/api/health`: verificação de disponibilidade do servidor.

### Autenticação para o aplicativo nativo

O sistema web atualmente pode usar cookies `HttpOnly`. Para o aplicativo, implemente no backend uma autenticação própria para clientes nativos, caso necessário, sem remover a autenticação web existente:

- login deve retornar um access token de curta duração e um refresh token rotativo;
- tokens devem ser revogáveis no logout;
- refresh token deve ser armazenado com hash no servidor;
- tokens locais devem ser guardados somente no SecureStore/Keychain/Keystore;
- nunca guardar senha em armazenamento local;
- todas as rotas protegidas devem validar autenticação e papel no servidor;
- respostas `401` devem tentar uma única renovação da sessão e, se falhar, retornar ao login;
- a interface nunca deve ser a única barreira de autorização;
- manter auditoria das ações administrativas realizadas pelo aplicativo;
- documentar os novos contratos em OpenAPI ou documentação equivalente.

## Perfis e permissões

Existem dois perfis:

### Jogador comum

Pode:

- fazer login e logout;
- consultar separações salvas e seus detalhes;
- visualizar somente o card completo do jogador associado à sua conta.

Não pode:

- criar ou alterar separações;
- mudar ordem de chegada;
- registrar súmula, placar ou resultado;
- acessar jogadores administrativos;
- alterar os pesos do algoritmo.

Se a conta não estiver associada a um jogador, mostrar uma mensagem clara orientando que a associação deve ser concluída na aplicação web ou pelo administrador. Não permitir escolher outro jogador silenciosamente.

### Administrador

Pode utilizar todas as funções do jogador e também:

- criar uma nova separação;
- consultar os jogadores necessários para montar os times;
- ordenar a chegada dos jogadores separadamente no Time Azul e no Time Amarelo;
- editar e confirmar novamente a ordem de chegada;
- compartilhar a separação pelo WhatsApp;
- preencher e salvar o rascunho de gols e assistências;
- confirmar o resultado final;
- compartilhar pelo WhatsApp o link de votação dos melhores e piores da partida;
- alterar somente os pesos de Velocidade, Habilidade e Marcação.

## Navegação principal

Após o login, utilize uma navegação simples com as seguintes áreas:

1. **Separações** — disponível para todos;
2. **Meu card** — disponível quando o login estiver associado a um jogador;
3. **Nova separação** — somente para administradores;
4. **Configurações** — somente para administradores;
5. **Conta/Sair**.

Não exiba opções administrativas para usuários comuns, mas continue validando todas as permissões na API.

## Tela de login

- Campos de e-mail e senha.
- Botão para entrar.
- Exibir/ocultar senha.
- Manter a sessão de forma segura.
- Mensagens claras para credenciais inválidas, usuário desativado, servidor indisponível e sessão expirada.
- Exibir versão do aplicativo e ambiente conectado em uma área discreta.
- Não é necessário implementar cadastro, associação de jogador ou recuperação de senha no aplicativo nesta primeira versão; nesses casos, fornecer um link seguro para a aplicação web.

## Separações salvas

Exibir uma lista paginada ou com carregamento incremental contendo:

- título da pelada;
- data;
- local, quando disponível;
- Times Azul e Amarelo;
- placar, quando confirmado;
- status da partida e da votação;
- classificação de equilíbrio;
- indicação de resultado pendente ou confirmado.

Permitir atualização por gesto de arrastar para baixo e estados de carregamento, lista vazia e erro.

### Detalhes de uma separação

Mostrar:

- jogadores do Time Azul e Time Amarelo;
- foto pequena, nome, posição e overall registrado na separação;
- regras e pesos usados quando a separação foi gerada;
- classificação do equilíbrio;
- placar confirmado;
- gols, assistências e gols contra, se essa funcionalidade estiver habilitada;
- situação da votação;
- resultados dos destaques, quando a votação estiver encerrada;
- ordem de chegada de cada time, quando preenchida.

Para usuários comuns, a tela é somente leitura.

Para administradores, disponibilize as ações descritas abaixo.

## Compartilhar separação pelo WhatsApp

Na tela da separação, o administrador deve poder compartilhar uma mensagem bem formatada contendo:

- título e data da partida;
- lista do Time Azul;
- lista do Time Amarelo;
- placar, se já confirmado;
- link público HTTPS da separação.

Use o compartilhamento nativo e ofereça o WhatsApp quando instalado. Preserve emojis, acentos e quebras de linha. O link deve ficar isolado em sua própria linha e nunca pode apontar para `localhost` ou `127.0.0.1`.

## Nova separação — somente administradores

Implemente um fluxo em etapas:

### 1. Importar confirmações

- Campo multilinha para colar a lista do WhatsApp.
- Reconhecer as seções Goleiros, Mensalistas e Convidados.
- Considerar somente jogadores confirmados.
- Identificar jogadores existentes por nome, apelido e aliases.
- Quando houver nome não reconhecido ou ambíguo, interromper o avanço e orientar o administrador a usar a aplicação web para cadastrar ou corrigir o jogador; o aplicativo não precisa administrar cadastros nesta versão.

### 2. Revisar jogadores

- Exibir os jogadores reconhecidos, tipo, posição e atributos relevantes.
- Permitir incluir ou remover jogadores da seleção antes do cálculo.
- Exibir quantidade total e avisos de lista ímpar ou posições desequilibradas.

### 3. Gerar times

- Utilizar a mesma regra oficial do servidor para equilibrar Time Azul e Time Amarelo.
- Considerar Velocidade, Habilidade, Marcação, atributos específicos de goleiro e Momentum conforme as configurações existentes.
- Não copiar uma versão independente do algoritmo para o aplicativo. Exponha um endpoint transacional no backend para processar a lista e devolver uma proposta.
- Permitir uma nova tentativa de geração e ajuste manual de jogadores entre os times, respeitando as validações existentes.

### 4. Confirmar e salvar

- Mostrar os dois times, médias e indicador de equilíbrio.
- Solicitar confirmação antes de gravar.
- Salvar a separação na mesma base usada pelo site.
- Após salvar, abrir a tela de detalhes da nova separação.
- Impedir envios duplicados usando idempotency key.

## Ordem de chegada — somente administradores

- Manter uma lista independente para o Time Azul e outra para o Time Amarelo.
- Permitir reorganização por arrastar e soltar, com botões acessíveis para subir e descer como alternativa.
- A primeira posição representa quem chegou primeiro; a última, quem chegou por último.
- Solicitar confirmação ao salvar.
- Depois de confirmada, a ordem deve continuar editável e poder ser salva novamente.
- Atualizar os dados da separação após cada gravação.

## Rascunho de gols e assistências — somente administradores

Disponibilizar quando o Modo Carreira e o registro de gols/assistências estiverem ativos.

- Adicionar eventos de gol durante a partida.
- Para cada evento, selecionar o time beneficiado, autor do gol e assistência opcional.
- Permitir marcar `GC` para gol contra.
- Em gol contra, selecionar o jogador adversário que marcou contra, não permitir assistência e não contabilizar o gol no histórico pessoal desse jogador.
- Toda assistência precisa estar associada a um gol válido.
- Exibir um evento por linha, com Azul e Amarelo visualmente diferenciados e `GC` destacado em vermelho.
- Calcular o placar provisório automaticamente pela quantidade de eventos.
- Permitir salvar e continuar depois.
- Não transformar o rascunho em resultado oficial sem confirmação explícita.

## Confirmação do resultado — somente administradores

- Carregar automaticamente o placar e os eventos existentes no rascunho.
- Permitir revisão antes da confirmação.
- Validar que a quantidade de eventos corresponde ao placar quando gols e assistências estiverem ativos.
- Permitir gols sem assistência.
- Exigir confirmação explícita, informando que o resultado afeta estatísticas, vitórias, derrotas, momentum e votação.
- Após confirmar, atualizar imediatamente os detalhes da separação.
- Se o backend permitir correção posterior, disponibilizar uma ação claramente identificada como correção administrativa, com confirmação e auditoria.

## Compartilhar votação pelo WhatsApp — somente administradores

Após a confirmação da partida, quando o Modo Carreira estiver ativo:

- exibir status e prazo da votação;
- mostrar botão para copiar o link;
- mostrar botão para compartilhar pelo WhatsApp;
- compartilhar título, placar, chamada para escolher os três melhores e os três que ficaram devendo, prazo e link HTTPS;
- preservar emojis, caracteres acentuados e quebras de linha;
- utilizar o link devolvido pelo backend, sem construir tokens manualmente no cliente.

A votação em si pode continuar sendo realizada na página web responsiva existente. O aplicativo apenas compartilha ou abre esse link.

## Meu card

Mostrar o card do jogador associado ao login, seguindo a identidade visual já existente:

- foto ou avatar padrão;
- nome de exibição;
- tipo e posição;
- overall com uma casa decimal;
- nível do card quando a funcionalidade estiver ativa: Bronze, Prata, Ouro ou Lendário;
- atributos de jogador de linha: Velocidade, Habilidade, Marcação e Momentum;
- atributos de goleiro: Habilidade, Posicionamento, Saída de Gol e Momentum;
- jogos, vitórias e derrotas;
- gols e assistências somente se o recurso estiver ativo.

O card é somente leitura no aplicativo nesta primeira versão. Os dados devem vir do servidor e respeitar as configurações dos níveis de card e do multiplicador de Momentum.

## Configurações administrativas simplificadas

Criar uma única tela disponível apenas para administradores com três controles:

- Peso da Velocidade;
- Peso da Habilidade;
- Peso da Marcação.

Regras:

- apresentar os valores em porcentagem;
- usar sliders e também permitir entrada numérica acessível;
- os três pesos devem sempre somar 100%;
- ao alterar um peso, ajustar os demais proporcionalmente ou mostrar uma validação clara;
- exibir explicação em cada campo;
- mostrar o total configurado;
- pedir confirmação antes de salvar;
- informar sucesso ou erro após a gravação;
- não permitir editar nenhuma outra configuração administrativa pelo aplicativo.

## Estados offline e rede

- Permitir consulta offline apenas dos últimos dados carregados de separações e do card.
- Toda alteração deve exigir conexão com o servidor.
- Não enfileirar silenciosamente confirmações de resultado ou mudanças administrativas.
- Mostrar quando os dados foram atualizados pela última vez.
- Diferenciar servidor indisponível, falta de internet, sessão expirada e erro de validação.

## Segurança e consistência

- Usar HTTPS em produção.
- Nunca registrar senhas, tokens ou dados sensíveis em logs.
- Validar todas as permissões no backend.
- Registrar ações administrativas na auditoria existente.
- Usar identificadores imutáveis de jogadores e partidas, nunca nomes como chave.
- Evitar requisições duplicadas em botões de confirmação.
- Invalidar e atualizar caches após alterações.
- Respeitar a configuração de fuso horário `America/Sao_Paulo` na apresentação, mantendo datas da API em ISO 8601.
- Manter compatibilidade com a aplicação web e com o ambiente self-hosted em Docker/OMV.

## Identidade visual e experiência

- Reutilizar a identidade da aplicação: verde escuro, fundo claro, cartões com aparência esportiva e Times Azul e Amarelo claramente diferenciados.
- Interface e mensagens em português do Brasil.
- Alvos de toque com pelo menos 44 × 44 pontos.
- Suporte a leitor de tela, contraste adequado e escala de fontes.
- Feedback visual em todas as ações assíncronas.
- Confirmação para ações com impacto em separações, placar ou configuração.
- Priorizar uso com uma mão em campo, inclusive em telas pequenas.

## Entregáveis

Entregue:

1. código-fonte completo do aplicativo mobile;
2. alterações necessárias na API da aplicação web;
3. migrations necessárias para autenticação mobile, se houver;
4. documentação dos endpoints e exemplos de request/response;
5. arquivo `.env.example`, sem credenciais reais;
6. instruções para execução local em iOS e Android;
7. configuração de builds de desenvolvimento, homologação e produção;
8. testes unitários das regras críticas;
9. testes de integração da API;
10. testes de fluxo para login, separações, ordem de chegada, súmula, resultado e configurações;
11. checklist de publicação na App Store e Google Play;
12. lista objetiva das decisões técnicas e eventuais limitações.

## Critérios de aceite

- Um jogador comum não consegue executar nenhuma ação administrativa, nem manipulando diretamente a API.
- Um administrador consegue criar e consultar uma separação usando a mesma base e as mesmas regras do site.
- A ordem de chegada é independente por equipe e pode ser corrigida depois de salva.
- O rascunho calcula o placar sem torná-lo oficial.
- A confirmação do resultado grava placar, gols, assistências e gols contra corretamente.
- Gol contra entra no placar, aparece como `GC` e não entra no histórico de gols do jogador.
- O compartilhamento pelo WhatsApp mantém formatação, acentos, emojis e link HTTPS clicável.
- O card usa os dados e configurações oficiais do servidor e exibe overall com uma casa decimal.
- Os pesos de Velocidade, Habilidade e Marcação sempre somam 100%.
- O aplicativo funciona em iOS e Android com o mesmo backend já usado pela aplicação web.
- Sessões mobile são seguras, revogáveis e não expõem credenciais.
- Todas as alterações administrativas relevantes aparecem nos logs de auditoria.

Antes de implementar, analise o código e os contratos atuais da aplicação web. Apresente primeiro uma proposta curta de arquitetura, as mudanças de API necessárias e a sequência de implementação. Em seguida, implemente por etapas, validando cada fluxo com testes e sem remover funcionalidades já existentes no site.
