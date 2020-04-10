function checkExistPermissionInList(permissions, { action, type, value }) {
  return permissions.some((p) => {
    if (p.action !== action || p.type !== type) {
      return false;
    }
    if (value.trim().endsWith('*') && value.trim().startsWith('*')) {
      if (!p.value.includes(value.replace(/\*/g, ''))) {
        return false;
      }
    } else if (value.trim().endsWith('*')) {
      if (!p.value.startsWith(value.replace(/\*/g, ''))) {
        return false;
      }
    } else if (value.trim().startsWith('*')) {
      if (!p.value.endsWith(value.replace(/\*/g, ''))) {
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
