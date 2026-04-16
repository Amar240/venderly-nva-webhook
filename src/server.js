const app = require('./app');
const { getEnv } = require('./config/env');
const logger = require('./utils/logger');

const { port } = getEnv();

app.listen(port, '0.0.0.0', () => {
  logger.info(`Server running on port ${port}`);
});
