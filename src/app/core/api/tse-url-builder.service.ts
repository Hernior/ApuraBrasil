import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TseUrlBuilderService {
  configurationUrl(baseUrl: string = environment.tseBaseUrl, source: string = environment.tseEnvironment): string {
    return `${baseUrl.replace(/\/+$/, '')}/${source}/comum/config/ele-c.json`;
  }
}
