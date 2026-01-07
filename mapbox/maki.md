filterrank number
The filterrank field is a value from 0-5 used to customize label density. It's intended to be used in style layer filters (in the 'Select data' tab in Mapbox Studio). The value is relative to the current zoom level. For example, the same POI might have filterrank=5 at z10 while having filterrank=1 at z14, since zooming has changed the relative importance of the POI.

You could set filterrank<=1 to only show the most prominent labels, filterrank<=3 to produce moderate density, and filterrank<=5 to see as many labels as possible.

The value is never null and is always in the range of 0-5.

maki text
Some layers have a maki field designed to make it easier to assign icons using the Maki icon project or other icons that follow the same naming scheme. Each layer uses a different subset of the names, but the full list of values used in Mapbox Streets is compiled here so you can make sure your style has all the icons needed across different layers.

Not all icons from the Maki project are used in Mapbox Streets, and different types of related features can sometimes have the same maki value (for example universities and colleges, or art supply shops and art galleries). Nameless POIs always have a Maki value of marker, the generic default.

The possible values for the maki field for all layers are listed below. Icon names that were not part of any layer in v7 are marked with 🆕. No further values will be added in Mapbox Streets v8.

airport_label:

airport
airfield
heliport
rocket
natural_label:

marker
mountain
volcano
waterfall 🆕
poi_label:

alcohol-shop
american-football 🆕
amusement-park
aquarium
art-gallery
attraction
bakery
bank
bar
basketball 🆕
beach 🆕
beer
bicycle
bowling-alley 🆕
bridge 🆕
cafe
campsite
car
car-rental 🆕
car-repair 🆕
casino 🆕
castle
cemetery
charging-station 🆕
cinema
clothing-store
college
communications-tower 🆕
confectionery 🆕
convenience 🆕
dentist
doctor
dog-park
drinking-water
embassy
farm 🆕
fast-food
fire-station
fitness-centre 🆕
fuel
furniture 🆕
garden
globe 🆕
golf
grocery
harbor
hardware 🆕
horse-riding 🆕
hospital
ice-cream
information
jewelry-store 🆕
laundry
library
lodging
marker
mobile-phone 🆕
monument
museum
music
optician 🆕
park
parking 🆕
parking-garage 🆕
pharmacy
picnic-site
pitch 🆕
place-of-worship
playground
police
post
prison
ranger-station 🆕
religious-buddhist 🆕
religious-christian
religious-jewish
religious-muslim
restaurant
restaurant-noodle 🆕
restaurant-pizza 🆕
restaurant-seafood 🆕
school
shoe 🆕
shop
skateboard 🆕
slipway 🆕
stadium
suitcase 🆕
swimming
table-tennis 🆕
tennis 🆕
theatre
toilet
town-hall
veterinary
viewpoint 🆕
volleyball 🆕
watch 🆕
watermill 🆕
windmill 🆕
zoo
transit_stop_label:

bicycle-share
bus
ferry
rail
rail-metro
rail-light
entrance
maki_beta text
Maki icons that might be supported in future versions of Mapbox Streets are in maki_beta field. Possible values include, but not limited to:

poi_label:

baseball
lighthouse
landmark
industry
highway-services
highway-rest-area
racetrack-cycling
racetrack-horse
racetrack-boat
racetrack
religious-shinto
observation-tower
restaurant-bbq
tunnel
natural_label:

hot-spring
motorway_junction:

interchange
junction
worldview text
Mapbox Streets v8 introduces the notion of worldviews to the admin, airport_label, natural_label, and place_label data layers. The vector tiles contain multiple versions of some features, each with a worldview value indicating the intended audience. When the worldview filter is applied, it must include both all and one of the region-specific values. Additionally, for all worldviews except for US worldview, there are classes in respective layers, prefixed with disputed_ which user must select in conjunction with the worldview filter; classes in respective layers in US worldview do not have the disputed_ prefix.

A worldview filter must be applied to style layers that use the admin data layer. It is highly recommended to also use a worldview filter with airport_label, natural_label, and place_label data layers to communicate intent, but if no worldview is applied to those layers, the labels displayed on the map will reflect the US worldview.