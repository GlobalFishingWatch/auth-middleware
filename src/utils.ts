import { ForbiddenException } from './http.error.js';

export interface Permission {
  action: string;
  type: string;
  value: string | string[];
}

export function checkExistPermissionInList(
  permissions: Permission[],
  { action, type, value }: Permission
): boolean {
  if (Array.isArray(value)) {
    return value.every((v) => {
      return permissions.some((p) => {
        if (p.action !== action || p.type !== type) {
          return false;
        }
        const pVal = typeof p.value === 'string' ? p.value : String(p.value);
        if (pVal.trim().endsWith('*') && pVal.trim().startsWith('*')) {
          if (!String(v).includes(pVal.replace(/\*/g, ''))) {
            return false;
          }
        } else if (pVal.trim().endsWith('*')) {
          if (!String(v).startsWith(pVal.replace(/\*/g, ''))) {
            return false;
          }
        } else if (pVal.trim().startsWith('*')) {
          if (!String(v).endsWith(pVal.replace(/\*/g, ''))) {
            return false;
          }
        } else if (v !== p.value) {
          return false;
        }

        return true;
      });
    });
  } else {
    return permissions.some((p) => {
      if (p.action !== action || p.type !== type) {
        return false;
      }
      const pVal = typeof p.value === 'string' ? p.value : String(p.value);
      if (pVal.trim().endsWith('*') && pVal.trim().startsWith('*')) {
        if (!String(value).includes(pVal.replace(/\*/g, ''))) {
          return false;
        }
      } else if (pVal.trim().endsWith('*')) {
        if (!String(value).startsWith(pVal.replace(/\*/g, ''))) {
          return false;
        }
      } else if (pVal.trim().startsWith('*')) {
        if (!String(value).endsWith(pVal.replace(/\*/g, ''))) {
          return false;
        }
      } else if (value !== p.value) {
        return false;
      }

      return true;
    });
  }
}

export function checkSomePermissionsInList(
  userPermissions: Permission[],
  permissionsToCheck: Permission[]
): void {
  const exists = permissionsToCheck.findIndex((p) =>
    checkExistPermissionInList(userPermissions, p)
  );
  if (exists === -1) {
    throw new ForbiddenException('Not authorized');
  }
}
