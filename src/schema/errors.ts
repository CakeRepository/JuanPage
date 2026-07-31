export class DocumentValidationError extends Error {
  readonly details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = "DocumentValidationError";
    this.details = details;
  }
}
