import os
import netCDF4 as nc
import numpy as np
import pandas as pd
import time

#################################################################################################
#Function to read and contatenate all nodes and relevant attributes into a global netcdf file. 
def get_data(fn):
    nc_files = [file for file in os.listdir(fn) if '.nc' in file ]
    for ind in list(range(len(nc_files))):
        nodes_nc = nc.Dataset(fn+nc_files[ind])
        node_order = [int(str(node)[-4:-1]) for node in nodes_nc['nodes']['node_id'][:]]
        node_df = pd.DataFrame(
            np.array(
                [nodes_nc['nodes']['reach_id'][:],
                nodes_nc['nodes']['node_id'][:],
                nodes_nc['nodes']['wse'][:],
                nodes_nc['nodes']['width'][:],
                nodes_nc['nodes']['facc'][:],
                nodes_nc['nodes']['dist_out'][:],
                nodes_nc['nodes']['n_chan_mod'][:],
                nodes_nc['nodes']['sinuosity'][:],
                node_order]).T)
        node_df.rename(columns = {0:'reach_id', 1:'node_id',
            2:'wse', 3:'width', 4:'facc', 5:'dist_out',
            6:'n_chan_mod',7:'sinuosity',8:'node_order'}, inplace = True)
        try:
            nodes_all = pd.concat([nodes_all, node_df])
        except NameError:
            nodes_all = node_df.copy()
        del(nodes_nc)
    
    return nodes_all

######################################################################################
#Function to save the concatenated data. Save to "data" directory.
def save_nc(nodes, outdir):

    # global attributes
    root_grp = nc.Dataset(outdir, 'w', format='NETCDF4')
    root_grp.production_date = time.strftime(
        "%d-%b-%Y %H:%M:%S", 
        time.gmtime()) #utc time

    # subgroups
    node_grp = root_grp.createGroup('nodes')
    # dimensions
    node_grp.createDimension('num_nodes', len(nodes['node_id']))
    # node variables
    Node_ID = node_grp.createVariable(
        'node_id', 'i8', ('num_nodes',), fill_value=-9999.)
    Node_ID.format = 'CBBBBBRRRRNNNT'
    node_rch_id = node_grp.createVariable(
        'reach_id', 'i8', ('num_nodes',), fill_value=-9999.)
    node_rch_id.format = 'CBBBBBRRRRT'
    node_wse = node_grp.createVariable(
        'wse', 'f8', ('num_nodes',), fill_value=-9999.)
    node_wse.units = 'meters'
    node_wth = node_grp.createVariable(
        'width', 'f8', ('num_nodes',), fill_value=-9999.)
    node_wth.units = 'meters'
    node_dist_out = node_grp.createVariable(
        'dist_out', 'f8', ('num_nodes',), fill_value=-9999.)
    node_dist_out.units = 'meters'
    node_facc = node_grp.createVariable(
        'facc', 'f8', ('num_nodes',), fill_value=-9999.)
    node_facc.units = 'km^2'
    node_sinuosity = node_grp.createVariable(
        'sinuosity', 'f8', ('num_nodes',), fill_value=-9999.)
    node_chan_mod = node_grp.createVariable(
        'n_chan_mod', 'i4', ('num_nodes',), fill_value=-9999.)
    node_order = node_grp.createVariable(
        'node_order', 'i4', ('num_nodes',), fill_value=-9999.)

    # node data
    print("saving nc")
    Node_ID[:] = nodes['node_id']
    node_rch_id[:] = nodes['reach_id']
    node_wse[:] = nodes['wse']
    node_wth[:] = nodes['width']
    node_dist_out[:] = nodes['dist_out']
    node_facc[:] = nodes['facc']
    node_sinuosity[:] = nodes['sinuosity']
    node_chan_mod[:] = nodes['n_chan_mod']
    node_order[:] = nodes['node_order']
    
    root_grp.close()

######################################################################################
# Primary lines and paths.
nc_dir = '/Users/ealteanau/Documents/SWORD_Dev/outputs/Reaches_Nodes/v14/netcdf/'
outdir = '/Users/ealteanau/Documents/SWORD_Dev/src/SWORD_Dashboard/data/'

nodes = get_data(nc_dir)

level = np.array([int(str(ind)[0:2]) for ind in nodes.reach_id])
unq_lvl = np.unique(level)
for ind in list(range(len(unq_lvl))):
    vals = np.where(level == unq_lvl[ind])
    nodes_clip = nodes.iloc[vals]
    if os.path.exists(outdir): 
        outpath =  outdir + 'nodes_hb'+str(unq_lvl[ind])+'.nc'
    else:
        os.makedirs(outdir)
        outpath =  outdir + 'nodes_hb'+str(unq_lvl[ind])+'.nc'
    save_nc(nodes_clip, outpath)
    nodes_clip = None