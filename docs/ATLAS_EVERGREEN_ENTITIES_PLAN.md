# Atlas Evergreen Entity Location Layers Implementation Plan

The watertower, cemetery, and golf course tables will follow the established atlas pattern as point-based location entities with direct city_id foreign key relationships. Each table will be minimal and focused: watertowers and cemeteries are simple pin coordinates (lat/lng) tied to cities, while golf courses may include additional metadata like course type or hole count. All three will include the standard atlas fields (name, slug, city_id, lat, lng, address, description, meta fields, favorite, view_count) with full RLS policies, public views for Supabase client compatibility, INSTEAD OF triggers for view updates, and integration with the record_page_view function. The implementation will mirror the schools table structure but simplified for point-based entities that don't require polygon boundaries or complex classification systems—these are evergreen reference data layers that persist as permanent map features tied directly to their parent cities.




