const {
  HttpException,
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerException,
} = require('./http.error');
const axios = require('axios');

const {
  checkSomePermissionsInList,
  checkExistPermissionInList,
} = require('./utils');

function getGatewayURLKoa(ctx) {
  return ctx.request.headers['x-gateway-url'];
}

async function request(ctx, options) {
  const baseUrl = getGatewayURLKoa(ctx);
  const url = `${baseUrl}${options.uri}`;
  if (options.json) {
    delete options.json;
    options.responseType = 'json';
  }
  try {
    const response = await axios({
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`,
        'transaction-id': ctx.request.headers['transaction-id']
          ? ctx.request.headers['transaction-id']
          : undefined,
      },
      url,
    });
    return response.data;
  } catch (err) {
    if (err.code === 404) {
      throw new NotFoundException('dataset not found');
    } else if (err.code === 401) {
      throw new UnauthorizedException('Not authenticated');
    } else if (err.code === 403) {
      throw new ForbiddenException('Not authorized');
    }

    throw err;
  }
}

async function checkPermissions(gatewayURL, type, id, permissions) {
  let has = false;
  for (let i = 0; i < permissions.length; i++) {
    try {
      const permission = permissions[i];
      const url = `${gatewayURL}/auth/acl/${type}/${id}/has/${permission.action}/${permission.type}/${permission.value}`;
      const options = {
        uri: url,
        headers: {
          Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`,
        },
        json: true,
      };
      await rp(options);
      has = true;
      break;
    } catch (err) {}
  }

  if (!has) {
    throw new ForbiddenException('Not authorized');
  }
}

async function getPermissions(gatewayURL, type, id) {
  try {
    const url = `${gatewayURL}/auth/acl/permissions/${type}/${id}`;
    const options = {
      uri: url,
      headers: {
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`,
      },
      json: true,
    };
    const permissions = await rp(options);
    return permissions;
  } catch (err) {
    throw new ForbiddenException('Not authorized');
  }
}
async function getPermissionsAnonymous(gatewayURL, type, id) {
  try {
    const url = `${gatewayURL}/auth/acl/permissions/anonymous`;
    const options = {
      uri: url,
      headers: {
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`,
      },
      json: true,
    };
    const permissions = await rp(options);
    return permissions;
  } catch (err) {
    throw new ForbiddenException('Not authorized');
  }
}

function getPermissionsOfHeader(ctx) {
  if (!ctx.headers.permissions) {
    return null;
  }
  try {
    return JSON.parse(ctx.headers.permissions);
  } catch (err) {
    return null;
  }
}

function checkPermissionsKoaMiddleware(permissionsToCheck) {
  return async (ctx, next) => {
    const id = ctx.state.user ? ctx.state.user.id : 'anonymous';
    const type = ctx.state.user ? ctx.state.user.type : 'user';
    const gatewayURL = getGatewayURLKoa(ctx);
    const permissionsOfUser = getPermissionsOfHeader(ctx);
    if (!permissionsOfUser) {
      await checkPermissions(gatewayURL, type, id, permissionsToCheck);
    } else {
      checkSomePermissionsInList(permissionsOfUser, permissionsToCheck);
    }
    await next();
  };
}
function checkPermissionsWithRequestParamsKoaMiddleware(permissions) {
  return async (ctx, next) => {
    const id = ctx.state.user ? ctx.state.user.id : 'anonymous';
    const type = ctx.state.user ? ctx.state.user.type : 'user';
    const gatewayURL = getGatewayURLKoa(ctx);
    const newPerm = permissions.map((p) => {
      const permission = { ...p };
      if (p.valueParam) {
        permission.value = ctx.params[p.valueParam];
      }
      if (p.valueQueryParam) {
        permission.value = ctx.query[p.valueQueryParam]
          ? ctx.query[p.valueQueryParam].split(',')
          : [];
      }
      return permission;
    });
    const permissionsOfUser = getPermissionsOfHeader(ctx);
    if (!permissionsOfUser) {
      await checkPermissions(gatewayURL, type, id, newPerm);
    } else {
      checkSomePermissionsInList(permissionsOfUser, newPerm);
    }
    await next();
  };
}

function obtainPermissionsKoaMiddleware() {
  return async (ctx, next) => {
    const permissionsOfUser = getPermissionsOfHeader(ctx);
    if (permissionsOfUser) {
      ctx.state.permissions = permissionsOfUser;
    } else {
      let id, type;
      const gatewayURL = getGatewayURLKoa(ctx);
      if (ctx.state.user) {
        id = ctx.state.user.id;
        type = ctx.state.user.type;
        const permissions = await getPermissions(gatewayURL, type, id);
        ctx.state.permissions = permissions;
      } else {
        const permissions = await getPermissionsAnonymous(gatewayURL);
        ctx.state.permissions = permissions;
      }
    }

    await next();
  };
}

function obtainUserKoaMiddleware(required = true) {
  return async (ctx, next) => {
    try {
      ctx.state.user = JSON.parse(ctx.request.header.user);
    } catch (err) {
      if (required) {
        throw new UnauthorizedException('Not authorized');
      }
    }
    await next();
  };
}

function healthKoa(checkFn = async () => {}) {
  return async (ctx, next) => {
    if (ctx.request.path === '/health') {
      try {
        await checkFn();
        ctx.body = '';
        ctx.status = 204;
      } catch (err) {
        console.error('Error checking health', err);
        ctx.throw(500, 'Internal server error');
      }
    } else {
      await next();
    }
  };
}

module.exports = {
  koa: {
    request,
    health: healthKoa,
    obtainUser: obtainUserKoaMiddleware,
    checkPermissions: checkPermissionsKoaMiddleware,
    obtainPermissions: obtainPermissionsKoaMiddleware,
    checkPermissionsWithRequestParams:
      checkPermissionsWithRequestParamsKoaMiddleware,
  },
  errors: {
    HttpException,
    BadRequestException,
    UnprocessableEntityException,
    NotFoundException,
    ForbiddenException,
    UnauthorizedException,
    InternalServerException,
  },
  utils: {
    checkExistPermissionInList,
    checkSomePermissionsInList,
  },
};
