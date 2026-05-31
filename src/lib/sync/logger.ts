export class SyncLogger {
  private _logs: string[] = [];
  readonly verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(msg: string) {
    console.log(`[sync] ${msg}`);
    this._logs.push(`[INFO] ${msg}`);
  }

  debug(msg: string) {
    if (!this.verbose) return;
    console.log(`[sync:verbose] ${msg}`);
    this._logs.push(`[DEBUG] ${msg}`);
  }

  error(msg: string) {
    console.error(`[sync] ERROR ${msg}`);
    this._logs.push(`[ERROR] ${msg}`);
  }

  getLogs(): string[] {
    return [...this._logs].slice(0, 2000);
  }
}
