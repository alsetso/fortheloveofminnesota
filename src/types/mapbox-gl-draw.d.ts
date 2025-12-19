declare module '@mapbox/mapbox-gl-draw' {
  import { Map } from 'mapbox-gl';
  
  export default class MapboxDraw {
    constructor(options?: {
      displayControlsDefault?: boolean;
      defaultMode?: string;
      keybindings?: boolean;
      touchEnabled?: boolean;
      boxSelect?: boolean;
      clickOnFeature?: boolean;
      touchBuffer?: number;
      styles?: any[];
      modes?: any;
      controls?: any;
      userProperties?: boolean;
    });
    
    add(geojson: any): string[];
    get(featureId?: string): any;
    getAll(): any;
    delete(ids: string | string[]): this;
    deleteAll(): this;
    getSelectedIds(): string[];
    getSelected(): any;
    getSelectedPoints(): any;
    set(featureCollection: any): string[];
    trash(): this;
    changeMode(mode: string, options?: any): this;
    setFeatureProperty(featureId: string, property: string, value: any): this;
    on(type: string, handler: (e: any) => void): this;
    off(type: string, handler?: (e: any) => void): this;
    fire(type: string, data?: any): this;
    getMode(): string;
    changeMode(mode: string, options?: any): this;
  }
}

declare module '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css' {
  const content: string;
  export default content;
}
