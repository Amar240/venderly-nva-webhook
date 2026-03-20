const { getTimezone } = require('./timezone');

const SNAPSHOT_MAP = {
  'Small Business': process.env.SNAPSHOT_SMALL_BUSINESS,
  'Side Hustle': process.env.SNAPSHOT_SIDE_HUSTLE,
  'School (District)': process.env.SNAPSHOT_SCHOOL,
  'Nonprofit': process.env.SNAPSHOT_NONPROFIT,
  'Bank or Fintech': process.env.SNAPSHOT_BANK,
  'default': process.env.SNAPSHOT_DEFAULT
};

function buildLocationPayload(data) {
  const timezone = getTimezone(data.postal_code);

  return {
    name: data.company_name,
    companyId: process.env.GHL_COMPANY_ID,
    phone: data.phone,
    address: data.address,
    city: data.city,
    state: data.state,
    country: data.country || 'US',
    postalCode: data.postal_code,
    website: data.website || '',
    timezone: timezone,
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

module.exports = { buildLocationPayload };