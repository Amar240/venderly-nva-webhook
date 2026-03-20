const ZipcodeToTimezone = require('zipcode-to-timezone');
function getTimezone(postalCode){
    if(!postalCode) return 'America/New_york';
    const zip5 = postalCode.replace(/[^0-9]/g, '').substring(0,5);
    const timezone = ZipcodeToTimezone.lookup(zip5);
    return timezone || 'Amaerica/New_york';
}
module.exports = {getTimezone};