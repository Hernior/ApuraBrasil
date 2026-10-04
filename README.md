# ApuraBrasil

SPA estática para acompanhamento das Eleições Gerais de 2026. O projeto não é afiliado ao Tribunal Superior Eleitoral.

## Estado desta entrega

Base migrada para Angular 20, standalone, Signals, TypeScript strict, SCSS e Angular Material 20. A descoberta das eleições gerais de 2026 consulta o EA11 oficial diretamente do navegador. O painel de Presidente nacional consulta o EA20 oficial, com atualização manual e automática orientada pelo EA14; não há resultados fictícios.

Resultados por UF e município, demais cargos, histórico, mapas, PWA e workflow de publicação serão implementados em entregas posteriores.

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
A publicação automática ainda não foi configurada nesta entrega.

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

Esta entrega acompanha apenas Presidente nacional. EA15, consultas por UF/município, fila geral de concorrência, IndexedDB e snapshots permanecem para próximas etapas. Não altera schema nem grava em banco de dados.
