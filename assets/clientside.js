// all code in this file will be executed when the page is loaded

// listen for the DOMContentLoaded event to ensure the page is fully loaded
window.addEventListener("DOMContentLoaded", function () {
  // once the page is loaded, adds an event listener to receive messages from the iframed map component
  window.addEventListener(
    "message",
    (event) => {
      if (event.data.type === "featureClick") {
        const feature = event.data;
        // set dcc.store data using set_props: https://dash.plotly.com/clientside-callbacks#set-props
        window.dash_clientside.set_props("clicked-feature", {
          data: feature,
        });
      }
    },
    false
  );
});
