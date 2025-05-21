<p align="center">
    <img src="" width="300">
</p>

# SWORD Explorer Dashboard
Source code for developing and maintaining the online [SWORD Explorer Dashboard](https://www.swordexplorer.com/).

The "assets" directory contains logos and scripts to produce the SWORD maps, basin maps, and node files that are output to a "data" directory. 

The "data" directory contains the SWORD maps, basin maps, and node files used to display SWORD information in the main app. This directory will be created when running the scripts for the first time. 

## SWORD Explorer is intended to help examine the most up-to-date SWORD version, and help users identify and report areas for improving SWORD. 

### Notes for Users
- The first map displayed for each region is the basin map key. Users can use this key to identify a river basin they wish to explore, then click the basin to display the river reaches contained in the selected basin.
- Maps that display rivers include 7 attribute layers: reach boundaries, water surface elevation (WSE), width, flow accumulation, distance from outlet, slope, and number of SWOT observations. Layers can be toggled on and off using the layers panel in the bottom-right corner of the map.
- Users can hover or click on a reach to view attribute information.
- Users can click on a Reach ID to plot node-level properties of node order, width, elevation, flow accumulation, sinuosity, and number of channels along a specified reach.
- Native SWORD reach geometries are built at 30 m resolution, however, for map efficiency gemetries have been simplified. To examine full reach geometries, please download the full SWORD Database.
- Users can click on the "Report Reach" button below the main map to report issues or suggest changes to SWORD. 

![Fig1]()
##_Figure 1:_## Home screen of SWORD Explorer. Users can click on a basin to visualize reaches. 

![Fig2]()
##_Figure 2:_## The layers panel in the top-right hand corner of the map allows users to view different attributes for the displayed reaches. 

![Fig3]()
##_Figure 3:_## Users can also choose to view the data over an accessible basemap or satellite imagery. 

