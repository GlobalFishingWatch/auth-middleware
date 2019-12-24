const { ForbiddenException } = require('./http.error');
const rp = require('request-promise');

function getGatewayURLKoa(ctx) {
  return ctx.request.headers['x-gateway-url'];
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

function checkPermissionsKoaMiddleware(permissions) {
  return async (ctx, next) => {
    const id = ctx.state.user.id;
    const type = ctx.state.user.type;
    const gatewayURL = getGatewayURLKoa(ctx);
    await checkPermissions(gatewayURL, type, id, permissions);
    await next();
  };
}
function checkPermissionsWithRequestParamsKoaMiddleware(permissions) {
  return async (ctx, next) => {
    const id = ctx.state.user.id;
    const type = ctx.state.user.type;
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
    const id = ctx.state.user.id;
    const type = ctx.state.user.type;
    const gatewayURL = getGatewayURLKoa(ctx);
    const permissions = await getPermissions(gatewayURL, type, id);
    ctx.state.permissions = permissions;
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

async function healthKoa(checkFn = async () => {}) {
  return async ctx => {
    if (ctx.request.path === '/health') {
      try {
        await checkFn();
        ctx.body = '';
        ctx.status = 204;
      } catch (err) {
        console.error('Error checking health', err);
        ctx.throw(500, 'Internal server error');
      }
    }
  };
}

module.exports = {
  koa: {
    health: healthKoa,
    obtainUser: obtainUserKoaMiddleware,
    checkPermissions: checkPermissionsKoaMiddleware,
    obtainPermissions: obtainPermissionsKoaMiddleware,
    checkPermissionsWithRequestParams: checkPermissionsWithRequestParamsKoaMiddleware
  },
  errors: {
    ForbiddenException
  }
};
