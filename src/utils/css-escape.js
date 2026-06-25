function escapeCssClassSelector(locationId) {
  if (!locationId) return '';

  const value = String(locationId);
  const firstChar = value.charAt(0);

  if (!/^[0-9]$/.test(firstChar)) {
    return `.${value}`;
  }

  return `.\\3${firstChar} ${value.slice(1)}`;
}

module.exports = { escapeCssClassSelector };
