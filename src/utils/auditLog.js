import AuditLog from '../models/AuditLog.js';

const recordAuditLog = (req, event) =>
  AuditLog.create({
    actor: req.user?._id,
    actorRole: req.user?.role || 'system',
    ...event,
  });

export default recordAuditLog;
