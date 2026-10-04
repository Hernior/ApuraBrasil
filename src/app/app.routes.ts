import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'presidente', redirectTo: '', pathMatch: 'full' },
  { path: 'governador', redirectTo: '', pathMatch: 'full' },
  { path: 'governador/uf/:uf/municipio/:codigo', data: { office: 'governor' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'governador/uf/:uf', data: { office: 'governor' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'senador', redirectTo: '', pathMatch: 'full' },
  { path: 'senador/uf/:uf/municipio/:codigo', data: { office: 'senator' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'senador/uf/:uf', data: { office: 'senator' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'uf/:uf/municipio/:codigo', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'uf/:uf', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  ...[
    { path: 'deputado-federal', office: 'federal-deputy' },
    { path: 'deputado-estadual', office: 'state-deputy' }
  ].flatMap(tab => [
    { path: tab.path, redirectTo: '', pathMatch: 'full' as const },
    { path: `${tab.path}/uf/:uf/municipio/:codigo`, data: { office: tab.office }, loadComponent: () => import('./features/pending/pending-office.component').then(m => m.PendingOfficeComponent) },
    { path: `${tab.path}/uf/:uf`, data: { office: tab.office }, loadComponent: () => import('./features/pending/pending-office.component').then(m => m.PendingOfficeComponent) }
  ]),
  { path: '**', redirectTo: '' }
];
