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
  { path: 'deputado-federal', redirectTo: '', pathMatch: 'full' },
  { path: 'deputado-federal/uf/:uf/municipio/:codigo', data: { office: 'federal-deputy' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'deputado-federal/uf/:uf', data: { office: 'federal-deputy' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'uf/:uf/municipio/:codigo', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'uf/:uf', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'deputado-estadual', redirectTo: '', pathMatch: 'full' },
  { path: 'deputado-estadual/uf/:uf/municipio/:codigo', data: { office: 'state-deputy' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'deputado-estadual/uf/:uf', data: { office: 'state-deputy' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: '**', redirectTo: '' }
];
