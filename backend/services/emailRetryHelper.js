const DEFAULT_RETRY_DELAYS_MS = [1000, 3000, 10000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableEmailError(error) {
  if (!error) {
    return false;
  }

  const retryableCodes = new Set([
    'ECONNRESET',
    'ECONNECTION',
    'EPIPE',
    'ETIMEDOUT',
    'ESOCKET',
    'ETLS',
    'EPROTOCOL'
  ]);

  if (error.code && retryableCodes.has(String(error.code).toUpperCase())) {
    return true;
  }

  const message = String(error.message || '').toLowerCase();
  return [
    'unexpected socket close',
    'connection closed',
    'connection timeout',
    'socket closed',
    'timed out',
    'greeting never received',
    'read econnreset',
    'write epipe'
  ].some((keyword) => message.includes(keyword));
}

async function sendMailWithRetry({
  createTransporter,
  mailOptions,
  contextLabel,
  logger = console,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS
}) {
  let lastError = null;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const transporter = createTransporter();
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      lastError = error;
      const canRetry = isRetryableEmailError(error) && attempt < retryDelaysMs.length;

      if (!canRetry) {
        throw error;
      }

      const waitMs = retryDelaysMs[attempt];
      logger.warn(
        `[EmailRetry] ${contextLabel} attempt ${attempt + 1} failed: ${error.message}. Retrying in ${waitMs}ms.`
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
}

module.exports = {
  DEFAULT_RETRY_DELAYS_MS,
  isRetryableEmailError,
  sendMailWithRetry,
  sleep
};