export type LifeLocationValue = {
  city: string;
  district: string;
};

export function parseLocationValue(value?: string): LifeLocationValue {
  const normalized = (value || '').trim();
  if (!normalized) {
    return { city: '', district: '' };
  }

  const matched = normalized.match(/^(.+?)[\s·/|,，]+(.+)$/);
  if (!matched) {
    return { city: normalized, district: '' };
  }

  return {
    city: matched[1]?.trim() || '',
    district: matched[2]?.trim() || '',
  };
}

export function buildLocationValue(city: string, district?: string) {
  const normalizedCity = city.trim();
  const normalizedDistrict = (district || '').trim();
  if (!normalizedCity) {
    return '';
  }
  if (!normalizedDistrict) {
    return normalizedCity;
  }
  return `${normalizedCity} ${normalizedDistrict}`;
}

export function formatLocationDisplay(value?: string) {
  const { city, district } = parseLocationValue(value);
  if (!city) {
    return '';
  }
  return district ? `${city} · ${district}` : city;
}

export function getWeatherLocationLabel(apiCity: string | undefined, settingsLocation: string) {
  const displayLocation = formatLocationDisplay(settingsLocation);
  const { city } = parseLocationValue(settingsLocation);
  const normalizedApiCity = (apiCity || '').trim();
  if (displayLocation && city && normalizedApiCity && normalizedApiCity === city) {
    return displayLocation;
  }
  return normalizedApiCity || displayLocation || settingsLocation;
}
