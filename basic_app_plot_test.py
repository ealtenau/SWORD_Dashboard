from dash import Dash, html, Input, Output, dcc
from dash.exceptions import PreventUpdate
import os
import netCDF4 as nc
import numpy as np
import pandas as pd
from plotly.subplots import make_subplots
import plotly.graph_objects as go


#################################################################################################

def get_data(fn):
    nc_files = [file for file in os.listdir(fn) if 'nodes' in file ]
    for ind in list(range(len(nc_files))):
        nodes_nc = nc.Dataset(fn+nc_files[ind])
        node_df = pd.DataFrame(
            np.array(
                [nodes_nc['nodes']['x'][:],
                nodes_nc['nodes']['y'][:],
                nodes_nc['nodes']['reach_id'][:],
                nodes_nc['nodes']['node_id'][:],
                nodes_nc['nodes']['wse'][:],
                nodes_nc['nodes']['width'][:],
                nodes_nc['nodes']['facc'][:],
                nodes_nc['nodes']['dist_out'][:],
                nodes_nc['nodes']['n_chan_mod'][:],
                nodes_nc['nodes']['sinuosity'][:],
                nodes_nc['nodes']['node_order'][:]]).T)
        node_df.rename(columns = {0:'x', 1:'y', 2:'reach_id', 3:'node_id',
            4:'wse', 5:'width', 6:'facc', 7:'dist_out',
            8:'n_chan_mod',9:'sinuosity',10:'node_order'}, inplace = True)
        try:
            nodes_all = pd.concat([nodes_all, node_df])
        except NameError:
            nodes_all = node_df.copy()
        del(nodes_nc)

    return nodes_all

#################################################################################################
### Function for plotting node level data.

def plot_nodes(df, reach=None):
    if reach is None:
        rch = 81247100041 #default reach
    else:
        rch = reach
        # rch = int(reach['feature']['properties']['reach_id'])

    node_reaches = df.loc[df['reach_id'] == rch]

    #add base plots
    fig = make_subplots(rows=3, cols=2)
    fig.add_trace(
        go.Scatter(
            x=node_reaches['dist_out']/1000,
            y=node_reaches['wse'],
            mode='lines+markers'),
        row=1, col=1
    )
    fig.add_trace(
        go.Scatter(
            x=node_reaches['dist_out']/1000,
            y=node_reaches['width'],
            mode='lines+markers'),
        row=1, col=2
    )
    fig.add_trace(
        go.Scatter(
            x=node_reaches['dist_out']/1000,
            y=node_reaches['node_order'],
            mode='lines+markers'),
        row=2, col=1
    )
    fig.add_trace(
        go.Scatter(
            x=node_reaches['dist_out']/1000,
            y=node_reaches['facc'],
            mode='lines+markers'),
        row=2, col=2
    )
    fig.add_trace(
        go.Scatter(
            x=node_reaches['dist_out']/1000,
            y=node_reaches['n_chan_mod'],
            mode='lines+markers'),
        row=3, col=1
    )
    fig.add_trace(
        go.Scatter(
            x=node_reaches['dist_out']/1000,
            y=node_reaches['sinuosity'],
            mode='lines+markers'),
        row=3, col=2
    )
    # Update xaxis properties
    fig.update_xaxes(
        title_text="Distance from Outlet (km)",
        row=1, col=1)
    fig.update_xaxes(
        title_text="Distance from Outlet (km)",
        row=1, col=2)
    fig.update_xaxes(
        title_text="Distance from Outlet (km)",
        row=2, col=1)
    fig.update_xaxes(
        title_text="Distance from Outlet (km)",
        row=2, col=2)
    fig.update_xaxes(
        title_text="Distance from Outlet (km)",
        row=3, col=1)
    fig.update_xaxes(
        title_text="Distance from Outlet (km)",
        row=3, col=2)
    # Update yaxis properties
    fig.update_yaxes(
        title_text="Water Surface Elevation (m)",
        row=1, col=1)
    fig.update_yaxes(
        title_text="Width (m)",
        row=1, col=2)
    fig.update_yaxes(
        title_text="Node Order",
        row=2, col=1)
    fig.update_yaxes(
        title_text="Flow Accumulation (sq.km)",
        row=2, col=2)
    fig.update_yaxes(
        title_text="Number of Channels",
        row=3, col=1)
    fig.update_yaxes(
        title_text="Sinuosity",
        row=3, col=2)
    #overall figure properties
    fig.update_layout(
        height=1000, #width=1400,
        title_text="Reach "+str(rch)+" (lon: "+str(np.round(np.median(node_reaches['x']),2))+", lat: "+str(np.round(np.median(node_reaches['y']),2))+") - Node Level Attributes",
        title_x=0.5,
        showlegend=False,
        plot_bgcolor='#dce0e2' #'whitesmoke'
    )
    return fig

#################################################################################################

# Read in node data.
node_df = get_data("data/")
node_df_cp = node_df.copy()

app = Dash(__name__)

app.layout = html.Div([
    html.Iframe(id="map", srcDoc=open("data/hb74_sword_map.html",
                "r").read(), width="100%", height="500px"),
    dcc.Store(id="clicked-feature"),
    html.Div(id="feature-output"),
    #new div to test plots
    dcc.Graph(
        figure=plot_nodes(node_df_cp),
        id='ReachGraph')
])

# Dash callback to update the output with the feature ID
@app.callback(
    Output("feature-output", "children"),
    [Input("clicked-feature", "data")]
)
def display_feature_id(feature):
    if feature:
        return f"Clicked feature: {feature['feature']['properties']['reach_id']}" #was just 'feature' ; feature['feature']['properties']['Basin']
    else:
        return "No feature clicked yet."


#Callback that plots the node level attributes when a Reach ID is put into the input box.
@app.callback(
    Output("ReachGraph", "figure"),
    Output("clicked-feature", "data"),
    Input("clicked-feature", "data"),
)
def update_graph(feature):
    if feature is None:
        raise PreventUpdate
    else:
        try:
            reach = int(feature['feature']['properties']['reach_id'])
            fig = plot_nodes(node_df_cp, reach)
            return fig, None
        except:
            raise PreventUpdate     

if __name__ == "__main__":
    app.run_server(debug=True)
