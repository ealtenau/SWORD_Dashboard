import os
os.chdir('/Users/ealteanau/Documents/SWORD_Dev/src/sword_app/assets/')
import geopandas as gp
import folium
from folium.features import DivIcon
import random
from matplotlib.colors import rgb2hex

#################################################################################################
######################################  FUNCTIONS  ##############################################
#################################################################################################

# Function to create reach style function. 
class ColormapStyleFunction:
    
    def __init__(self, cmap, attribute,randomcolors=False):
        self._cmap = cmap
        self._attribute = attribute
        self._randomcolors = randomcolors
        
    def __call__(self, x):
        if self._randomcolors:
            #hexcolor = '#ff0000'
            hexcolor="#"+''.join([random.choice('0123456789ABCDEF') for i in range(6) ] )
        else:
            hexcolor = self._cmap(x["properties"][self._attribute])

        return {'color': hexcolor, 'weight' : 2}

#################################################################################################

# Function to get hex codes along specific breaks along a defined colormap. 
def colors_at_breaks(cmap, breaks):
    return [rgb2hex(cmap(bb)) for bb in breaks]

#################################################################################################
######################################  MAIN CODE  ##############################################
#################################################################################################

# Input directory to level 2 Hydrobasins files. 
outdir = '/Users/ealteanau/Documents/SWORD_Dev/'\
    'src/SWORD_Dashboard/data/'
basin_dir = '/Users/ealteanau/Documents/SWORD_Dev/'\
    'src/other_src/hb_level2/gpkg_sword/'
basin_paths = [basin_dir+file for file in os.listdir(basin_dir) if '.gpkg' in file]

### Loop thrugh each continent and produce the basin key map. Output to the "data" directory. 
for ind in list(range(len(basin_paths))):
    
    basins = gp.read_file(basin_paths[ind])
    basins_simple = basins.copy()
    basins_simple = basins_simple.simplify(0.01) 
    basins_simple = gp.GeoDataFrame(basins_simple)
    basins_simple['Basin'] = basins['PFAF_ID']
    basins_simple.rename(columns = {0:'geometry'}, inplace = True)
    basins_simple['ID'] = list(range(len(basins_simple)))
    basins_simple['ID'] = basins_simple['ID'].apply(lambda x: str(x))

    if basin_paths[ind][-14:-12] == 'na':
        bid = [71,72,73,74,75,76,77,78,81,82,83,84,85,86,91]
        bx = [-98,-72,-80,-95,-103,-71,-116,-120,-153,-120,-102,-110,-71,-75,-43]
        by = [55,56,38,41,30,24,39,51,67,62,65,72,69,82,76]
    if basin_paths[ind][-14:-12] == 'as':
        bid = [31,32,33,34,35,36,41,42,43,44,45,46,47,48,49]
        bx = [73,96,100,121,147,92,142,126,109,101,77,68,101,86,85]
        by = [62,61,73,63,67,50,38,50,32,18,28,45,46,41,35]
    if basin_paths[ind][-14:-12] == 'sa':
        bid = [61,62,63,64,65,66,67]
        bx = [-69,-65,-44,-59,-68,-71,-83]
        by = [9,-6,-8,-25,-37,-22,-5]
    if basin_paths[ind][-14:-12] == 'eu':
        bid = [21,22,23,24,25,26,27,28,29]
        bx = [6,30,5,27,7,48,-20,50,44]
        by = [47,51,52,63,62,65,66,55,26]
    if basin_paths[ind][-14:-12] == 'af':
        bid = [11,12,13,14,15,16,17,18]
        bx = [37,22,19,-2,2,14,31,44.5]
        by = [3,-21,-2,14,31,18,12,-17]
    if basin_paths[ind][-14:-12] == 'oc':
        bid = [51,52,53,54,55,56,57]
        bx = [103,112,140,145,165,132,171]
        by = [-1,2,-4,6,-23,-24,-45]

    basins_tooltip = folium.GeoJsonTooltip(fields=['Basin'])
    basin_colors = ["#"+''.join([random.choice('0123456789ABCDEF') for i in range(6) ]) for x in list(range(len(basins_simple)))]

    bounds = basins_simple.geometry.total_bounds.tolist()
    if basin_paths[ind][-14:-12] == 'as':
        center = (46,99)
    else:
        center = (0.5 * (bounds[1] + bounds[3]), 0.5 * (bounds[0] + bounds[2]))

    # Create map
    parent_map = folium.Map(location=center, #[40,10] global
                tiles='cartodbpositron',
                name = 'Carto Basemap', 
                zoom_start=3)

    for idx in list(range(len(basins_simple))):
        folium.GeoJson(
            data = basins_simple['geometry'][idx],
            style_function=lambda x, idx=idx: {
                'fillColor': basin_colors[idx],
                'color': basin_colors[idx],
                'weight': 1,
                'fillOpacity': 0.8}#,
            # tooltip=basins_simple["Basin"][ind]
        ).add_to(parent_map)

    for txt in list(range(len(bid))):
        folium.map.Marker(
            [by[txt],bx[txt]],
            icon=DivIcon(
                icon_size=(150,36),
                icon_anchor=(0,0),
                html='<div style="font-size: 16pt; color : black">'+str(bid[txt])+'</div>',
            )
        ).add_to(parent_map)

    folium.GeoJson(
        data = basins_simple,
        style_function= lambda x: {'fillColor': '#00000000', 'color': '#00000000'},
        popup=folium.GeoJsonPopup(fields=['Basin']),
        tooltip=basins_tooltip
    ).add_to(parent_map) 

    if os.path.exists(outdir): 
        outpath = outdir+basin_paths[ind][-14:-12]+'_basin_map_test.html'
    else:
        os.makedirs(outdir)
        outpath = outdir+basin_paths[ind][-14:-12]+'_basin_map.html'

    parent_map.save(outpath)
    print(basin_paths[ind][-14:-12] + ' map done')
