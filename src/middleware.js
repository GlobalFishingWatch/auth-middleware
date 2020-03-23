const {
  HttpException,
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerException
} = require('./http.error');
const rp = require('request-promise');

function getGatewayURLKoa(ctx) {
  return ctx.request.headers['x-gateway-url'];
}

async function request(ctx, options) {
  const baseUrl = getGatewayURLKoa(ctx);
  const uri = `${baseUrl}${options.uri}`;
  const options = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`
      },
      uri
    };
  try {
    return await rp(options);
  } catch (err) {
    console.log('Options in request', options)
    console.error('ERror in request', err);
    if (err.statusCode === 404) {
      throw new NotFoundException('dataset not found');
    } else if (err.statusCode === 401) {
      throw new UnauthorizedException('Not authenticated');
    } else if (err.statusCode === 403) {
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
          Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`
        },
        json: true
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
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`
      },
      json: true
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
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`
      },
      json: true
    };
    const permissions = await rp(options);
    return permissions;
  } catch (err) {
    throw new ForbiddenException('Not authorized');
  }
}

function checkPermissionsKoaMiddleware(permissions) {
  return async (ctx, next) => {
    const id = ctx.state.user ? ctx.state.user.id : 'anonymous';
    const type = ctx.state.user ? ctx.state.user.type : 'user';
    const gatewayURL = getGatewayURLKoa(ctx);
    await checkPermissions(gatewayURL, type, id, permissions);
    await next();
  };
}
function checkPermissionsWithRequestParamsKoaMiddleware(permissions) {
  return async (ctx, next) => {
    const id = ctx.state.user ? ctx.state.user.id : 'anonymous';
    const type = ctx.state.user ? ctx.state.user.type : 'user';
    const gatewayURL = getGatewayURLKoa(ctx);
    const newPerm = permissions.map(p => {
      if (p.valueParam) {
        return { ...p, value: ctx.params[p.valueParam] };
      }
      return { ...p };
    });
    await checkPermissions(gatewayURL, type, id, newPerm);
    await next();
  };
}

function obtainPermissionsKoaMiddleware() {
  return async (ctx, next) => {
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
    checkPermissionsWithRequestParams: checkPermissionsWithRequestParamsKoaMiddleware
  },
  errors: {
    HttpException,
    BadRequestException,
    UnprocessableEntityException,
    NotFoundException,
    ForbiddenException,
    UnauthorizedException,
    InternalServerException
  },
  utils: require('./utils')
};
