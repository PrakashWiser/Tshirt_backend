import test from 'node:test';
import assert from 'node:assert/strict';
import AuditLog from '../models/AuditLog.js';
import { getAdminNotifications } from '../controllers/adminController.js';

test('admin notifications adapt persisted audit logs to the dashboard log shape', async () => {
  const originalFind = AuditLog.find;
  const originalCountDocuments = AuditLog.countDocuments;
  const createdAt = new Date('2026-10-03T00:00:00.000Z');
  const log = {
    _id: 'log-id',
    actor: { name: 'Admin User', email: 'admin@example.com', mobile: '1234567890' },
    action: 'product.deleted',
    resource: 'product',
    resourceId: 'product-id',
    description: 'Product Classic Tee was deleted',
    metadata: { name: 'Classic Tee' },
    createdAt,
  };
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  AuditLog.find = () => ({
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    populate() { return this; },
    async lean() { return [log]; },
  });
  AuditLog.countDocuments = async () => 1;

  try {
    await getAdminNotifications({ query: {} }, response, (error) => {
      throw error;
    });
  } finally {
    AuditLog.find = originalFind;
    AuditLog.countDocuments = originalCountDocuments;
  }

  const { notification_, notifications, auditLogs, pagination } = response.body.data;
  assert.deepEqual(notifications, notification_);
  assert.equal(notifications[0].message, log.description);
  assert.equal(notifications[0].timestamp, createdAt.toISOString());
  assert.equal(notifications[0].severity, 'CRITICAL');
  assert.equal(notifications[0].fullName, 'Admin User');
  assert.equal(notifications[0].email, 'admin@example.com');
  assert.equal(notifications[0].phone, '1234567890');
  assert.equal(notifications[0].category, 'product');
  assert.equal(notifications[0].propertyId, 'product-id');
  assert.deepEqual(auditLogs, [log]);
  assert.deepEqual(pagination, { total: 1, page: 1, limit: 10, totalPages: 1 });
});
