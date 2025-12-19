# ENTITIES ON MAPBOX → ATLAS MAPPING

This document maps Mapbox feature metadata to our atlas entity types for admin creation tools.

## Atlas Entity Types (12 total)

| Atlas Type | Icon | Detection Sources |
|------------|------|-------------------|
| `neighborhood` | 🏘️ | place.settlement_subdivision, place.neighborhood |
| `school` | 🏫 | POI class=education, type=School/University/College |
| `park` | 🌳 | landuse.park, landuse.park_like, POI type=Park |
| `lake` | 💧 | water layer, type=lake/pond/river/reservoir |
| `hospital` | 🏥 | POI class=medical, type=Hospital, building.hospital |
| `church` | ⛪ | POI class=religious, type=Church, building.church |
| `cemetery` | 🪦 | landuse.cemetery, POI type=Cemetery |
| `airport` | ✈️ | POI type=Airport, building.airport |
| `golf_course` | ⛳ | landuse.golf_course, POI type=Golf Course |
| `watertower` | 🗼 | building.water_tower |
| `municipal` | 🏛️ | POI class=government, type=City Hall/Library/etc. |
| `road` | 🛣️ | road layers (highway, road, street, path, trail) |

## Special Cases

### Cities (no admin create)
- Detected: place.settlement, place.city, place.town
- Action: Edit coordinates only (not create)

### Houses (Intelligence Only)
- Detected: building.type=house, residential, detached
- Action: Shows "Property Intelligence" button (not atlas create)

---

## Roads & Paths → `road`

| Mapbox Class | Label | Atlas Type |
|--------------|-------|------------|
| `motorway` | Highway | road |
| `motorway_link` | Highway | road |
| `trunk` | Highway | road |
| `trunk_link` | Highway | road |
| `primary` | Road | road |
| `primary_link` | Road | road |
| `secondary` | Road | road |
| `secondary_link` | Road | road |
| `tertiary` | Road | road |
| `tertiary_link` | Road | road |
| `unclassified` | Road | road |
| `residential` | Street | road |
| `living_street` | Street | road |
| `street_major` | Street | road |
| `street_minor` | Street | road |
| `street` | Street | road |
| `service` | Service Road | road |
| `pedestrian` | Pedestrian | road |
| `footway` | Path | road |
| `path` | Path | road |
| `cycleway` | Bike Path | road |
| `bridleway` | Trail | road |
| `track` | Trail | road |
| `steps` | Steps | road |
| `corridor` | Corridor | road |

---

## Places

| Mapbox Type | Label | Atlas Type |
|-------------|-------|------------|
| `settlement` | City | ❌ (edit only) |
| `city` | City | ❌ (edit only) |
| `town` | City | ❌ (edit only) |
| `village` | City | ❌ (edit only) |
| `settlement_subdivision` | Neighborhood | neighborhood |
| `neighborhood` | Neighborhood | neighborhood |
| `suburb` | Neighborhood | neighborhood |

---

## Buildings

| Mapbox Type | Label | Atlas Type |
|-------------|-------|------------|
| `house` | House | 🧠 Intelligence |
| `residential` | House | 🧠 Intelligence |
| `detached` | House | 🧠 Intelligence |
| `apartments` | Building | ❌ |
| `church` | Church | church |
| `chapel` | Church | church |
| `cathedral` | Church | church |
| `mosque` | Church | church |
| `synagogue` | Church | church |
| `temple` | Church | church |
| `hospital` | Hospital | hospital |
| `clinic` | Hospital | hospital |
| `school` | School | school |
| `university` | School | school |
| `government` | Municipal | municipal |
| `civic` | Municipal | municipal |
| `fire_station` | Municipal | municipal |
| `police` | Municipal | municipal |
| `library` | Municipal | municipal |
| `water_tower` | Water Tower | watertower |
| `airport` | Airport | airport |
| `terminal` | Airport | airport |

---

## Land Use

| Mapbox Class | Label | Atlas Type |
|--------------|-------|------------|
| `park` | Park | park |
| `park_like` | Park | park |
| `playground` | Park | park |
| `nature_reserve` | Park | park |
| `cemetery` | Cemetery | cemetery |
| `grave_yard` | Cemetery | cemetery |
| `golf_course` | Golf Course | golf_course |

---

## Water

| Mapbox Type | Label | Atlas Type |
|-------------|-------|------------|
| `water` | Lake | lake |
| `lake` | Lake | lake |
| `pond` | Lake | lake |
| `river` | Lake | lake |
| `reservoir` | Lake | lake |
| `stream` | Lake | lake |

---

## POI Classes

| Class | Label | Atlas Type |
|-------|-------|------------|
| `education` | School | school |
| `medical` | Hospital | hospital |
| `religious` | Church | church |
| `place_of_worship` | Church | church |
| `government` | Municipal | municipal |
| `civic` | Municipal | municipal |
| `arts_and_entertainment` | Entertainment | ❌ |
| `lodging` | Hotel | ❌ |
| `food_and_drink` | Restaurant | ❌ |
| `fuel` | Gas Station | ❌ |

---

## POI Types (Specific)

| Type | Label | Atlas Type |
|------|-------|------------|
| `University` | School | school |
| `College` | School | school |
| `School` | School | school |
| `High School` | School | school |
| `Hospital` | Hospital | hospital |
| `Clinic` | Hospital | hospital |
| `Medical Center` | Hospital | hospital |
| `Church` | Church | church |
| `Chapel` | Church | church |
| `Cathedral` | Church | church |
| `Mosque` | Church | church |
| `Synagogue` | Church | church |
| `Temple` | Church | church |
| `Cemetery` | Cemetery | cemetery |
| `Graveyard` | Cemetery | cemetery |
| `Airport` | Airport | airport |
| `Airfield` | Airport | airport |
| `Heliport` | Airport | airport |
| `Golf Course` | Golf Course | golf_course |
| `Golf Club` | Golf Course | golf_course |
| `Country Club` | Golf Course | golf_course |
| `Water Tower` | Water Tower | watertower |
| `City Hall` | Municipal | municipal |
| `Town Hall` | Municipal | municipal |
| `Courthouse` | Municipal | municipal |
| `Library` | Municipal | municipal |
| `Fire Station` | Municipal | municipal |
| `Police Station` | Municipal | municipal |
| `Park` | Park | park |
| `National Park` | Park | park |
| `State Park` | Park | park |
| `Stadium` | Entertainment | ❌ |
| `Hotel` | Hotel | ❌ |
| `Restaurant` | Restaurant | ❌ |

---

## Maki Icons (Mapbox POI Icons)

| Maki | Atlas Type |
|------|------------|
| `school` | school |
| `college` | school |
| `hospital` | hospital |
| `religious-christian` | church |
| `religious-jewish` | church |
| `religious-muslim` | church |
| `place-of-worship` | church |
| `cemetery` | cemetery |
| `airport` | airport |
| `golf` | golf_course |
| `town-hall` | municipal |
| `library` | municipal |
| `fire-station` | municipal |
| `police` | municipal |
| `park` | park |
| `national-park` | park |
| `water` | lake |

---

## Feature Properties Reference

### Building Properties
```json
{
  "layer": "building",
  "source": "building",
  "type": "house",
  "height": 6.2,
  "extrude": true
}
```

### POI Properties
```json
{
  "layer": "poi_label",
  "class": "education",
  "type": "School",
  "maki": "school",
  "name": "Minneapolis South High School"
}
```

### Road Properties
```json
{
  "layer": "road",
  "class": "motorway",
  "ref": "I-35",
  "shield": "us-interstate",
  "name": "Interstate 35"
}
```

### Water Properties
```json
{
  "layer": "water",
  "type": "lake",
  "name": "Lake Harriet"
}
```
