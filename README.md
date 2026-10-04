# ApuraBrasil

SPA estática para acompanhamento das Eleições Gerais de 2026. O projeto não é afiliado ao Tribunal Superior Eleitoral.

## Estado desta entrega

Base migrada para Angular 20, standalone, Signals, TypeScript strict, SCSS e Angular Material 20. A descoberta das eleições gerais de 2026 consulta o EA11 oficial diretamente do navegador. Os resultados da apuração ainda não foram integrados; não há resultados fictícios.

Resultados oficiais, polling, histórico, mapas, PWA e workflow de publicação serão implementados em entregas posteriores.

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
- Isso valida o acesso ao EA11 nas condições testadas; EA12, EA14, EA15 e EA20 ainda precisam de verificações próprias. O portal publicado no GitHub Pages ainda não foi testado.

## Ambientes

`environment.ts` e `environment.prod.ts` definem `tseBaseUrl` e `tseEnvironment`.
Para desenvolvimento com a origem oficial de simulado, configure no arquivo de desenvolvimento:

```ts
tseBaseUrl: 'https://resultados-sim.tse.jus.br/simulado',
tseEnvironment: 'simulado2026'
```

A disponibilidade do simulado depende do TSE. A tela identifica configuração com fase `s`; o build de produção recusa essa fase.
A data/hora apresentada nesta entrega é a geração da configuração EA11, não uma atualização de votos.
