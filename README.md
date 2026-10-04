# ApuraBrasil

SPA estática para acompanhamento das Eleições Gerais de 2026. O projeto não é afiliado ao Tribunal Superior Eleitoral.

## Estado desta entrega

Base migrada para Angular 20, standalone, Signals, TypeScript strict, SCSS e Angular Material 20. A tela indica que a integração está pendente. Não há consultas ao TSE nem resultados fictícios.

Descoberta das eleições, resultados oficiais, polling, histórico, mapas, PWA e workflow de publicação serão implementados em entregas posteriores.

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
