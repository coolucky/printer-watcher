/**
 * Print Servers Route
 * CRUD operations + monitoring data endpoints for print servers
 */
const express = require('express');
const router = express.Router();
const printServerService = require('../services/printServerMonitoringService');
const { authorizeRole } = require('../middleware/authMiddleware');

/**
 * GET / - Get all print servers with current status
 */
router.get('/', (req, res) => {
  try {
    const servers = printServerService.getAllStatus();
    res.apiSuccess(servers, 'Print servers fetched');
  } catch (error) {
    res.apiError('Failed to get print servers', 500, error.message);
  }
});

/**
 * POST / - Add a new print server
 */
router.post('/', authorizeRole(['Administrator', 'Editor']), (req, res) => {
  try {
    const { name, ip, enabled } = req.body;
    if (!name || !ip) {
      return res.apiError('Name and IP are required', 400);
    }
    // Validate IP format (basic)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
    if (!ipRegex.test(ip)) {
      return res.apiError('Invalid IP address or hostname format', 400);
    }
    const server = printServerService.addServer({ name, ip, enabled });
    res.apiSuccess(server, 'Print server added');
  } catch (error) {
    res.apiError('Failed to add print server', 500, error.message);
  }
});

/**
 * PUT /:id - Update a print server
 */
router.put('/:id', authorizeRole(['Administrator', 'Editor']), (req, res) => {
  try {
    const { id } = req.params;
    const { name, ip, enabled } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (ip !== undefined) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
      if (!ipRegex.test(ip)) {
        return res.apiError('Invalid IP address or hostname format', 400);
      }
      updates.ip = ip;
    }
    if (enabled !== undefined) updates.enabled = !!enabled;

    const server = printServerService.updateServer(id, updates);
    if (!server) {
      return res.apiError('Print server not found', 404);
    }
    res.apiSuccess(server, 'Print server updated');
  } catch (error) {
    res.apiError('Failed to update print server', 500, error.message);
  }
});

/**
 * DELETE /:id - Delete a print server
 */
router.delete('/:id', authorizeRole(['Administrator', 'Editor']), (req, res) => {
  try {
    const { id } = req.params;
    const result = printServerService.deleteServer(id);
    if (!result) {
      return res.apiError('Print server not found', 404);
    }
    res.apiSuccess(null, 'Print server deleted');
  } catch (error) {
    res.apiError('Failed to delete print server', 500, error.message);
  }
});

/**
 * GET /status - Get current status of all servers
 */
router.get('/status', (req, res) => {
  try {
    const status = printServerService.getAllStatus(true);
    res.apiSuccess(status, 'Server status fetched');
  } catch (error) {
    res.apiError('Failed to get server status', 500, error.message);
  }
});

/**
 * GET /timeline - Get timeline data for all servers
 * Query params: range (1h, 6h, 24h, 7d) or startTime/endTime
 */
router.get('/timeline', (req, res) => {
  try {
    const { range, startTime, endTime } = req.query;
    let start, end;
    end = Date.now();

    if (startTime && endTime) {
      start = parseInt(startTime);
      end = parseInt(endTime);
    } else {
      const rangeMap = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      const duration = rangeMap[range] || rangeMap['24h'];
      start = end - duration;
    }

    const timelines = printServerService.getAllTimelines(start, end, true);
    res.apiSuccess({ timelines, startTime: start, endTime: end }, 'Timeline data fetched');
  } catch (error) {
    res.apiError('Failed to get timeline data', 500, error.message);
  }
});

/**
 * GET /logs - Get status change logs
 * Query params: serverId, event, startTime, endTime, limit, offset
 */
router.get('/logs', (req, res) => {
  try {
    const { serverId, event, startTime, endTime, limit, offset } = req.query;
    const filters = {};
    if (serverId) filters.serverId = serverId;
    if (event) filters.event = event;
    if (startTime) filters.startTime = parseInt(startTime);
    if (endTime) filters.endTime = parseInt(endTime);
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const logs = printServerService.getLogs(filters);
    res.apiSuccess(logs, 'Logs fetched');
  } catch (error) {
    res.apiError('Failed to get logs', 500, error.message);
  }
});

/**
 * GET /uptime - Get uptime statistics
 * Query params: range (24h, 7d, 30d)
 */
router.get('/uptime', (req, res) => {
  try {
    const { range } = req.query;
    const end = Date.now();
    const rangeMap = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    const duration = rangeMap[range] || rangeMap['24h'];
    const start = end - duration;

    const servers = printServerService.getServers().filter(s => s.enabled);
    const stats = {};
    for (const server of servers) {
      stats[server.id] = {
        ...server,
        ...printServerService.getUptimeStats(server.id, start, end)
      };
    }
    res.apiSuccess(stats, 'Uptime statistics fetched');
  } catch (error) {
    res.apiError('Failed to get uptime stats', 500, error.message);
  }
});

module.exports = { router };
