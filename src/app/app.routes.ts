import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'presidente', redirectTo: '', pathMatch: 'full' },
  { path: 'governador', data: { office: 'governor' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'governador/uf/:uf/municipio/:codigo', data: { office: 'governor' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'governador/uf/:uf', data: { office: 'governor' }, loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'uf/:uf/municipio/:codigo', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'uf/:uf', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: '**', redirectTo: '' }
];
