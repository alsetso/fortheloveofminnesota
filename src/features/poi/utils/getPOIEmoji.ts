/**
 * Get emoji for POI based on category and type
 * Returns the stored emoji if available, otherwise maps category/type to emoji
 */
export function getPOIEmoji(
  category: string | null | undefined,
  type: string | null | undefined,
  storedEmoji?: string | null
): string {
  // Use stored emoji if available
  if (storedEmoji) {
    return storedEmoji;
  }

  // Map category to emoji
  const categoryEmojiMap: Record<string, string> = {
    park: '🌳',
    school: '🏫',
    hospital: '🏥',
    church: '⛪',
    restaurant: '🍽️',
    grocery: '🛒',
    food_and_drink_store: '🛒',
    store: '🏪',
    store_like: '🏪',
    entertainment: '🎪',
    arts_and_entertainment: '🎪',
    hotel: '🏨',
    gas_station: '⛽',
    airport: '✈️',
    cemetery: '🪦',
    golf_course: '⛳',
    watertower: '💧',
    municipal: '🏛️',
    lake: '🏞️',
    building: '🏢',
    house: '🏠',
    city: '🏙️',
    neighborhood: '🏘️',
    poi: '📍',
    water: '💧',
  };

  // Map type to emoji (more specific)
  const typeEmojiMap: Record<string, string> = {
    // Schools
    elementary: '🏫',
    middle: '🏫',
    high: '🏫',
    university: '🎓',
    college: '🎓',
    
    // Hospitals
    hospital: '🏥',
    clinic: '🏥',
    medical: '🏥',
    
    // Parks
    park: '🌳',
    playground: '🛝',
    recreation: '⚽',
    
    // Restaurants
    restaurant: '🍽️',
    cafe: '☕',
    bar: '🍺',
    fast_food: '🍔',
    
    // Entertainment
    cinema: '🎬',
    theater: '🎭',
    museum: '🏛️',
    zoo: '🦁',
    aquarium: '🐠',
    
    // Transportation
    airport: '✈️',
    train_station: '🚂',
    bus_station: '🚌',
    subway: '🚇',
    
    // Religious
    church: '⛪',
    mosque: '🕌',
    synagogue: '🕍',
    temple: '🛕',
    
    // Sports
    stadium: '🏟️',
    arena: '🏟️',
    gym: '💪',
    
    // Shopping
    mall: '🛍️',
    supermarket: '🛒',
    convenience: '🏪',
    
    // Services
    bank: '🏦',
    post_office: '📮',
    library: '📚',
    fire_station: '🚒',
    police: '🚓',
  };

  // Check type first (more specific)
  if (type) {
    const typeLower = type.toLowerCase();
    if (typeEmojiMap[typeLower]) {
      return typeEmojiMap[typeLower];
    }
  }

  // Fall back to category
  if (category) {
    const categoryLower = category.toLowerCase();
    if (categoryEmojiMap[categoryLower]) {
      return categoryEmojiMap[categoryLower];
    }
  }

  // Default emoji
  return '📍';
}

