const { getTimezone } = require('./timezone');

const SNAPSHOT_MAP = {
  'Small Business': process.env.SNAPSHOT_SMALL_BUSINESS,
  'Side Hustle': process.env.SNAPSHOT_SIDE_HUSTLE,
  'School (District)': process.env.SNAPSHOT_SCHOOL,
  'Nonprofit': process.env.SNAPSHOT_NONPROFIT,
  'Bank or Fintech': process.env.SNAPSHOT_BANK,
  default: process.env.SNAPSHOT_DEFAULT
};

function getSnapshotId(customerType) {
  return SNAPSHOT_MAP[customerType] || SNAPSHOT_MAP.default || null;
}

function buildLocationPayload(data, options = {}) {
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

module.exports = { buildLocationPayload, getSnapshotId };
