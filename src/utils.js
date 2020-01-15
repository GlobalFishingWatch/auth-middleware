function checkExistPermissionInList(permissions, { action, type, value }) {
  return permissions.some(p => {
    if (p.type === type && p.action === action) {
      if (p.value.trim().endsWith('*')) {
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
    }
    return false;
  });
}

module.exports = {
  checkExistPermissionInList
};
