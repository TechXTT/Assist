export class BankingNotConfiguredError extends Error {
  constructor(message = "GOCARDLESS_SECRET_ID / GOCARDLESS_SECRET_KEY not set.") {
    super(message);
    this.name = "BankingNotConfiguredError";
  }
}

export class BankingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "BankingApiError";
  }
}

export class RequisitionExpiredError extends Error {
  constructor(message = "Bank connection has expired — reconnect required.") {
    super(message);
    this.name = "RequisitionExpiredError";
  }
}
