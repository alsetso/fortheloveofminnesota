/**
 * Creates a compact, small colored teardrop pin marker element
 * Minimal logic, no external dependencies
 */
export function createTeardropPin(options: {
  color?: string;
  size?: number;
  onClick?: (e: MouseEvent) => void;
} = {}): HTMLElement {
  const { color = '#EF4444', size = 16, onClick } = options;

  const element = document.createElement('div');
  element.className = 'teardrop-pin-marker';
  
  // Container styling - pin tip will align with coordinates when using 'bottom' anchor
  element.style.cssText = `
    width: ${size}px;
    height: ${size * 1.5}px;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  `;

  // Inline SVG for teardrop shape
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size * 1.5));
  svg.setAttribute('viewBox', `0 0 ${size} ${size * 1.5}`);
  svg.style.cssText = 'display: block; pointer-events: none;';

  // Shadow ellipse at bottom
  const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  shadow.setAttribute('cx', String(size / 2));
  shadow.setAttribute('cy', String(size * 1.5 - 2));
  shadow.setAttribute('rx', String(size * 0.25));
  shadow.setAttribute('ry', String(size * 0.1));
  shadow.setAttribute('fill', '#000000');
  shadow.setAttribute('opacity', '0.15');
  svg.appendChild(shadow);

  // Teardrop path: semicircle on top, tapering to point at bottom
  const teardrop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const width = size;
  const height = size * 1.5;
  const centerX = width / 2;
  const radius = width * 0.4;
  const circleTop = radius;
  const pointY = height;
  // Path: start at top center, arc to right, line to bottom point, line back to left, arc to top
  const path = `M ${centerX} 0 A ${radius} ${radius} 0 0 1 ${width} ${circleTop} L ${centerX} ${pointY} L 0 ${circleTop} A ${radius} ${radius} 0 0 1 ${centerX} 0 Z`;
  teardrop.setAttribute('d', path);
  teardrop.setAttribute('fill', color);
  svg.appendChild(teardrop);

  // White border outline
  const border = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  border.setAttribute('d', path);
  border.setAttribute('fill', 'none');
  border.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
  border.setAttribute('stroke-width', '0.5');
  svg.appendChild(border);

  element.appendChild(svg);

  if (onClick) {
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onClick(e);
    });
  }

  return element;
}


