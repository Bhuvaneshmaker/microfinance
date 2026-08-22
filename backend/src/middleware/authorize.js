const authorize = ({ permissions = [], roles = [] } = {}) => {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Role information missing' } });
    }

    const hasRole = roles.length > 0 && roles.includes(role.name);
    const hasPermission = permissions.some((permission) => role[permission]);

    if (!hasRole && !hasPermission) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    next();
  };
};

module.exports = authorize;
