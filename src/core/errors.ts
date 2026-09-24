export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class TargetNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TargetNotAllowedError';
  }
}
