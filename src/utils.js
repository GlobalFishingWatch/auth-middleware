const { ForbiddenException } = require('./http.error');

function checkExistPermissionInList(permissions, { action, type, value }) {
  return permissions.some((p) => {
    if (p.action !== action || p.type !== type) {
      return false;
    }
    if (p.value.trim().endsWith('*') && p.value.trim().startsWith('*')) {
      if (!value.includes(p.value.replace(/\*/g, ''))) {
        return false;
      }
    } else if (p.value.trim().endsWith('*')) {
      if (!value.startsWith(p.value.replace(/\*/g, ''))) {
        return false;
      }
    } else if (p.value.trim().startsWith('*')) {
      if (!value.endsWith(p.value.replace(/\*/g, ''))) {
        return false;
      }
    } else if (value !== p.value) {
      return false;
    }

    return true;
  });
}

function checkSomePermissionsInList(userPermissions, permissionsToCheck) {
  const exists = permissionsToCheck.findIndex((p) =>
    checkExistPermissionInList(userPermissions, p)
  );
  if (exists === -1) {
    throw new ForbiddenException('Not authorized');
  }
}

module.exports = {
  checkExistPermissionInList,
  checkSomePermissionsInList,
};
