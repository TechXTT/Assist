export class NotConnectedError extends Error {
  constructor(message = "Google account not connected.") {
    super(message);
    this.name = "NotConnectedError";
  }
}

export class ReauthRequiredError extends Error {
  constructor(message = "Google needs to be reconnected.") {
    super(message);
    this.name = "ReauthRequiredError";
  }
}
