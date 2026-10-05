# ApuraBrasil

SPA estática para acompanhamento das Eleições Gerais de 2026. O projeto não é afiliado ao Tribunal Superior Eleitoral.

## Estado desta entrega

Base migrada para Angular 20, standalone, Signals, TypeScript strict, SCSS e Angular Material 20. A descoberta das eleições gerais de 2026 consulta o EA11 oficial diretamente do navegador. O painel de Presidente nacional e por UF consulta o EA20 oficial, com atualização manual e automática orientada pelo EA14; não há resultados fictícios.

Presidente, Governador, Senador, Deputado Federal e Deputado Estadual/Distrital incluem resultados por UF e município. Os deputados calculam a distribuição de vagas estadual, com indicação provisória durante a apuração e situação oficial separada. As cinco abas incluem histórico local e gráfico de evolução percentual ou de votos absolutos. O workflow de publicação automática no GitHub Pages está configurado para a main; PWA e dashboard nacional/regional permanecem pendentes.

## Requisitos e execução

Node.js 20.19+, 22.12+ ou 24+ em versões compatíveis com Angular 20; npm.

```bash
npm install
npm start
```

Acesse http://localhost:4200/.

## Testes

```bash
npm run test:ci
```

Requer Chrome instalado. Para testes interativos, use `npm test`.

## Build e GitHub Pages

```bash
npm run build
```

Também pode usar `npx ng build --configuration production`.
Arquivos estáticos em `dist/ApuraBrasil/browser/`, com baseHref `/ApuraBrasil/`, respeitando maiúsculas e minúsculas do repositório.
O roteamento usa hash para suportar GitHub Pages. Não há SSR nem backend.

### Publicação automática

O workflow `.github/workflows/deploy-pages.yml` executa em pushes na **main** e permite execução manual nessa mesma branch. Usa Node.js 22, cache npm e `npm ci`, faz o build de produção e envia somente `dist/ApuraBrasil/browser` ao GitHub Pages. O deploy depende do sucesso do build; falhas não publicam um novo artefato. Execuções manuais de outras branches são ignoradas.

No workflow, o `baseHref` vem de `actions/configure-pages`, com barra final. Isso acompanha o nome atual do repositório e sites publicados na raiz ou em domínio próprio. O build local mantém `/ApuraBrasil/`. As rotas com hash continuam funcionando sem regras de redirecionamento no servidor.

Para ativar:

1. No GitHub, abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**.
2. Integre este workflow e o projeto atualizado à **main**. O push dispara a publicação.
3. Acompanhe **Actions → Deploy ApuraBrasil to GitHub Pages**. Para republicar manualmente, use **Run workflow** selecionando **main**.

O ambiente `github-pages` deve permitir deploys da main. O workflow usa as permissões `pages: write` e `id-token: write` apenas no job de publicação; não exige token pessoal nem grava commits em `gh-pages`. A concorrência serializa as publicações sem interromper um deploy em andamento. A configuração da fonte no GitHub e a primeira publicação precisam ser verificadas no repositório remoto.

Referência: [workflows oficiais do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Estrutura

- `src/main.ts`: bootstrap standalone.
- `src/app/app.config.ts`: providers, locale pt-BR, Angular Material e roteamento hash.
- `src/app/app.routes.ts`: base para próximas rotas.
- `src/app/app.component.*`: tela inicial.
- `src/environments/`: configuração por ambiente.

## Descoberta das eleições (EA11)

Fonte: [documentação técnica do TSE de 2026](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados) e [layout EA11 de 23/06/2026](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea11-arquivo-de-configuracao-de-eleicoes).

Endpoint: `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`.
A configuração usa `pl[].c` para filtrar `ele2026` e `pl[].e[].tp` para identificar federal ordinária (8) e estadual ordinária (1).
Os códigos de eleição, pleito, cargos e abrangências vêm do arquivo. Registros de ciclos antigos, eleições suplementares e municipais ficam fora desta entrega.
O campo `cdt2` é preservado como referência, sem criar uma eleição de segundo turno que não esteja publicada em `e[]`.

Uma consulta ocorre na inicialização. Novas consultas dependem do botão Atualizar eleições; não há polling nem retries automáticos nesta etapa.
Há timeout de 15 segundos, cancelamento ao destruir a tela, prevenção de consultas simultâneas, detecção offline e mensagens para HTTP 404/429 e falha de rede. Uma atualização malsucedida preserva a última configuração recebida.

`ElectionDataProvider` abstrai a origem; `TseApiService` é a implementação atual. A UI e o store não dependem de URLs. Não existe proxy ou backend.

## CORS verificado em 04/10/2026

- EA11 oficial respondeu HTTP 200 com `Access-Control-Allow-Origin: https://hernior.github.io` à requisição com essa origem.
- Uma consulta real com fetch em ChromeHeadless, a partir de localhost (Karma), retornou JSON legível e foi processada com sucesso.
- A verificação live ficou separada dos testes unitários, que não acessam o TSE.
- Isso valida o acesso ao EA11 nas condições testadas; EA12 e EA15 ainda precisam de verificações próprias. O EA14 foi validado na implementação de atualização automática. O EA20 nacional de Presidente foi verificado na entrega seguinte. O portal publicado no GitHub Pages ainda não foi testado.

## Ambientes

`environment.ts` e `environment.prod.ts` definem `tseBaseUrl` e `tseEnvironment`.
Para desenvolvimento com a origem oficial de simulado, configure no arquivo de desenvolvimento:

```ts
tseBaseUrl: 'https://resultados-sim.tse.jus.br/simulado',
tseEnvironment: 'simulado2026'
```

A disponibilidade do simulado depende do TSE. A tela identifica configuração com fase `s`; o build de produção recusa essa fase.
A data/hora da configuração identifica o EA11; o painel de Presidente apresenta separadamente a geração e a totalização do EA20.

## Presidente nacional (EA20)

Implementação baseada no [layout EA20 de 10/07/2026](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado).

O painel usa as eleições federais de Presidente efetivamente publicadas no EA11. Seleciona inicialmente a primeira da lista, ordenada por turno; outras eleições publicadas podem ser escolhidas pelo usuário. Uma referência `cdt2` sozinha não habilita o segundo turno.

O diretório é obtido em `arq[tp=u].dir`, substituindo os tokens do EA11. O cargo Presidente utiliza o código oficial 0001 e o código da eleição no nome do arquivo tem seis dígitos, preenchidos com zeros. O diretório da eleição mantém o código original.
As fotos utilizam `arq[tp=ft].dir` e `sqcand.jpeg`; se a foto estiver ausente ou falhar, a identificação textual permanece.

- Candidatos são lidos de `carg[].agr[].par[].cand[]`; partido e federação vêm dos respectivos registros.
- `vap` e `pvapn/pvap` são votos computados e percentual em relação aos votos a votáveis concorrentes. Não se recalcula o percentual com outro denominador.
- O ranking ordena por votos, usando `seq` para desempatar a apresentação. Os primeiros dois registros com votos positivos recebem o mesmo destaque neutro; isso não significa eleição.
- A situação exibida é `st`. O indicador `e=s` também pode significar segundo turno e não é traduzido em “Eleito”.
- Se `dv=n`, a votação e os percentuais são ocultados, sem apresentar zeros como apuração real.
- Seções usam `s.st`, `s.ts` e `s.pstn/pst`. Indicadores usam `v.vv`, `v.vb` e `v.tvn` (incluindo nulos técnicos), além de comparecimento e abstenção em `e`.
- Valores ausentes aparecem como “—”; zeros publicados permanecem zero.
- A geração (`dg/hg`) e a totalização (`dt/ht`) aparecem separadamente. O selo AO VIVO segue os critérios descritos na seção de atualização automática.
- Resultado de eleição, turno, cargo ou abrangência diferentes é rejeitado. Produção recusa fase de simulado.

As consultas de Presidente são coordenadas pelo serviço de atualização automática descrito abaixo. A troca de eleição cancela a consulta anterior e respostas antigas não substituem os dados atuais. Timeout de 15 segundos, offline, HTTP 404/429 e falhas de rede possuem mensagens próprias. Falhas de atualização preservam os últimos dados do mesmo turno; a troca de eleição remove os dados anteriores.

### Verificação de acesso

Em 04/10/2026, o EA20 nacional descoberto pelo EA11 respondeu HTTP 200 e autorizou `https://hernior.github.io` no cabeçalho CORS. Um teste separado em ChromeHeadless executou EA11 → EA20 → renderização de candidatos com dados oficiais reais, com sucesso. Os testes unitários não consultam o TSE. Publicação no GitHub Pages e validação visual em celulares ainda não foram realizadas.

Esta etapa não adiciona snapshots, banco de dados, mapas, gráficos de evolução ou resultados estaduais.

## Atualização automática de Presidente com EA14

Baseada no [EA14 de 10/06/2026](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea14-arquivo-de-acompanhamento-brasil) e no FAQ técnico do TSE.

- Intervalo padrão de 15 segundos, com opções 30s, 60s e Manual. Valores fora dessas opções são recusados, inclusive intervalos inferiores a 10s.
- Após cada consulta concluída, agenda a próxima; nunca sobrepõe ciclos.
- Consulta o EA14 da eleição federal selecionada. A assinatura compara abrangências ordenadas, datas/horas de totalização, andamento e indicadores de seções/eleitores. Mudanças apenas em idg, ordem de abrangências ou ordem de propriedades não provocam consulta ao EA20.
- EA20 é buscado na carga inicial, quando há alteração, numa atualização manual ou ao retornar à aplicação.
- O marcador fica pendente enquanto o EA20 não acompanha a data/hora nacional, o número de seções ou a finalização indicada pelo EA14. Se a alteração ainda retorna a mesma geração anterior do EA20, também permanece pendente. Isso evita consumir uma indicação nova e congelar o resultado antigo por atraso da CDN.
- As requisições usam cache browser com revalidação (`cache: no-cache`), sem cabeçalhos condicionais personalizados que poderiam exigir preflight. Não há cache persistente de resultados nesta etapa.
- Aba oculta ou offline cancela a consulta e os timers. Ao voltar ou reconectar, atualiza imediatamente, inclusive no modo Manual, respeitando eventuais bloqueios.
- EA14 e EA20 têm timeout de 15 segundos por requisição. A troca de eleição ou destruição do componente cancela a operação, e respostas antigas não substituem o contexto atual.
- Erros de rede, timeout e HTTP 5xx usam intervalos progressivos de 30s, 60s, 120s etc., limitados a 10 minutos. O intervalo selecionado permanece um mínimo.
- HTTP 404 adia as novas consultas por pelo menos 60s, aumentando até 10 minutos em falhas repetidas.
- HTTP 429 pausa por pelo menos 10 minutos, aumenta o tempo em falhas repetidas e respeita Retry-After quando o navegador consegue lê-lo. A atualização manual e eventos de visibilidade também respeitam essa pausa.
- Erro de layout ou configuração suspende a atualização automática e mostra a causa; o usuário pode tentar novamente manualmente.
- “AO VIVO” exige modo automático ativo, dados oficiais divulgáveis, totalização em andamento, uma nova geração recebida recentemente e arquivo gerado nos últimos 90s (horário de Brasília, tolerância de 60s para relógio adiantado). O selo é removido durante pausa, falha, espera de sincronização, modo manual ou quando deixa de cumprir esses critérios.

EA14 nacional foi verificado com HTTP 200 e CORS para a origem GitHub Pages em 04/10/2026. Uma verificação separada em ChromeHeadless executou a carga inicial e um segundo ciclo agendado após 15s usando EA11, EA14 e EA20 oficiais. Testes unitários usam fixtures e relógio simulado, sem consultar o TSE nem provocar erros 429 reais.

O acompanhamento de Presidente inclui Brasil, a UF e o município selecionado. Fila geral de concorrência, IndexedDB e snapshots permanecem para próximas etapas. Não altera schema nem grava em banco de dados.

## Presidente por UF

- Acesse `/#/uf/al`, `/#/uf/pe` etc. ou use o seletor de abrangência no painel de Presidente. Brasil fica em `/#/`; `/#/presidente` redireciona para a mesma visão.
- As UFs disponíveis vêm das abrangências `tpabr=uf` do EA14 da eleição selecionada. A abrangência Exterior (`zz`) não aparece como UF.
- O resultado usa o diretório EA11 com o token `<uf>` da seleção e o arquivo `<uf>-c0001-e<eleição com seis dígitos>-u.json`.
- O parser valida a eleição, turno, cargo e a UF exata antes de apresentar os dados; não substitui dados estaduais por dados nacionais.
- O mesmo painel exibe candidatos, votos, percentuais, seções, comparecimento e abstenção na abrangência escolhida, mantendo as regras de divulgação e situação oficial.
- O EA14 continua sendo consultado, mas para UF a assinatura e o marcador consideram somente a abrangência aberta. Mudanças em outras UFs não causam uma nova consulta ao EA20 da UF atual.
- A navegação cancela requisições anteriores e remove resultados de outra abrangência. Não carrega as 27 UFs simultaneamente.
- UFs desconhecidas são recusadas a partir do EA14, antes de consultar uma URL EA20 presumida. Não há API intermediária, alterações de schema ou gravações em banco.
- As fotos de Presidente continuam usando a origem BR publicada no EA11, pois se referem aos mesmos candidatos nacionais.
- A rota é carregada sob demanda e usa hash, compatível com o baseHref `/ApuraBrasil/`.

Em 04/10/2026, o EA20 de Alagoas respondeu HTTP 200 e CORS para a origem GitHub Pages. Um teste separado em ChromeHeadless abriu diretamente `/uf/al`, renderizou os dados oficiais da UF e confirmou 27 UFs descobertas pelo EA14. Isso não representa verificação de todos os endpoints estaduais nem publicação no GitHub Pages.

## Presidente por município

- Na visão de UF, escolha um município ou abra `/#/uf/al/municipio/27855` (Maceió). A opção “Toda a UF” retorna ao resultado estadual.
- Municípios são descobertos pelo [EA12](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea12-arquivo-de-configuracao-de-municipios), no diretório `cm` do EA11. A lista é ordenada por nome; o mesmo arquivo também fornece as UFs para o seletor global. Há cache em memória vinculado à URL e à geração do EA11. Exterior não integra o seletor municipal.
- O código TSE de cinco dígitos é preservado, inclusive zeros à esquerda. O código IBGE é armazenado separadamente. Município fora da UF, ausente ou inválido é recusado antes de consultar acompanhamento ou resultado municipal.
- Presidente usa o EA20 federal `<uf><município>-c0001-e<eleição com seis dígitos>-u.json`, com validação de eleição, turno, cargo, `tpabr=mu` e código municipal. As fotos permanecem na origem BR.
- Conforme o [EA15](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea15-arquivo-de-acompanhamento-uf), o acompanhamento municipal pertence à eleição estadual. Ela é descoberta no EA11 pelo mesmo ciclo, data, turno e abrangência (BR ou UF selecionada), sem códigos de eleição fixos. O arquivo da UF deve conter o município em `tpabr=mun`.
- Cada ciclo municipal consulta somente o EA15 da UF aberta; apenas mudanças no registro municipal selecionado provocam nova consulta ao EA20. Mudanças em outros municípios e apenas no identificador de geração não recarregam os votos. A atualização manual força uma consulta.
- Datas e finalização da eleição estadual não são usadas para exigir sincronização do resultado federal. O marcador de seções processadas mantém a consulta pendente quando o EA20 ainda está atrasado. O EA15 acompanha seções e eleitorado; alterações exclusivamente nos votos que não alterem esse marcador podem exigir atualização manual.
- Sem eleição estadual correspondente, o resultado federal municipal continua disponível em modo Manual, com aviso no painel. Não presume um EA15 de outra eleição ou turno.
- A troca de rota cancela requisições e ignora respostas antigas. Falhas no EA12 são exibidas com possibilidade de nova tentativa; HTTP 429 também respeita pausa mínima de 10 minutos e Retry-After, inclusive ao atualizar manualmente ou trocar de rota. Offline não inicia consulta de municípios; ao reconectar, use Atualizar Presidente para tentar carregar a lista.

Em 04/10/2026, EA12 federal, EA15 estadual de AL e EA20 federal de Maceió responderam HTTP 200 com CORS para a origem GitHub Pages. Uma verificação separada em ChromeHeadless abriu a rota municipal diretamente e renderizou os dados oficiais. A suíte permanente usa fixtures, sem consultar o TSE. Isso não verifica todos os municípios nem publicação no GitHub Pages.

## Governador por UF e município

- A aba Governador abre a UF e o município selecionados no contexto estadual. Inclui o Distrito Federal. Rotas diretas: `/#/governador/uf/al` e `/#/governador/uf/al/municipio/27855` (Maceió). A antiga rota `/#/governador`, sem UF, redireciona para Presidente.
- A eleição estadual e os turnos disponíveis vêm do EA11. O seletor oferece somente eleições que publicam o cargo Governador na abrangência BR ou na UF aberta. UFs e municípios são descobertos pelo EA12 da eleição estadual, com códigos TSE e IBGE separados e preservação dos zeros à esquerda.
- Usa o cargo `0003` conforme o [layout EA20](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado), no diretório `u` da eleição estadual. Resultados são validados por eleição, turno, cargo e abrangência exata. Não usa IDs fixos nem consulta as 27 UFs simultaneamente.
- Fotos de Governador usam o diretório `ft` da UF aberta. O mesmo painel de resultados exibe votação, percentuais, andamento, seções, votos válidos, brancos e nulos, comparecimento, abstenção e situação oficial do candidato. Não infere eleição ou segundo turno a partir da posição no ranking.
- Na UF, acompanha o EA14 estadual e considera somente o registro da UF selecionada. No município, acompanha o EA15 da mesma eleição estadual, usando somente o registro municipal selecionado. Mantém intervalos de 15s/30s/60s/Manual, pausa por visibilidade/offline, backoff, respeito a HTTP 429 e proteção contra respostas antigas.
- O EA15 indica seções e eleitorado, não cada alteração de votos por cargo. Mudanças exclusivas na votação sem alteração desse registro podem exigir Atualizar Governador. Na sincronização municipal, compara as seções processadas, evitando depender da finalização de outros cargos da eleição estadual.
- A navegação entre Presidente e Governador cancela a consulta anterior e remove resultados de outro cargo, eleição ou abrangência. O rodapé identifica o cargo dos últimos dados recebidos. Não altera schema, grava em banco nem publica o site.

Em 04/10/2026, uma verificação pontual em ChromeHeadless abriu Governador de Alagoas e de Maceió usando EA11, EA12, EA14, EA15 e EA20 oficiais. As duas rotas renderizaram candidatos do cargo correto. EA20 de AL e EA14 estadual também responderam HTTP 200 com CORS para a origem GitHub Pages. A suíte permanente possui 82 testes com fixtures; a verificação oficial separada não integra a suíte. Isso não representa verificação de todos os municípios ou publicação no GitHub Pages.

## Senador por UF e município

- A aba Senador usa a UF e o município compartilhados pelas abas estaduais. Rotas diretas: `/#/senador/uf/al` e `/#/senador/uf/al/municipio/27855` (Maceió). Sem UF, redireciona para Presidente.
- A eleição é descoberta pelo EA11, com cargo `0005`, abrangência BR ou UF selecionada e primeiro turno. O EA20 deve informar duas vagas em `carg.nv`; outro valor é recusado. As duas vagas pertencem ao mesmo cargo e à mesma lista de candidatos.
- Votos e percentuais são exibidos como publicados pelo TSE, sem dividir por dois ou recalcular com o comparecimento. A situação oficial vem de `st`; a posição no ranking não declara eleitos. Se `dv=n`, votos e percentuais ficam ocultos.
- O painel apresenta primeiro e segundo suplentes publicados em `vs`, com nome e partido. Fotos usam o diretório da UF. Eleição, turno, cargo e abrangência exata são validados antes da apresentação.
- Durante a apuração estadual, os dois mais votados com destinação válida e votos positivos recebem sombra interna verde clara e chip **Provisoriamente na faixa de eleição**. Ao abrir um município, o painel consulta também o EA20 da UF para esse destaque e para a situação oficial. O ranking municipal não define as cores. Empates que atravessam o limite das duas vagas usam idade; dados ausentes ou empate ainda indefinido suspendem o destaque e mostram a causa.
- Sombra interna verde indica situação **Eleito** informada pelo TSE. A totalização final encerra o destaque provisório sem converter automaticamente os líderes em eleitos. Ausência de atribuição de eleitos, votação oculta e destinação desconhecida também impedem a projeção.
- O acompanhamento usa EA14 para UF. O município acompanha seu registro no EA15 e o registro da UF no EA14, mantendo ambos os resultados atualizados. A troca entre Governador e Senador remove os resultados anteriores mesmo quando eleição e abrangência são iguais. Mantém cancelamento, proteção contra respostas antigas e pausa por HTTP 429 entre cargos.

Em 04/10/2026, os EA20 de Senador de AL e Maceió responderam HTTP 200 com CORS para a origem GitHub Pages. Uma verificação separada em ChromeHeadless abriu as duas rotas com EA11, EA12, EA14, EA15 e EA20 oficiais e confirmou cargo 5 e duas vagas. A suíte permanente possui 98 testes sem acesso ao TSE. A verificação pontual não cobre todas as UFs e municípios nem o site publicado.

## Deputado Federal por UF e município e cálculo de vagas

- Usa os filtros estaduais compartilhados. Rotas: `/#/deputado-federal/uf/al` e `/#/deputado-federal/uf/al/municipio/27855`. A eleição estadual de primeiro turno, o cargo `0006`, as vagas e os diretórios são descobertos nos arquivos do TSE, sem IDs fixos.
- O município mostra sua votação local e consulta também o resultado da UF para calcular vagas e apresentar a situação estadual dos candidatos. O cálculo nunca utiliza apenas votos municipais. Fotos vêm do diretório da UF.
- Regras baseadas nos arts. 8 a 12-A da [Resolução TSE nº 23.677, texto compilado com alterações de 2026](https://www.tse.jus.br/legislacao/compilada/res/2021/resolucao-no-23-677-de-16-de-dezembro-de-2021) e no [layout EA20](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado). O quociente eleitoral considera os votos válidos nominais e de legenda, arredondando a fração somente se maior que 0,5.
- Cada federação funciona como uma lista única. O QP é a divisão inteira dos votos válidos do agrupamento pelo QE. A primeira distribuição exige votação nominal mínima de 10% do QE. As sobras usam maiores médias, com os limites de 80% para agrupamentos e 20% para candidatos; esgotada essa etapa, todos participam das sobras restantes sem esses limites. O denominador inclui QP e sobras anteriores, inclusive vagas do QP não preenchidas.
- As médias são comparadas com aritmética inteira exata. Empates entre agrupamentos consideram votos totais e depois votos nominais do candidato à vaga; empates dentro da lista consideram idade. Empate ainda indefinido, dados ausentes ou totais inconsistentes suspendem o cálculo e mostram a causa, preservando a votação recebida. Votos anulados, anulados sub judice e candidatos com votos destinados à legenda não elegem candidatos pelo cálculo.
- A tabela apresenta QE, QP, votos válidos e vagas calculadas por agrupamento, ao lado das vagas informadas pelo TSE. Os candidatos selecionados recebem o chip **Provisoriamente na faixa de eleição**; somente após a totalização final estadual (`tf=s`, `and=f`, `esae=n`) recebem **Eleito pelo cálculo**. Se o TSE informa ausência de atribuição de eleitos, o cálculo fica indisponível.
- A situação oficial permanece exatamente como publicada em `st`, em chip Angular Material separado. Os chips de situação também são usados nos demais cargos implementados. O cálculo não altera a situação oficial e não representa proclamação da Justiça Eleitoral.
- UF acompanha EA14. Município acompanha seu registro no EA15 e o registro da UF no EA14, pois mudanças estaduais também alteram as vagas. O acompanhamento exige que ambos os resultados cubram os respectivos marcadores; mudanças somente na geração estadual também atualizam o cálculo. Consultas são canceladas ao trocar cargo ou abrangência e respeitam a pausa compartilhada por HTTP 429. Alterações exclusivamente nos votos sem mudança nos marcadores podem exigir atualização manual.

Em 04/10/2026, uma verificação separada em ChromeHeadless abriu AL e Maceió com dados oficiais reais, exibiu chips e comparou o quociente e as vagas calculadas por agrupamento com os valores publicados pelo TSE: coincidiram nas duas rotas. O EA20 de AL também respondeu HTTP 200 com CORS para a origem GitHub Pages. A suíte permanente possui 121 testes sem consultar o TSE. Essa verificação pontual não cobre todas as UFs, empates reais, decisões judiciais futuras ou o site publicado. Não há alterações de schema nem gravações em banco.

## Deputado Estadual/Distrital por UF e município

- A aba Dep. Estadual usa os filtros estaduais compartilhados, com rotas `/#/deputado-estadual/uf/al` e `/#/deputado-estadual/uf/al/municipio/27855`. No DF, o título e o rodapé mostram **Deputado Distrital**; a mesma rota usa `uf/df` e o recorte TSE `municipio/97012`.
- Os códigos são `0007` para Deputado Estadual e `0008` para Deputado Distrital, conforme o [layout EA20](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado). O cargo deve estar disponível no EA11 para a eleição e UF. Cargo, eleição, primeiro turno e abrangência exata são validados; um resultado de Estadual no DF ou Distrital fora do DF é recusado.
- As vagas vêm de `carg.nv`. Usa o mesmo cálculo proporcional de Deputado Federal, com votos válidos nominais e de legenda, federações, QE, QP, sobras e desempates. A votação municipal continua local; cálculo de vagas, situação e cores usam toda a UF.
- Mantém tabela com vagas calculadas e publicadas pelo TSE, chips oficiais separados, sombra interna verde clara para provisórios e verde para eleitos oficiais ou pelo cálculo final. Dados insuficientes e ausência de atribuição de eleitos suspendem o cálculo. Fotos vêm da UF selecionada.
- EA14 e EA15 seguem a mesma coordenação de Deputado Federal, incluindo acompanhamento estadual no recorte municipal, cancelamento por navegação, proteção contra respostas antigas e pausa compartilhada por HTTP 429.

Em 04/10/2026, uma verificação separada em ChromeHeadless abriu AL/Maceió (cargo 7), DF/Brasília (cargo 8) e Senador de AL/Maceió (cargo 5), com arquivos oficiais reais. Os quocientes e as vagas calculadas dos deputados coincidiram com os publicados pelo TSE nas quatro rotas; Senador usou o contexto da UF para o destaque municipal. A suíte permanente possui 134 testes sem consultar o TSE. A verificação pontual não cobre todas as UFs, todos os municípios ou a publicação no GitHub Pages. Não há alteração de schema ou gravação em banco.

## Abas de cargos e filtros federal e estadual

- Navegação em abas Angular Material: Presidente, Governador, Senador, Dep. Federal e Dep. Estadual. Dois seletores ficam acima das abas: **UF Eleição Federal** para Presidente e **UF Eleição Estadual** para as outras quatro abas. Ambos usam as UFs descobertas no EA12, incluindo o DF.
- Presidente pode permanecer em **Brasil inteiro** enquanto as abas estaduais usam uma UF específica. Selecionar uma UF federal não habilita as abas estaduais; somente a seleção estadual controla esse bloqueio.
- Cada grupo mantém sua própria UF e seu próprio município durante a sessão da aplicação. Trocar entre Presidente e os demais cargos restaura a seleção do grupo de destino. As quatro abas estaduais compartilham a seleção estadual.
- Alterar o filtro de um grupo enquanto o outro está aberto não troca a rota nem recarrega a apuração atual. Trocar a UF limpa apenas o município daquele grupo. Limpar a UF federal mantém a seleção estadual e suas abas habilitadas; limpar a UF estadual desativa essas abas e, se uma delas estiver aberta, volta para a seleção federal salva.
- Todas as cinco abas possuem apuração implementada. Rotas sem UF para cargos estaduais redirecionam para Presidente; rotas com `/municipio/:codigo` preservam o contexto compartilhado do grupo.
- O seletor municipal permanece no painel do cargo implementado e atualiza somente o grupo daquele cargo. A seleção de UF usa os dois seletores acima das abas. URLs diretas inicializam apenas o grupo correspondente; o outro mantém sua seleção durante a sessão.
- As abas são associadas ao painel pela API `mat-tab-nav-panel`, com navegação por teclado e estado desativado fornecidos pelo Angular Material. A suíte inclui testes de cliques, bloqueio sem UF, seleção compartilhada, URLs diretas e manutenção do município.

## Compartilhamento para WhatsApp

- O botão **Compartilhar** abre um modal Angular Material com um resumo da aba e dos filtros atuais: cargo, local, turno, percentual de seções totalizadas, horário do arquivo TSE e até cinco candidatos mais votados, com votos, percentuais e situação oficial.
- **Copiar texto** copia a mensagem formatada; em caso de falha, seleciona a prévia para cópia manual. **Abrir WhatsApp** abre a composição com a mesma mensagem, incluindo o link da rota atual. A mensagem fica fixa enquanto o modal estiver aberto.
- As indicações provisórias e os eleitos pelo cálculo do ApuraBrasil aparecem separados da situação TSE. Para senadores e deputados em municípios, a mensagem identifica que essas informações usam a UF. Simulados, falhas de atualização e votação ainda não liberada conservam os respectivos avisos; votos não autorizados não entram no resumo.
- O compartilhamento fica desativado até existir um resultado correspondente ao cargo, eleição e recorte abertos. Testes específicos cobrem formatação, cópia, composição do WhatsApp e contexto das abas, sem consultas externas.

## Chips de confirmação e layout móvel

- Candidatos confirmados recebem **ELEITO** ou **2º TURNO**, mantendo os chips. A borda e o box-shadow interno do card usam verde para eleitos, amarelo para segundo turno e vermelho para a situação oficial **Não eleito**. Provisórios permanecem em verde claro. Todos os chips de situação usam o fundo na mesma cor do destaque do card e texto escuro para leitura; situação ausente não significa não eleito. O centro permanece claro e os destaques usam a autoridade nacional/estadual correspondente. A origem (**TSE** ou **ApuraBrasil**) aparece no chip e sua descrição explica o critério. A situação oficial completa continua separada; confirmações substituem o chip provisório. O resumo para WhatsApp inclui a confirmação e o contexto nacional/estadual.
- Presidente e Governador usam o indicador `md` e o sinal do candidato `e` do [layout EA20 oficial](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado): `md=e` indica eleito; `md=s`, segundo turno. `e=s` sozinho não diferencia esses casos. As situações oficiais `Eleito`, `Eleito por QP`, `Eleito por média` e `2º turno` também são reconhecidas.
- Os cálculos próprios usam um teto conservador de eleitores pendentes: `e.esnt + e.esna + e.esni`, incluindo seções ainda não totalizadas, não apuradas e não instaladas. Campos ausentes, inconsistências, votação não divulgada, votos com destinação judicial/indefinida ou totalização sem atribuição de eleitos impedem a confirmação pelo cálculo. Percentuais arredondados de seções não são usados como teto de votos.
- Para Presidente e Governador, exige-se maioria absoluta mesmo que todos os votos pendentes sejam dos adversários. O chip de segundo turno exige provar que ninguém pode obter maioria absoluta e que o candidato não pode sair das duas primeiras posições. Empates que possam mudar a classificação não são declarados. Essas regras seguem o [sistema majoritário descrito pelo TSE](https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/faltam-22-dias-sistemas-majoritario-e-proporcional-definem-a-eleicao).
- Para Senador, cada adversário pode receber até um voto por eleitor pendente; o candidato precisa permanecer entre os dois primeiros mesmo nesse cenário. Não se usa uma maioria absoluta nem se confunde o limite individual com os dois votos para Senador.
- Para Deputado Federal, Estadual e Distrital, a prova antecipada cobre vagas garantidas por QP: utiliza o maior QE possível, o mínimo garantido de vagas do partido/federação, a exigência nominal de 10% e todos os concorrentes que ainda possam alcançar o candidato dentro do agrupamento. Vagas por sobras continuam provisórias até a totalização/cálculo final ou até não restarem eleitores pendentes, com dados suficientes. As confirmações matemáticas consideram a destinação e elegibilidade atuais; correções de votos e decisões judiciais podem exigir revisão.
- Nos recortes locais de Presidente, consulta-se também o EA20 nacional e inclui-se seu acompanhamento na assinatura. Nos municípios de Governador, consulta-se também o resultado/acompanhamento da UF. O polling exige sincronização dos arquivos agregados; 429 e cancelamento seguem o tratamento compartilhado existente. Votos dos cards e do histórico continuam sendo os do recorte selecionado.
- O catálogo **Eleições disponíveis** foi removido. Permanecem os estados essenciais de carregamento, erro com nova tentativa, ausência de eleições e simulado. Em telas de até 600 px, os filtros e ações ocupam a largura disponível, as abas têm rolagem horizontal e os candidatos usam uma coluna. Tabelas mantêm rolagem própria; nomes longos quebram dentro do card.
- As fotos usam uma borda cinza de 1 px com a mesma cor do card padrão, respeitando os tokens do tema. A borda da foto continua cinza quando o candidato recebe destaque verde.
- Testes específicos verificam limites estritos, segundo turno, cargos, abrangência nacional/estadual, dados insuficientes, todas as distribuições de três votos pendentes em um cenário proporcional, sincronização, chips, compartilhamento e CSS em viewports de 320, 375, 600, 768 e 1280 px em ChromeHeadless. Essa validação não equivale a testes manuais em aparelhos físicos.

## Histórico local e evolução percentual

- Cada resultado aceito é observado pelo `PresidentStore` e salvo no IndexedDB `apurabrasil-history`, na coleção `snapshots`. A chave de contexto separa eleição, cargo, turno, abrangência (Brasil/UF/município) e fase oficial/simulada. O histórico persiste ao recarregar o mesmo navegador e origem; não é enviado a servidores e não recupera resultados anteriores à primeira observação. Não há banco de dados no servidor.
- A gravação ocorre em transação e compara o conteúdo com o último registro do recorte: nova geração ou horário sem mudança de apuração não cria duplicata. Mudanças em votos, percentuais, situação ou totalização geram registros, inclusive correções e reversões. Respostas canceladas ou antigas não são registradas; a gravação local não bloqueia a apresentação da apuração atual.
- A votação ainda não autorizada pelo TSE é omitida do snapshot. Dados municipais e estaduais permanecem separados: o gráfico municipal usa votos e totalização municipais. Fotos, arquivos brutos e resultados estaduais aninhados não são armazenados nesta coleção.
- O gráfico Apache ECharts usa eixo X numérico de seções totalizadas e eixo Y com o percentual oficial do candidato. **Top 2**, **Top 3**, **Top 5** e **Todos** usam o ranking do último registro. Horários do arquivo e da observação, votos e percentuais aparecem no tooltip; uma tabela permite consultar os registros. Ausências não viram zero e não são interpoladas; percentuais iguais em registros distintos são preservados. As cores distinguem as séries e não representam cores partidárias.
- O módulo de gráfico é carregado sob demanda, com renderização SVG, ajuste de tamanho e liberação ao sair do painel, conforme a [documentação do Apache ECharts](https://echarts.apache.org/handbook/en/basics/import/). Falhas ou bloqueios de armazenamento local mostram aviso e preservam a apuração atual. Limpar os dados do navegador remove o histórico. Não há limpeza automática nesta entrega.
- Testes específicos verificam persistência real em IndexedDB, deduplicação concorrente, isolamento, correções, divulgação, respostas antigas, filtros e renderização do gráfico em ChromeHeadless. Não consultam o TSE e usam banco local de teste separado.

## Evolução dos votos absolutos

- Nos dois modos, o eixo horizontal acompanha o menor e o maior percentual de seções totalizadas do histórico selecionado, com margem de 10% do intervalo (mínimo de 0,1 ponto percentual), limitada a 0–100%. Registros com percentual igual continuam visíveis em uma faixa útil, sem alterar os dados. Sem percentuais conhecidos, usa-se a faixa completa.

- O seletor **Percentual / Votos absolutos** alterna o gráfico da aba aberta. Mantém os mesmos candidatos e a seleção **Top 2/3/5/Todos**, com as mesmas cores por candidato. Não consulta novamente o TSE, não recarrega o histórico para alternar a métrica e não altera o schema do IndexedDB.
- Em **Votos absolutos**, o eixo X continua sendo o percentual de seções totalizadas e o eixo Y usa os votos acumulados publicados em cada registro, com escala automática e intervalos inteiros. Rótulos do eixo usam abreviações para números grandes; o tooltip e a tabela preservam os valores completos. Não se somam registros sucessivos, pois cada resultado já contém a votação acumulada.
- Dados ausentes não viram zero, zeros reais são preservados e correções podem reduzir a curva. Votos conhecidos podem ser exibidos mesmo quando o percentual do candidato ainda não está disponível. Continua sendo necessário conhecer o percentual de seções para posicionar o ponto no eixo X; votação não autorizada permanece oculta.
- Testes específicos verificam a alternância do SVG renderizado, manutenção da seleção, ausência de novas leituras ao alternar, valores acima de 100 votos, correções, zeros e campos ausentes. O seletor usa Angular Material e se adapta à largura do celular.

## Visão compacta da apuração

- Cabeçalho com logo e filtros federal/estadual independentes, cinco abas de cargos e resumo com local, turno, horário TSE, progresso e indicadores essenciais. A fonte e a identificação do projeto continuam no rodapé.
- Abas internas Angular Material: **Resultados** abre por padrão, **Evolução** carrega o histórico/gráfico ao ser acessada e **Detalhes da apuração** reúne indicadores completos, explicações e distribuição de vagas. Alternar abas preserva o conteúdo já aberto e não reinicia o polling.
- Os candidatos têm paginação Material em português, com 3 por página por padrão e 6 quando a janela tem pelo menos 1600 × 900. É possível escolher 3, 6 ou 12. A atualização conserva a página, listas menores ajustam o índice e mudanças de cargo, local ou eleição voltam à primeira página. A paginação não faz novas requisições ao TSE. Suplentes de Senador ficam em uma seção expansível no card.
- Testes em ChromeHeadless verificam a visão inicial de Resultados em 1366 × 768 e 1920 × 1080, incluindo cargos estaduais, municípios e Deputado Distrital. Em dispositivos móveis, filtros são empilhados e candidatos usam uma coluna, com rolagem vertical natural e sem transbordamento horizontal da página. Conteúdo detalhado, alertas, nomes longos, suplentes expandidos ou a escolha de mais candidatos podem exigir rolagem; não se bloqueia nem se corta conteúdo para fazê-lo caber.

### Entregas restantes

Escopo definido pelo usuário: somente estas 3 entregas. A publicação automática foi implementada a pedido do usuário antes da PWA:

1. PWA — aplicação instalável.
2. Deploy automático no GitHub Pages — workflow implementado; ativação e primeira execução no GitHub pendentes.
3. Dashboard nacional e agregação regional.

Comparação entre candidatos, busca global, modo TV e mapas do IBGE ficam fora do escopo restante.

Restam 2 entregas funcionais: PWA e dashboard nacional/agregação regional.

Cache persistente, limites de concorrência, documentação e testes específicos acompanham as respectivas entregas.
