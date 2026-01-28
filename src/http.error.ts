// eslint-disable-next-line max-classes-per-file
export class HttpException extends Error {
  code: number;
  msg: string;
  params: unknown;

  constructor(code: number, msg: string, params: unknown = {}) {
    super(msg);
    this.code = code;
    this.msg = msg;
    this.params = params;
  }
}

export class BadRequestException extends HttpException {
  constructor(msg: string) {
    super(400, msg);
  }
}

export class InternalServerException extends HttpException {
  constructor(msg: string) {
    super(500, msg);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(msg: string) {
    super(401, msg);
  }
}

export class ForbiddenException extends HttpException {
  constructor(msg: string) {
    super(403, msg);
  }
}

export class NotFoundException extends HttpException {
  constructor(msg: string) {
    super(404, msg);
  }
}

export class UnprocessableEntityException extends HttpException {
  constructor(msg: string, params?: unknown[] | unknown) {
    const p = Array.isArray(params) ? params : params !== undefined ? [params] : [];
    super(422, msg, p);
  }
}
