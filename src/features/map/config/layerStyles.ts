/**
 * Map layer style configurations
 * Separates visual styling from layer logic
 */

// Atlas layer styles
export const atlasLayerStyles = {
  // Point layer styles (fallback circle when no icons)
  point: {
    circle: {
      radius: 6,
      color: '#3b82f6',
      strokeWidth: 1,
      strokeColor: '#ffffff',
      opacity: 0.8,
    },
    // Icon layout (when custom icons are available)
    icon: {
      size: [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 0.3,   // Small at low zoom
        10, 0.5,  // Medium at zoom 10
        14, 0.8,  // Larger at zoom 14
        18, 1.0,  // Full size at zoom 18
        20, 1.2   // Slightly larger at max zoom
      ],
      anchor: 'center' as const,
      allowOverlap: [
        'step',
        ['zoom'],
        false,  // No overlap at low zoom (0-12)
        12, false,
        14, true // Allow overlap at high zoom (14+)
      ],
      ignorePlacement: false,
    },
  },
  // Label layer styles
  label: {
    font: ['Open Sans Regular', 'Arial Unicode MS Regular'],
    size: [
      'interpolate',
      ['linear'],
      ['zoom'],
      12, 9,   // Smaller at zoom 12
      14, 11,  // Base size at zoom 14
      18, 13,  // Larger at zoom 18
      20, 15   // Largest at max zoom
    ],
    offset: [0, 1.5] as [number, number],
    anchor: 'top' as const,
    // Text colors by table name
    colors: {
      parks: '#22c55e',
      churches: '#4b5563',
      schools: '#ca8a04',
      neighborhoods: '#ea580c',
      lakes: '#0ea5e9',
      hospitals: '#ef4444',
      cities: '#3b82f6',
    },
    fallbackColor: '#374151', // Dark grey for atlas types without preset colors
  },
};

// Mentions layer styles
export const mentionsLayerStyles = {
  // Point layer styles
  point: {
    icon: {
      size: [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 0.15,
        5, 0.25,
        10, 0.4,
        12, 0.5,
        14, 0.65,
        16, 0.8,
        18, 1.0,
        20, 1.2,
      ],
      anchor: 'center' as const,
      allowOverlap: true,
    },
  },
  // Label layer styles
  label: {
    font: ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    size: 12,
    offset: [0, 1.2] as [number, number],
    anchor: 'top' as const,
    color: '#000000',
    halo: {
      color: '#ffffff',
      width: 2,
      blur: 1,
    },
  },
};

// Helper functions to build Mapbox style expressions
export const buildAtlasTextColorExpression = (tableNames: string[]): any => {
  const { colors, fallbackColor } = atlasLayerStyles.label;
  const tablesWithColors = tableNames.filter(name => colors[name as keyof typeof colors]);
  
  if (tablesWithColors.length === 0) {
    return fallbackColor;
  }
  
  const expression: any[] = ['case'];
  tablesWithColors.forEach((tableName) => {
    expression.push(['==', ['get', 'table_name'], tableName]);
    expression.push(colors[tableName as keyof typeof colors]);
  });
  expression.push(fallbackColor);
  
  return expression;
};

export const buildAtlasIconLayout = (iconExpression: any[]) => {
  const { icon } = atlasLayerStyles.point;
  return {
    'icon-image': iconExpression,
    'icon-size': icon.size,
    'icon-anchor': icon.anchor,
    'icon-allow-overlap': icon.allowOverlap,
    'icon-ignore-placement': icon.ignorePlacement,
  };
};

export const buildAtlasIconPaint = () => {
  return {
    'icon-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      10, 0,    // Hidden below zoom 10
      12, 0.5,  // Fade in 10-12
      14, 1.0   // Full opacity at 14+
    ],
  };
};

export const buildAtlasCirclePaint = () => {
  const { circle } = atlasLayerStyles.point;
  return {
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 3,    // Small at low zoom
      10, 5,   // Medium at zoom 10
      14, 8,   // Larger at zoom 14
      18, 10,  // Full size at zoom 18
      20, 12   // Slightly larger at max zoom
    ],
    'circle-color': circle.color,
    'circle-stroke-width': circle.strokeWidth,
    'circle-stroke-color': circle.strokeColor,
    'circle-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      10, 0,    // Hidden below zoom 10
      12, 0.5,  // Fade in 10-12
      14, circle.opacity // Full opacity at 14+
    ],
  };
};

export const buildAtlasLabelLayout = () => {
  const { label } = atlasLayerStyles;
  return {
    'text-field': ['get', 'name'],
    'text-font': label.font,
    'text-size': label.size,
    'text-offset': label.offset,
    'text-anchor': label.anchor,
    'text-optional': true, // Allow labels to be hidden if they can't be placed
  };
};

export const buildAtlasLabelPaint = () => {
  return {
    'text-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12, 0,    // Hidden below zoom 12
      14, 0.7,  // Fade in 12-14
      16, 1.0   // Full opacity at 16+
    ],
    'text-halo-color': 'rgba(0, 0, 0, 0)',
    'text-halo-width': 0,
    'text-halo-blur': 0,
  };
};

export const buildMentionsLabelLayout = () => {
  const { label } = mentionsLayerStyles;
  return {
    'text-field': [
      'case',
      ['has', 'description'],
      [
        'case',
        ['>', ['length', ['get', 'description']], 20],
        ['concat', ['slice', ['get', 'description'], 0, 20], '...'],
        ['get', 'description']
      ],
      '📍',
    ],
    'text-font': label.font,
    'text-size': label.size,
    'text-offset': label.offset,
    'text-anchor': label.anchor,
  };
};

export const buildMentionsLabelPaint = () => {
  const { label } = mentionsLayerStyles;
  return {
    'text-color': label.color,
    'text-halo-color': label.halo.color,
    'text-halo-width': label.halo.width,
    'text-halo-blur': label.halo.blur,
  };
};

export const buildMentionsIconLayout = () => {
  const { icon } = mentionsLayerStyles.point;
  return {
    'icon-image': 'mention-pin',
    'icon-size': icon.size,
    'icon-anchor': icon.anchor,
    'icon-allow-overlap': icon.allowOverlap,
  };
};

