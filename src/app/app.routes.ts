import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: 'presidente', redirectTo: '', pathMatch: 'full' },
  { path: 'uf/:uf', loadComponent: () => import('./features/president/president.component').then(m => m.PresidentComponent) },
  { path: '**', redirectTo: '' }
];
