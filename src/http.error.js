class HttpException extends Error {
  constructor(code, msg, params = {}) {
    super(msg);
    this.code = code;
    this.params = params;
  }
}

class ForbiddenException extends HttpException {
  constructor(msg) {
    super(403, msg);
  }
}
module.exports = {
  ForbiddenException,
};
