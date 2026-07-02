// Run once manually with `node scripts/test-create-ghl-user.js`, then delete or gitignore — not for production use.
require('dotenv').config({ quiet: true });
const { GhlUserApiError, createSubAccountUser } = require('../src/services/ghl-user-service');

async function main() {
  const result = await createSubAccountUser({
    locationId: 'bDzcN87S8TJmlcG3HIun',
    email: 'amarnathgoud240@gmail.com',
    firstName: 'DevDemo',
    lastName: 'User',
    phone: '+15555550123'
  });

  console.log('GHL user creation result:');
  console.dir(result, { depth: null });
}

main().catch((error) => {
  if (error instanceof GhlUserApiError) {
    console.error('GHL user creation failed:');
    console.error({
      name: error.name,
      message: error.message,
      status: error.status,
      details: error.details,
      email: error.email,
      locationId: error.locationId,
      likelyDuplicate: error.likelyDuplicate,
      stack: error.stack
    });
    process.exitCode = 1;
    return;
  }

  console.error('Unexpected error while creating GHL user:');
  console.error(error);
  process.exitCode = 1;
});
