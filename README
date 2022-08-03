# Documentation

Source code is divided into 3 files under the pages branch:

```
problematicpolygons.html
assets/js/ppoly.js
assets/css/ppoly.css
```

HTML contains is divided into head and body tags. The head tag loads ppoly.css which configures the style of the left-hand legend in the map. The head tag also loads the deck.gl script for the creation of the map overlay (arcs and circles). The body tag contains the tags for the google map to be initialized, as well as the legend that will be moved inside the map tag. The body tag ends by loading all JavaScript code necessary for the functionality of the map. It first needs to load ppoly.js which configures all the functions which will be called by the subsequence google API scripts, including the initMap, importData and importColour callbacks. It is important to first initialize the map, then import the data and finally import the colours.

Data should come as a google spreadsheet tab (Usually Sheet1). It should contain an ID as the first column followed by the Latitude origin and target columns as well as Longitude origin and target columns, totaling 5 columns (Id and LatLon). The 6th column (F) onwards can contain any extra properties you wish to have connected to each of the geographic points (rows). The code will automatically load these properties into an information window when you click the arcs or circles.

Like with data, colours should come as a google spreadsheet tab and will be tied to the property columns (6th onwards) and will appear in the legend for their respective map. The map identifiers can be located as options in the mapSelector tag inside the problematicpolygons.html file. The first cell for each colour spreadsheet must have the map identifier followed by a period (.) and the column name from the data spreadsheet. The other columns should contain the RGB values that will be used as default colours for properties of the maps.
To add or remove map data or colours, it is only necessary to change the problematicpolygons.html file. For any specific data point changes modify the associated google spreadsheet.

## Example

Adding a new data spreadsheet:

1. Locate “<!--Import Data before Colours-->“ in the html file.

2. Add a script tag with the google spreadsheet Id and the tab name:

  a.```<script src="https://sheets.googleapis.com/v4/spreadsheets/SPREADSHEETIDGOESHERE/values/TABNAMEGOESHERE?key=GOOGLEAPIKEYGOESHERE&callback=importData"></script>```

  b. Do not add spaces to the tab name to prevent any issues.

3. Add a colour for each of the columns(properties) you would like to have in the legend. This script tag will go after all data scripts.

  a. ```<script src="https://sheets.googleapis.com/v4/spreadsheets/ SPREADSHEETIDGOESHERE/values/TABNAMEGOESHERE?key=GOOGLEAPIKEYGOESHERE&callback=importColour"></script>```

  b. Do not add spaces to the tab name to prevent any issues.

4. Add the data id and name to the legend options:

  a. Locate “<!--Add new map here along with a google spreadsheet invoking importData at the bottom-->“ in the html file.

  b. Add a new option (will appear in order):

    ```<option value="MAPIDHERE">MAPNAMEHERE</option>```

    Ids cannot contain spaces but names can.

### IMPORTANT: The order in which the data is imported should be the same as the order of the map options.

E.g., if the problematic polygons data is imported first and then the Smakwuts one, the map options must be in the same order:

```
<option value="ppoly">Problematic Polygons</option>
<option value="smakw">Smakwuts</option>
```

## HTML template

Twenty by HTML5 UP
html5up.net | @ajlkn
Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)


This is Twenty, a minimal, multi-page responsive site template for HTML5 UP.

As the name implies, this is my twentieth (!) design for HTML5 UP. Since the last
few have been single page affairs, I decided to go with something a bit more conventional
and threw in four extra page layouts. Beyond that, it's the usual drill: fully responsive,
built on HTML5/CSS3, and CCA licensed like all my other stuff. Sass sources are also
included for those of you into that sort of thing (entirely optional).

Special thanks to Michael Domaradzki (md.photomerchant.net) for allowing me to use
his excellent photos in Twenty's demo*.

(* = Not included! Only meant for use with my own on-site demo, so please do NOT download
and/or use any of Michael's work without his explicit permission!)

AJ
aj@lkn.io | @ajlkn

PS: Not sure how to get that contact form working? Give formspree.io a try (it's awesome).


Credits:

	Demo Images:
		Michael Domaradzki (md.photomerchant.net)
			"Night Vision"
			"At the Station II"
			"Airchitecture II"
			"Livewires II"
			"Midnite Xpress I"

	Icons:
		Font Awesome (fontawesome.io)

	Other:
		jQuery (jquery.com)
		Scrollex (github.com/ajlkn/jquery.scrollex)
		Responsive Tools (github.com/ajlkn/responsive-tools)
