# Pelada Pede Mais Uma — Release 1.0.0

A primeira versão estável do **Pelada Pede Mais Uma** entrega uma solução completa para organizar peladas: importação das confirmações do WhatsApp, cadastro de jogadores, criação de times equilibrados, acompanhamento de partidas e uma experiência pública para consulta de resultados e estatísticas.

## 🚀 Principais recursos

### 📱 Importação de listas do WhatsApp

- Reconhecimento automático das seções **Goleiros**, **Mensalistas** e **Convidados**.
- Identificação de jogadores confirmados com ✅ e ausentes com ❌.
- Tratamento de caracteres invisíveis, variações Unicode, linhas vazias e diferentes formatos de listas.
- Identificação por nome completo, nome de exibição, apelido e aliases.
- Detecção de nomes duplicados e correspondências ambíguas.
- Cadastro assistido de jogadores ainda não existentes, preservando o tipo indicado pela seção da lista.

### ⚽ Cadastro e atributos dos jogadores

Jogadores de linha possuem:

- Velocidade
- Habilidade
- Marcação
- Momentum
- Posição principal
- Foto e informações pessoais

Goleiros possuem atributos específicos:

- Habilidade, representando reflexos e agilidade
- Posicionamento
- Saída de gol e coragem
- Momentum

Todos os atributos aceitam notas decimais de `1,0` a `5,0`.

## ⚖️ Algoritmo de equilíbrio

- Avaliação de milhares de combinações antes de selecionar os times.
- Distribuição equilibrada de posições, goleiros e nível técnico.
- Pesos configuráveis para velocidade, habilidade e marcação.
- Multiplicador configurável para influência do momentum.
- Proteção dos jogadores de maior overall em listas com quantidade ímpar.
- Limite configurável de diferença por posição.
- Geração de novas propostas.
- Possibilidade de ajustes manuais.
- Apresentação das médias, diferenças e classificação de equilíbrio.

O overall considera os atributos esportivos e o momentum:

```text
velocidade × peso da velocidade
+ habilidade × peso da habilidade
+ marcação × peso da marcação
+ momentum × multiplicador do momentum
```

O resultado permanece entre `1,0` e `5,0`, sempre arredondado para uma casa decimal.

## 🗂️ Separações e histórico

- Montagem e confirmação de times exclusivas para administradores.
- Histórico persistente de todas as separações confirmadas.
- Snapshot completo dos jogadores e configurações utilizadas em cada partida.
- Links públicos permanentes e compartilháveis para as separações.
- Cópia dos times em formato simples ou com pontuações.
- Ordem de chegada independente para Time Azul e Time Amarelo.
- Possibilidade de editar novamente uma ordem de chegada confirmada por engano.
- Correção administrativa das informações de partidas já realizadas.

## 🌐 Área pública

Visitantes podem:

- Consultar as separações e partidas mais recentes.
- Abrir links públicos de partidas específicas.
- Visualizar times, jogadores, regras e parâmetros utilizados.
- Consultar a lista pública de jogadores.
- Ordenar jogadores por nome, tipo, posição, atributos, momentum, partidas e overall.
- Abrir o card completo de qualquer jogador.
- Consultar jogos, vitórias, derrotas, gols e assistências, quando habilitados.

## 🃏 Cards e níveis de jogadores

Os cards apresentam:

- Overall
- Atributos esportivos
- Momentum
- Jogos
- Vitórias
- Derrotas
- Gols
- Assistências

Quando habilitado pelo administrador, o visual pode ser classificado em:

- **Bronze**
- **Prata**
- **Ouro**
- **Lendário**

Os limites de cada nível são configuráveis no painel administrativo.

A lista pública também utiliza as cores correspondentes em cada linha. Quando a funcionalidade estiver desativada, todos os cards mantêm o estilo ouro tradicional e a tabela permanece neutra.

## 🏆 Modo Carreira

O Modo Carreira acompanha a evolução dos jogadores entre as partidas.

### Resultados e momentum

- Confirmação administrativa do placar.
- Bônus de momentum para jogadores da equipe vencedora.
- Ônus para jogadores da equipe derrotada.
- Empates não aplicam bônus ou penalidades de equipe.
- Valores completamente configuráveis.
- Correção posterior do placar sem duplicar alterações de momentum.

### Gols e assistências

- Registro opcional dos autores dos gols.
- Assistências vinculadas aos respectivos gols.
- Possibilidade de gols sem assistência.
- Validação para impedir autoassistência ou assistência de outra equipe.
- Suporte a gol contra, identificado como **GC**.
- Gols contra entram no placar, mas não são contabilizados no histórico individual.
- Exibição de gols e assistências na partida, votação e cards dos jogadores.
- Edição administrativa posterior em caso de erro humano.

### Rascunho da súmula

- Página otimizada para celulares e tablets.
- Registro de gols e assistências durante a partida.
- Atualização automática do placar.
- Suporte a gols contra.
- Salvamento do rascunho antes da confirmação oficial.
- Revisão dos dados antes da aplicação definitiva do resultado.

### Votação dos destaques

Após a confirmação do placar, o sistema gera:

- Link público com token exclusivo.
- QR Code para acesso rápido.
- Compartilhamento formatado pelo WhatsApp.
- Votação para os três melhores em **Man of the Match**.
- Votação para os três destaques negativos em **Deception of the Match**.

Regras da votação:

- Somente jogadores participantes podem votar.
- Cada jogador registra apenas um voto.
- Ninguém pode votar em si mesmo.
- Um candidato não pode aparecer simultaneamente nas categorias positiva e negativa.
- O administrador pode revisar e remover votos enquanto a votação estiver aberta.
- A votação pode ser encerrada automaticamente pelo prazo ou antecipadamente pelo administrador.
- Depois do encerramento, votos e resultados tornam-se definitivos.
- O resultado final pode ser compartilhado pelo WhatsApp.

## 👤 Contas de usuários

- Cadastro de contas para mensalistas e convidados.
- Associação exclusiva entre uma conta e um jogador.
- Confirmação antes da associação definitiva.
- Área **Minha conta** com card e estatísticas do jogador.
- Atualização de foto, nome completo, apelido, posição e observações.
- Administradores também podem associar suas contas a jogadores.
- Gestão administrativa das associações.
- Possibilidade de desassociação para correção.

## 🛠️ Painel administrativo

O painel administrativo inclui:

- Cadastro e edição de jogadores.
- Ativação e desativação de jogadores.
- Upload de fotos JPEG, PNG e WebP de até 5 MB.
- Gestão separada de jogadores de linha e goleiros.
- Listas administrativas com ordenação crescente e decrescente.
- Cadastro e gerenciamento de administradores.
- Gestão das associações entre contas e jogadores.
- Configuração completa do algoritmo de equilíbrio.
- Configuração do Modo Carreira.
- Configuração dos níveis dos cards.
- Revisão de partidas, placares, gols, assistências e votações.
- Histórico de auditoria para logins, cadastros e alterações.

## 🔐 Segurança e recuperação de acesso

- Senhas protegidas com PBKDF2-SHA-256.
- Salt aleatório e 210 mil iterações.
- Cookies de sessão HTTP-only e SameSite.
- Troca de senha pelo próprio usuário autenticado.
- Recuperação de senha por e-mail.
- Tokens de recuperação armazenados apenas como hash.
- Tokens de uso único e com expiração.
- Invalidação das sessões após redefinição de senha.
- Notificação por e-mail após alteração de credenciais.
- Compatibilidade com SMTP do Gmail por senha de aplicativo.
- Consultas preparadas para proteção contra injeção SQL.
- Exclusão lógica de jogadores e separações.

## 📋 Auditoria e observabilidade

- Logs estruturados em JSON.
- Identificador individual por requisição.
- Registro de método, rota, status e duração.
- Logs de inicialização, banco, autenticação e erros.
- Compatibilidade com coletores como Loki.
- Visualização e investigação pelo Grafana.
- Endpoint de saúde para verificação do banco e configuração SMTP.
- Auditoria de cadastros, edições, logins e alterações administrativas.

## 🐳 Docker e plataformas suportadas

A Release 1.0 oferece três formas de execução:

- Docker Compose padrão para computadores e servidores compatíveis.
- Docker Compose de desenvolvimento com recarga automática.
- Docker Compose dedicado ao OMV 7 e Raspberry Pi ARM64.

A edição self-hosted para Raspberry Pi utiliza Node.js e SQLite, evitando a dependência do `workerd`, incompatível com determinados espaços de endereçamento virtual dos Raspberry Pi.

Os dados persistentes ficam em `/data`, incluindo:

- Banco SQLite
- Fotos dos jogadores
- Arquivos auxiliares necessários para backup e restauração

## 💾 Banco de dados e armazenamento

A aplicação suporta:

- D1 e R2 no ambiente Cloudflare.
- SQLite e filesystem na versão self-hosted.
- Migrações automáticas durante a inicialização.
- Snapshots históricos imutáveis.
- Exclusão lógica de registros.
- Backup completo pelo diretório `/data` na versão self-hosted.

## ⬆️ Atualização de uma instalação existente

Antes de atualizar:

1. Pare o container.
2. Faça backup completo do diretório persistente `/data`.
3. Atualize o código-fonte.
4. Reconstrua a imagem Docker.
5. Inicie novamente o serviço.

As migrações do banco serão aplicadas automaticamente durante a inicialização.

## 🔑 Primeiro acesso

Em uma instalação nova, utilize:

```text
Usuário: admin
Senha: admin
```

No primeiro acesso, será obrigatório cadastrar um e-mail válido e alterar a senha para uma nova senha com pelo menos oito caracteres.

> [!IMPORTANT]
> Altere imediatamente as credenciais iniciais e configure HTTPS antes de disponibilizar a aplicação publicamente.

## 📦 Requisitos

- Node.js 22.13 ou superior
- Docker e Docker Compose para execução em contêiner
- Arquitetura `amd64` ou `arm64`
- URL HTTPS pública recomendada para recuperação de senha e compartilhamento das votações

---

A Release 1.0 estabelece uma base completa para organizar partidas, acompanhar a evolução dos jogadores e preservar o histórico da pelada de maneira transparente, segura e acessível em computadores, celulares, tablets e servidores self-hosted.
