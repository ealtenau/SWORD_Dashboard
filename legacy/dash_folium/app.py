import os
import netCDF4 as nc
import numpy as np
import pandas as pd
from csv import writer, reader
import time
import dash
try:
    from dash import dcc
except:
    import dash_core_components as dcc
    # seems deprecated in latest version
from dash import html
from dash.dependencies import Input, Output, State
from dash.exceptions import PreventUpdate
from plotly.subplots import make_subplots
import plotly.graph_objects as go
import dash_bootstrap_components as dbc
from dash_bootstrap_templates import load_figure_template
load_figure_template("cerulean")

HEADER_COLOR = "#2fa4e7"
PLOT_LINE_COLOR = "#2fa4e7"
PLOT_POINT_COLOR = "#2b3b90"

#################################################################################################
######################################  FUNCTIONS  ##############################################
#################################################################################################

### Function for formatting input node data.
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
    fig.update_traces(
        line={"color": PLOT_LINE_COLOR},
        marker={"color": PLOT_POINT_COLOR},
    )
    return fig

#################################################################################################
###############################  START OF APP CODE  #############################################
#################################################################################################

# Read in node data.
node_df = get_data("data/")
node_df_cp = node_df.copy()

# Trigger app.
app = dash.Dash(external_stylesheets=[dbc.themes.CERULEAN],suppress_callback_exceptions=True, title="SWOT River Database (SWORD)")

#################################################################################################
### Opens 'About SWORD' markdown document used in the modal overlay.
with open("about.md", "r") as f:
    about_md = f.read()

with open("download.md", "r") as d:
    download_md = d.read()

# Modal pop-up triggered by the "About" button in the header .
modal_overlay = dbc.Modal(
    [
        dbc.ModalBody(
            html.Div([
                dcc.Markdown(about_md)],
                id="about-md")),
        dbc.ModalFooter(
            dbc.Button(
                "Close",
                id="howto-close",
                className="howto-bn")),
    ],
    id="modal",
    size="lg",
)

# Modal pop-up triggered by the "Download" button in the header .
download_overlay = dbc.Modal(
    [
        dbc.ModalBody(
            html.Div([
                dcc.Markdown(download_md)],
                id="download-md")),
        dbc.ModalFooter(
            dbc.Button(
                "Close",
                id="download-close",
                className="howto-bn")),
    ],
    id="download_modal",
    size="lg",
)

# About button in header.
button_about = dbc.Button(
    "About",
    id="howto-open",
    outline=False,
    color="#2b3b90", #swot dark blue
    style={
        "textTransform": "none",
        "margin-right": "5px",
        "color":"white",
        "background-color":"#2b3b90",
    },
)

# Download button in header.
button_download = dbc.Button(
    "Download",
    outline=False,
    color="#2b3b90", #swot dark blue
    # href="https://zenodo.org/record/5643392#.Yv-oeezML0s",
    id="download-open",
    style={
        "text-transform": "none",
        "margin-left": "5px",
        "color":"white",
        "background-color":"#2b3b90",
    },
)

#################################################################################################

# Dashboard header
header = dbc.Navbar(
    dbc.Container(
        [
            dbc.Row(
                [
                    dbc.Col(
                        html.Img(
                            id="logo1",
                            src=app.get_asset_url("swot_mainlogo_dark2.png"),
                            height="70px",
                        ),
                        md="auto",
                    ),
                    dbc.Col(
                        html.Img(
                            id="logo2",
                            src=app.get_asset_url("SWORD_Logo.png"),
                            height="60px",
                        ),
                        md="auto",
                    ),
                    dbc.Col(
                        [
                            html.Div(
                                [
                                    html.H2(
                                        "SWOT River Database (SWORD) - Version 17b",
                                        style={
                                            "textAlign":"left",
                                            "margin-top":"15px"}),
                                    html.P(html.H4(
                                        "Interactive Dashboard",
                                        style={"textAlign":"left"})),
                                ],
                                id="app-title",
                            )
                        ],
                        md=True,
                        align="center",
                    ),
                ],
                align="center",
            ),
            dbc.Row(
                [
                    dbc.Col(
                        [
                            dbc.NavbarToggler(id="navbar-toggler"),
                            dbc.Collapse(
                                dbc.Nav(
                                    [
                                        dbc.NavItem(button_about,),
                                        dbc.NavItem(button_download,),
                                    ],
                                    navbar=True,
                                ),
                                id="navbar-collapse",
                                navbar=True,
                            ),
                            modal_overlay,
                            download_overlay,
                        ],
                        md=2,
                    ),
                ],
                align="center",
            ),
        ],
        fluid=True,
        className='text-white p-2',
        style={"backgroundColor": HEADER_COLOR},
    ),
    style={"backgroundColor": HEADER_COLOR},
    # sticky="top", #uncomment to stick to top.
)

#################################################################################################
# Continent tabs formatting. Continent tab layout changes based on the "render_content" callback.

tabs_styles = {
    'height': '51px'
}
tab_style = {
    'borderTop': '5px' , #2fa4e7 cerulean
    'borderBottom': '5px',
    'padding': '10px',
    'fontWeight': 'bold',
    'color': 'white',
    'background': '#2b3b90'
}

tab_selected_style = {
    'borderTop': '5px solid #2fa4e7', #2fa4e7 cerulean
    'borderBottom': '5px solid #2fa4e7',
    'borderLeft': '5px solid #2fa4e7',
    'borderRight': '5px solid #2fa4e7',
    'padding': '10px',
    'color': 'white',
    'background': '#2b3b90'
}

#################################################################################################
### PRIMARY APP LAYOUT.

app.layout = html.Div([
        header,
        #insert tabs
        html.Div([
            dcc.Tabs(
                id="all-tabs-inline",
                value='tab-4',
                children=[
                    dcc.Tab(
                        label='Africa',
                        value='tab-1',
                        style=tab_style,
                        selected_style=tab_selected_style),
                    dcc.Tab(
                        label='Asia',
                        value='tab-2',
                        style=tab_style,
                        selected_style=tab_selected_style),
                    dcc.Tab(
                        label='Europe & Middle East',
                        value='tab-3',
                        style=tab_style,
                        selected_style=tab_selected_style),
                    dcc.Tab(
                        label='North America',
                        value='tab-4',
                        style=tab_style,
                        selected_style=tab_selected_style),
                    dcc.Tab(
                        label='Oceania',
                        value='tab-5',
                        style=tab_style,
                        selected_style=tab_selected_style),
                    dcc.Tab(
                        label='South America',
                        value='tab-6',
                        style=tab_style,
                        selected_style=tab_selected_style),
                ],
            style=tabs_styles
            )
        ]),
        html.Br(),
        html.Div(id='tabs-content-example-graph'), #callback for tab content.
        html.Div([
            html.H4(
                'Click a Reach to plot Node level attributes:',
                style={
                    'marginTop' : '30px',
                    'marginBottom' : '5px',
                    'size':'35'}
            ),
            dcc.Graph(
                figure=plot_nodes(node_df_cp),
                id='ReachGraph')
        ]), #end subdiv3
        html.Br(),
        html.Div(children=[
            html.Div(
                'Copyright (c) 2026 University of North Carolina at Chapel Hill',
                style={
                    'textAlign':'left',
                    'font-size': '0.7em',
                    'marginLeft':'5px',
                },
            ),
            html.Div(
                'Dashboard written in Python using the Dash web framework.',
                style={
                    'textAlign':'left',
                    'font-size': '0.7em',
                    'marginLeft':'5px',
                }
            ),
            html.Div(
                'Base map layer is the "cartodbpositron" map style provided by CARTO.',
                style={
                    'textAlign':'left',
                    'font-size': '0.7em',
                    'marginLeft':'5px',
                }
            )
        ], style={'textAlign':'left', 'color':'slateGrey'}),
    ],
    style={
        'marginTop' : '5px',
        'marginRight' : '50px',
        'marginBottom' : '5px',
        'marginLeft' : '50px',
        "textAlign":"center"}
) #end of app layout

#################################################################################################
######################################  CALLBACKS  ##############################################
#################################################################################################

#Callback that triggers the main map dispaly to change based on which tab is clicked.
#output is the tab layout.
@app.callback(Output('tabs-content-example-graph', 'children'),
              Input('all-tabs-inline', 'value'),)
def render_content(tab):
    if tab == 'tab-1':
        return html.Div([
            html.Div(
                html.H4('Click on a Basin to Visualize Reaches'),
                    style={
                        'marginBottom' : '5px',
                        'size':'30',
                        'color':'#C42828'},
                    ),
            html.Div([
                html.Div(
                    '**PLEASE NOTE: Reach geometries have been simplified \
                        for map efficiency, however, some large basins \
                            (i.e. Amazon, Ganges-Barmaputra) may still take \
                                a few moments to load.**',
                    style={
                        'marginTop' : '5px',
                        'marginBottom' : '5px',
                        'size':'25',
                        'color':'#C42828'},
                    ),
            ]),
            html.Iframe(
                id='BasinMap',
                srcDoc=open('data/af_basin_map.html', 'r').read(),
                style={"height": "800px", "width": "100%"} #a good height is "800px"
                ), 
            dcc.Store(id="clicked-feature"),
        ]) #end subdiv1
    elif tab == 'tab-2':
        return html.Div([
            html.Div(
                html.H4('Click on a Basin to Visualize Reaches'),
                    style={
                        'marginBottom' : '5px',
                        'size':'30',
                        'color':'#C42828'},
                    ),
            html.Div([
                html.Div(
                    '**PLEASE NOTE: Reach geometries have been simplified \
                        for map efficiency, however, some large basins \
                            (i.e. Amazon, Ganges-Barmaputra) may still take \
                                a few moments to load.**',
                    style={
                        'marginTop' : '5px',
                        'marginBottom' : '5px',
                        'size':'25',
                        'color':'#C42828'},
                    ),
            ]),
            html.Iframe(
                id='BasinMap',
                srcDoc=open('data/as_basin_map.html', 'r').read(),
                style={"height": "800px", "width": "100%"}
                ),
            dcc.Store(id="clicked-feature"),
        ]) #end subdiv2
    elif tab == 'tab-3':
        return html.Div([
            html.Div(
                html.H4('Click on a Basin to Visualize Reaches'),
                    style={
                        'marginBottom' : '5px',
                        'size':'30',
                        'color':'#C42828'},
                    ),
            html.Div([
                html.Div(
                    '**PLEASE NOTE: Reach geometries have been simplified \
                        for map efficiency, however, some large basins \
                            (i.e. Amazon, Ganges-Barmaputra) may still take \
                                a few moments to load.**',
                    style={
                        'marginTop' : '5px',
                        'marginBottom' : '5px',
                        'size':'25',
                        'color':'#C42828'},
                    ),
            ]),
            html.Iframe(
                id='BasinMap',
                srcDoc=open('data/eu_basin_map.html', 'r').read(),
                style={"height": "800px", "width": "100%"}
                ),
            dcc.Store(id="clicked-feature"),
        ]) #end subdiv3
    elif tab == 'tab-4':
        return html.Div([
            html.Div(
                html.H4('Click on a Basin to Visualize Reaches'),
                    style={
                        'marginBottom' : '5px',
                        'size':'30',
                        'color':'#C42828'},
                    ),
            html.Div([
                html.Div(
                    '**PLEASE NOTE: Reach geometries have been simplified \
                        for map efficiency, however, some large basins \
                            (i.e. Amazon, Ganges-Barmaputra) may still take \
                                a few moments to load.**',
                    style={
                        'marginTop' : '5px',
                        'marginBottom' : '5px',
                        'size':'25',
                        'color':'#C42828'},
                    ),
            ]),
            html.Div(id="feature-output"), #delete! This is for click testing 
            html.Iframe(
                id='BasinMap',
                srcDoc=open('data/na_basin_map.html', 'r').read(),
                style={"height": "800px", "width": "100%"}
                ),
            dcc.Store(id="clicked-feature"),
        ]) #end subdiv4
    elif tab == 'tab-5':
        return html.Div([
            html.Div(
                html.H4('Click on a Basin to Visualize Reaches'),
                    style={
                        'marginBottom' : '5px',
                        'size':'30',
                        'color':'#C42828'},
                    ),
            html.Div([
                html.Div(
                    '**PLEASE NOTE: Reach geometries have been simplified \
                        for map efficiency, however, some large basins \
                            (i.e. Amazon, Ganges-Barmaputra) may still take \
                                a few moments to load.**',
                    style={
                        'marginTop' : '5px',
                        'marginBottom' : '5px',
                        'size':'25',
                        'color':'#C42828'},
                    ),
            ]),
            html.Iframe(
                id='BasinMap',
                srcDoc=open('data/oc_basin_map.html', 'r').read(),
                style={"height": "800px", "width": "100%"}
                ),
            dcc.Store(id="clicked-feature"),
        ]) #end subdiv5
    elif tab == 'tab-6':
        return html.Div([
            html.Div(
                html.H4('Click on a Basin to Visualize Reaches'),
                    style={
                        'marginBottom' : '5px',
                        'size':'30',
                        'color':'#C42828'},
                    ),
            html.Div([
                html.Div(
                    '**PLEASE NOTE: Reach geometries have been simplified \
                        for map efficiency, however, some large basins \
                            (i.e. Amazon, Ganges-Barmaputra) may still take \
                                a few moments to load.**',
                    style={
                        'marginTop' : '5px',
                        'marginBottom' : '5px',
                        'size':'25',
                        'color':'#C42828'},
                    ),
            ]),
            html.Iframe(
                id='BasinMap',
                srcDoc=open('data/sa_basin_map.html', 'r').read(),
                style={"height": "800px", "width": "100%"}
                ),
            dcc.Store(id="clicked-feature"),
        ]) #end subdiv6

#Callback that triggers the regional maps to change based on the "Dropbox" option.
@app.callback(
    Output("BasinMap", "srcDoc"),
    Output("clicked-feature", "data", allow_duplicate=True),
    Input("clicked-feature", "data"),
    prevent_initial_call=True)
def update_output_div(feature):
    if feature is None:
        raise PreventUpdate
    else:
        try:
            figure = "data/hb"+str(feature['feature']['properties']['Basin'])+"_sword_map.html"
            return open(figure,'r').read(), None
        except:
            raise PreventUpdate

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

# Callback for "About" modal popup
@app.callback(
    Output("modal", "is_open"),
    [Input("howto-open", "n_clicks"), Input("howto-close", "n_clicks")],
    [State("modal", "is_open")])
def toggle_modal(n1, n2, is_open):
    if n1 or n2:
        return not is_open
    return is_open

# Callback for "Report" modal popup
@app.callback(
    Output("report-modal", "is_open"),
    [Input("report-open", "n_clicks"), Input("report-close", "n_clicks")],
    [State("report-modal", "is_open")],
)
def toggle_modal(n3, n4, is_open):
    if n3 or n4:
        return not is_open
    return is_open

# Callback for "Download" modal popup
@app.callback(
    Output("download_modal", "is_open"),
    [Input("download-open", "n_clicks"), Input("download-close", "n_clicks")],
    [State("download_modal", "is_open")])
def toggle_modal(n5, n6, is_open):
    if n5 or n6:
        return not is_open
    return is_open

if __name__ == '__main__':
    app.run_server()
    # app.run_server(debug=True) #use this line instead of the line before to run the app in debug mode.
