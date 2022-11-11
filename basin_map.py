import os
os.chdir('/Users/ealteanau/Documents/SWORD_Dev/src/sword_app/assets/')
import geopandas as gp
import folium
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
    'src/sword_app/data/'
shp_dir = '/Users/ealteanau/Documents/'\
    'SWORD_Dev/inputs/hydrobasins/level2/'
basin_paths = [shp_dir+file for file in os.listdir(shp_dir) if '.gpkg' in file]

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

    basins_tooltip = folium.GeoJsonTooltip(fields=['Basin'])
    basin_colors = ["#"+''.join([random.choice('0123456789ABCDEF') for i in range(6) ]) for x in list(range(len(basins_simple)))]

    bounds = basins_simple.geometry.total_bounds.tolist()
    if basin_paths[ind][-7:-5] == 'as':
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
            # tooltip=basins_simple["PFAF_ID"][ind]
        ).add_to(parent_map)

    folium.GeoJson(
        data = basins_simple,
        style_function= lambda x: {'fillColor': '#00000000', 'color': '#00000000'},
        popup=folium.GeoJsonPopup(fields=['Basin']),
        tooltip=basins_tooltip
    ).add_to(parent_map) 

    if os.path.exists(outdir): 
        outpath =  outdir+basin_paths[ind][-7:-5]+'_basin_map.html'
    else:
        os.makedirs(outdir)
        outpath =  outdir+basin_paths[ind][-7:-5]+'_basin_map.html'

    parent_map.save(outpath)
    print(basin_paths[ind][-7:-5] + ' map done')
