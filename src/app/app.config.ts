import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withHashLocation } from '@angular/router';
import { ELECTION_DATA_PROVIDER } from './core/api/election-data-provider';
import { TseApiService } from './core/api/tse-api.service';
import { routes } from './app.routes';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideHttpClient(),
    { provide: ELECTION_DATA_PROVIDER, useExisting: TseApiService },
    provideRouter(routes, withHashLocation()),
    provideAnimationsAsync()
  ]
};
