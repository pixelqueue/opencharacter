export interface Finding {
  file: string;
  message: string;
}

export class Reporter {
  readonly errors: Finding[] = [];
  readonly warnings: Finding[] = [];

  error(file: string, message: string): void {
    this.errors.push({ file, message });
  }

  warn(file: string, message: string): void {
    this.warnings.push({ file, message });
  }
}
