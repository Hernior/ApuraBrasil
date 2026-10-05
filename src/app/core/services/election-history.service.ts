import { inject, Injectable, InjectionToken, OnDestroy, signal } from '@angular/core';
import { ElectionResult } from '../models/election-result.model';
import { createElectionSnapshot, ElectionHistoryContext, ElectionSnapshot, historyContextKey, snapshotContent } from '../models/election-snapshot.model';

export const HISTORY_DATABASE_NAME = new InjectionToken<string>('HISTORY_DATABASE_NAME', { providedIn: 'root', factory: () => 'apurabrasil-history' });

@Injectable({ providedIn: 'root' })
export class ElectionHistoryService implements OnDestroy {
  private readonly databaseName = inject(HISTORY_DATABASE_NAME);
  private connection: Promise<IDBDatabase> | null = null;
  readonly revision = signal(0);
  readonly error = signal<string | null>(null);

  private open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    this.connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
        store.createIndex('context', 'contextKey');
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error('Banco local bloqueado por outra aba.')); };
      request.onsuccess = () => {
        const database = request.result;
        if (blocked) { database.close(); return; }
        database.onversionchange = () => { database.close(); this.connection = null; };
        resolve(database);
      };
    }).catch(error => { this.connection = null; throw error; });
    return this.connection;
  }

  async record(result: ElectionResult): Promise<void> {
    // Capture now: a later navigation or polling update must not alter this observation.
    const snapshot = createElectionSnapshot(result);
    try {
      const database = await this.open();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('snapshots', 'readwrite');
        const store = transaction.objectStore('snapshots');
        const latest = store.index('context').openCursor(IDBKeyRange.only(snapshot.contextKey), 'prev');
        latest.onsuccess = () => {
          const previous = latest.result?.value as ElectionSnapshot | undefined;
          if (!previous || snapshotContent(previous) !== snapshotContent(snapshot)) store.add(snapshot);
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('Gravação local interrompida.'));
        transaction.onerror = () => reject(transaction.error);
      });
      this.error.set(null);
      // Another browser tab may have saved this same observation first.
      this.revision.update(value => value + 1);
    } catch {
      this.error.set('Não foi possível salvar o histórico neste navegador. A apuração atual continua disponível.');
    }
  }

  async read(context: ElectionHistoryContext): Promise<ElectionSnapshot[]> {
    try {
      const database = await this.open();
      const snapshots = await new Promise<ElectionSnapshot[]>((resolve, reject) => {
        const transaction = database.transaction('snapshots', 'readonly');
        const request = transaction.objectStore('snapshots').index('context').getAll(historyContextKey(context));
        transaction.oncomplete = () => resolve(request.result as ElectionSnapshot[]);
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
      return snapshots;
    } catch {
      this.error.set('O histórico local está indisponível neste navegador. A apuração atual continua disponível.');
      return [];
    }
  }
  ngOnDestroy(): void { void this.connection?.then(database => database.close(), () => {}); }
}
