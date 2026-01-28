import {
  HttpException,
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerException,
} from './http.error.js';
import axios, { AxiosRequestConfig } from 'axios';
import {
  checkSomePermissionsInList,
  checkExistPermissionInList,
} from './utils.js';
import type { Permission } from './utils.js';

export interface KoaContext {
  state: {
    user?: { id: string; type: string };
    permissions?: Permission[];
  };
  request: {
    headers: Record<string, string | undefined>;
    path?: string;
    header: Record<string, string | undefined>;
  };
  headers: Record<string, string | undefined>;
  body?: unknown;
  status?: number;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  throw(status: number, message: string): never;
}

export interface RequestOptions {
  uri: string;
  headers?: Record<string, string>;
  json?: boolean;
  [key: string]: unknown;
}

function getGatewayURLKoa(ctx: KoaContext): string {
  return ctx.request.headers['x-gateway-url'] ?? '';
}

export async function request<T = unknown>(
  ctx: KoaContext,
  options: RequestOptions
): Promise<T> {
  const baseUrl = getGatewayURLKoa(ctx);
  const url = `${baseUrl}${options.uri}`;
  const config: AxiosRequestConfig = { ...options };
  if (options.json) {
    delete (config as RequestOptions).json;
    config.responseType = 'json';
  }
  try {
    const response = await axios({
      ...config,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`,
        'transaction-id': ctx.request.headers['transaction-id'] ?? undefined,
      },
      url,
    });
    return response.data as T;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status: number } };
    const code = axiosErr.response?.status;
    if (code === 404) {
      throw new NotFoundException('dataset not found');
    } else if (code === 401) {
      throw new UnauthorizedException('Not authenticated');
    } else if (code === 403) {
      throw new ForbiddenException('Not authorized');
    }

    throw err;
  }
}

async function checkPermissions(
  gatewayURL: string,
  type: string,
  id: string,
  permissions: Permission[]
): Promise<void> {
  let has = false;
  for (let i = 0; i < permissions.length; i++) {
    try {
      const permission = permissions[i];
      const valueStr = Array.isArray(permission.value)
        ? permission.value[0]
        : permission.value;
      const url = `${gatewayURL}/auth/acl/${type}/${id}/has/${permission.action}/${permission.type}/${valueStr}`;
      await axios({
        method: 'get',
        url,
        headers: {
          Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`,
        },
        responseType: 'json',
      });
      has = true;
      break;
    } catch {
      // continue to next permission
    }
  }

  if (!has) {
    throw new ForbiddenException('Not authorized');
  }
}

async function getPermissions(
  gatewayURL: string,
  type: string,
  id: string
): Promise<Permission[]> {
  try {
    const url = `${gatewayURL}/auth/acl/permissions/${type}/${id}`;
    const response = await axios({
      method: 'get',
      url,
      headers: {
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`,
      },
      responseType: 'json',
    });
    return response.data as Permission[];
  } catch {
    throw new ForbiddenException('Not authorized');
  }
}

async function getPermissionsAnonymous(
  gatewayURL: string
): Promise<Permission[]> {
  try {
    const url = `${gatewayURL}/auth/acl/permissions/anonymous`;
    const response = await axios({
      method: 'get',
      url,
      headers: {
        Authorization: `Bearer ${process.env.GFW_APP_TOKEN}`,
      },
      responseType: 'json',
    });
    return response.data as Permission[];
  } catch {
    throw new ForbiddenException('Not authorized');
  }
}

function getPermissionsOfHeader(ctx: KoaContext): Permission[] | null {
  if (!ctx.headers.permissions) {
    return null;
  }
  try {
    return JSON.parse(ctx.headers.permissions) as Permission[];
  } catch {
    return null;
  }
}

export function checkPermissionsKoaMiddleware(permissionsToCheck: Permission[]) {
  return async (ctx: KoaContext, next: () => Promise<void>): Promise<void> => {
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

export interface PermissionWithParams extends Permission {
  valueParam?: string;
  valueQueryParam?: string;
}

export function checkPermissionsWithRequestParamsKoaMiddleware(
  permissions: PermissionWithParams[]
) {
  return async (ctx: KoaContext, next: () => Promise<void>): Promise<void> => {
    const id = ctx.state.user ? ctx.state.user.id : 'anonymous';
    const type = ctx.state.user ? ctx.state.user.type : 'user';
    const gatewayURL = getGatewayURLKoa(ctx);
    const newPerm: Permission[] = permissions.map((p) => {
      const permission: Permission = { ...p };
      if (p.valueParam) {
        permission.value = ctx.params[p.valueParam];
      }
      if (p.valueQueryParam) {
        const q = ctx.query[p.valueQueryParam];
        permission.value = q ? q.split(',') : [];
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

export function obtainPermissionsKoaMiddleware() {
  return async (ctx: KoaContext, next: () => Promise<void>): Promise<void> => {
    const permissionsOfUser = getPermissionsOfHeader(ctx);
    if (permissionsOfUser) {
      ctx.state.permissions = permissionsOfUser;
    } else {
      const gatewayURL = getGatewayURLKoa(ctx);
      if (ctx.state.user) {
        const id = ctx.state.user.id;
        const type = ctx.state.user.type;
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

export function obtainUserKoaMiddleware(required = true) {
  return async (ctx: KoaContext, next: () => Promise<void>): Promise<void> => {
    try {
      const userHeader = ctx.request.header.user;
      ctx.state.user = userHeader
        ? (JSON.parse(userHeader) as { id: string; type: string })
        : undefined;
    } catch {
      if (required) {
        throw new UnauthorizedException('Not authorized');
      }
    }
    await next();
  };
}

export function healthKoa(checkFn: () => Promise<void> = async () => {}) {
  return async (ctx: KoaContext, next: () => Promise<void>): Promise<void> => {
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

export default {
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
