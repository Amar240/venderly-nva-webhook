const { getTimezone } = require('./timezone');

const SNAPSHOT_ENV_BY_CUSTOMER_TYPE = Object.freeze({
  'Small Business': 'SNAPSHOT_SMALL_BUSINESS',
  'Side Hustle': 'SNAPSHOT_SIDE_HUSTLE',
  'School (District)': 'SNAPSHOT_SCHOOL',
  Nonprofit: 'SNAPSHOT_NONPROFIT',
  'Bank or Fintech': 'SNAPSHOT_BANK'
});

const SUPPORTED_CUSTOMER_TYPES = Object.freeze(Object.keys(SNAPSHOT_ENV_BY_CUSTOMER_TYPE));

function isSupportedCustomerType(customerType) {
  return SUPPORTED_CUSTOMER_TYPES.includes(customerType);
}

function getSnapshotId(customerType) {
  const snapshotEnvName = SNAPSHOT_ENV_BY_CUSTOMER_TYPE[customerType];
  return (snapshotEnvName && process.env[snapshotEnvName]) || process.env.SNAPSHOT_DEFAULT || null;
}

function buildLocationPayload(data, options = {}) {
  // Handle both field names — NVA form sends business_type, code expects customer_type
  const customerType = data.customer_type || data.business_type;

  return {
    name: data.company_name,
    companyId: options.companyId,
    phone: data.phone,
    address: data.address1 || data.address,
    city: data.city,
    state: data.state,
    country: data.country || 'US',
    postalCode: data.postal_code,
    website: data.website || '',
    timezone: getTimezone(data.postal_code),
    settings: {
      allowDuplicateContact: false,
      allowDuplicateOpportunity: false,
      allowFacebookNameMerge: false,
      disableContactTimezone: false
    },
    prospectInfo: {
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email
    }
  };
}

module.exports = {
  SUPPORTED_CUSTOMER_TYPES,
  buildLocationPayload,
  getSnapshotId,
  isSupportedCustomerType
};
