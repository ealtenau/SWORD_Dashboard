from dash import Dash, html, Input, Output, dcc

app = Dash(__name__)

app.layout = html.Div([
    html.Iframe(id="map", srcDoc=open("data/na_basin_map.html",
                "r").read(), width="100%", height="500px"),
    dcc.Store(id="clicked-feature"),
    html.Div(id="feature-output")
])

# Dash callback to update the output with the feature ID
@app.callback(
    Output("feature-output", "children"),
    [Input("clicked-feature", "data")]
)
def display_feature_id(feature):
    if feature:
        return f"Clicked feature: {feature['feature']['properties']['Basin']}" #was just 'feature' ; feature['feature']['properties']['Basin']
    else:
        return "No feature clicked yet."


if __name__ == "__main__":
    app.run_server(debug=True)
