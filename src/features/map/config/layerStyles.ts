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
      size: 1.0,
      anchor: 'center' as const,
      allowOverlap: true,
      ignorePlacement: false,
    },
  },
  // Label layer styles
  label: {
    font: ['Open Sans Regular', 'Arial Unicode MS Regular'],
    size: 11,
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
    fallbackColor: '#ffffff',
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

export const buildAtlasCirclePaint = () => {
  const { circle } = atlasLayerStyles.point;
  return {
    'circle-radius': circle.radius,
    'circle-color': circle.color,
    'circle-stroke-width': circle.strokeWidth,
    'circle-stroke-color': circle.strokeColor,
    'circle-opacity': circle.opacity,
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

