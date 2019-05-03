var launchElement = 'tt';
var isGeoEnabled = false;
var isMoving = false;
var map;
var firstCenter;
var aniTimeout;
var currentDataMode = -999;
var currentTsMode;
var currentElement;
var currentDayIndex = 0;//TS_OVERVIEW_ID;
var currentStnCode = "";
var currentNcrfImage;
var currentSelTimeStr = "";
var isAni = false;
var isSliderOn = true;
var isStationClicked = false;
var isStnTooptipOn = false;
var isIncludeNcln = false; // indicate if the nowcast time series is within lightning region
var currentFcstDateList = [];
var mapElseHeight = 0;
var progressBarTimeout;
var manualUpdateTimeout;
var autoUpdateTimeout;
var isChangeMode = false;
var tsDialogHeight = 0;
var dialogTop = 0;
var dialogBottom = 0;
var isMakeJqTitle = false;
var tsContentMaxId = 0;
var eleBtnList = [];
var isNcrfPreloaded = false;
var prevPrevTime;
var isValueChangedByUser = false;
var aniPanelWidth = 530; //500; //420;
var aniSliderWidth = 500; //460; //380;
var colorCode = { tt: [], rh: [] };
var clickedLL;
var isFirstLoad = true;
var isFirstInitGrid = true;
var isRefresh = true;
var loopLaunchElementCount = 0;
var isTwoIcon = false;
var isInter = window.location.hostname.substring(0,4) == "maps";
var checkForGoogleMapError = 0;
var alertModelTime = false;

function getEnv(){
	var hostname = window.location.hostname;
	if(hostname == "hpc2pvm1" || hostname == "hpc2rvm1" || hostname == "localhost"){
			return "development";
	}

	return "production";
}

function FcstDayObj(fcstDate, vtimeFrom, vtimeTo, vtimeWxFrom, vtimeWxTo) {
	this.fcstDate = fcstDate;
	this.vtimeFrom = vtimeFrom;
	this.vtimeTo = vtimeTo;
}

function setKeysCtrl() {
	// keyboard events
	$("html").on( "keydown", function( event ) {
		if ($('.all-dialog').is(':visible')) {
			if ( event.which == 27) {
				// esc key
				clickAButton('#closeBg');
			}
		} else {
			if ( event.which == 13 ) {
				// enter key
			} else if ( event.which == 36 ) {
				// home key
				clickAButton('#mapZoomHome');
			} else if ( event.which == 61 || event.which == 107 ) {
				// plus
				clickAButton('#mapZoomIn');
			} else if ( event.which == 173 || event.which == 109 ) {
				// minus
				clickAButton('#mapZoomOut');
			} else if ( event.which == 191 ) {
				// question mark
				//clickAButton('.hp-button');
			} else if ( event.which == 80 ) {
				// p
				clickAButton('#aniStart');
			} else if ( event.which == 82 ) {
				// r
				clickAButton('#mapRefresh');
			} else if ( !$('.ui-slider-handle').is(':focus') && event.which == 37 ) {
				// arrow left
				clickAButton('#aniPrev');
			} else if ( !$('.ui-slider-handle').is(':focus') && event.which == 39 ) {
				// arrow right
				clickAButton('#aniNext');
			} else {

			}
		}
	});
}

function clickAButton(btn) {
	if ($(btn) && $(btn).is(':visible')) {
		$(btn).trigger('click');
	}
}

function getNcLayerImageObj() {
	return $('#'+map.ncrfLayer.id+" img:first-child");
}

function createNcrfCanvas() {
	var dataArray = dataGrp[MODE_NOWCAST_RF].data;
	for (var i = 0; i < dataArray.length; ++i) {
		//var thisObj = dataGrp[currentDataMode].data[i];
		dataArray[i].canvasId = 'ncrfImg'+i;

		// do not put this part inside the "!document" condition
		// as it will has errors after data update
		dataArray[i].img = new Image();
		dataArray[i].img.src = NCIMG_PATH+dataArray[i].values[0];

		if (!document.getElementById(dataArray[i].canvasId)) {
			//$('body').append('<canvas id="' + dataArray[i].canvasId + '" class="ncrf-img" width="' + imgObj.width() + 'px" height="' + imgObj.height() + 'px"></canvas>');
			$('body').append('<canvas id="' + dataArray[i].canvasId + '" class="ncrf-img" width="' + NCRF_B_OBJ.wSize + 'px" height="' + NCRF_B_OBJ.hSize + 'px"></canvas>');
		}
	}
	isNcrfPreloaded = true;
}

function initMap() {
	OpenLayers.Control.ListenToClick = OpenLayers.Class(OpenLayers.Control, {
		defaultHandlerOptions: {
			'single': true,
			'pixelTolerance': 0,
			'stopSingle': false
		},

		initialize: function(options) {
			this.handlerOptions = OpenLayers.Util.extend(
				{}, this.defaultHandlerOptions
			);
			OpenLayers.Control.prototype.initialize.apply(
				this, arguments
			);
			this.handler = new OpenLayers.Handler.Click(
				this, {
					'click': this.onClick
				}, this.handlerOptions
			);
		},

		onClick: function(evt) {
			// trigger time series of nowcast rainfall by picking the colors on the images
			clickedLL = map.getLonLatFromViewPortPx(evt.xy);
			//console.log(clickedLL);
			var clickedLLTrans = map.getLonLatFromViewPortPx(evt.xy).transform(epsg900913, epsg4326);

			removeTooltip();

			// make sure it is nowcast mode and the clicked region is within prd
			if ((currentDataMode == MODE_NOWCAST_RF && map.ncrfBounds.containsLonLat(clickedLL, true)) || (currentDataMode == MODE_NOWCAST_LN && map.nclnBounds.containsLonLat(clickedLL, true)) ) {
				currentDayIndex = 0;

				// 0. Prepare the actions after loaded required info
				var toBeExecuted = function() {
					tsShow("", "", currentDataMode);
				};

				// 1. Trigger time series of nowcast rainfall by picking the colors on the images

				// NEW method to get pixel
				var ncrfGrid = NCRF_B_OBJ.getGridFromLatLon(clickedLLTrans);
				var ncrfRealPx = NCRF_B_OBJ.getPixelFromGrid(ncrfGrid);

				// get the RGB of the pixel on all rainfall images
				rfTsArray = [];
				for (var i = 0; i < dataGrp[MODE_NOWCAST_RF].data.length; ++i) {
					var bin = rfGetBinFromPx(dataGrp[MODE_NOWCAST_RF].data[i].canvasId, dataGrp[MODE_NOWCAST_RF].data[i].img, ncrfRealPx.x, ncrfRealPx.y);
					//rfTsArray.push([tsGetNcrfJqPlotTimeStr(dataGrp[MODE_NOWCAST_RF].data[i].vtime), (bin == DUMMY_VALUE ? NCRF_BINS[0] : bin)]);
					rfTsArray.push([dataGrp[MODE_NOWCAST_RF].data[i].vtime, (bin == DUMMY_VALUE ? NCRF_BINS[0] : bin)]);
				}

				// 2. Handle the lightning (if applicable)
				lnTsArray = [];
				isIncludeNcln = false;
				if (map.nclnBounds.containsLonLat(clickedLL, true) && !isWidget) {
					isIncludeNcln = true;

					var nclnGrid = NCLN_B_OBJ.getGridFromLatLon(clickedLLTrans);

					var findJsonGrid = function() {
						var errorCount = 0;
						for (var i = 0; i < rfTsArray.length; ++i) {
							if (NCLN_FCSTS.indexOf(rfTsArray[i][0]) >= 0) {
								try {
									//rfTsArray[i].push(NCLN_JSON_OBJ[rfTsArray[i][0]]['data'][0]['affected_grid'][nclnGrid.x+'_'+nclnGrid.y]['radius']);

									var order = NCLN_JSON_OBJ[rfTsArray[i][0]]['block'];
									var value = NCLN_JSON_OBJ[rfTsArray[i][0]]['data']['data'][0]['affected_grid'][nclnGrid.x+'_'+nclnGrid.y]['radius'];
									if (order == 2) {
										value = value * 2;
									}
									rfTsArray[i].push(value);

								} catch (e) {
									rfTsArray[i].push(0);
								}
							} else {
								rfTsArray[i].push(DUMMY_VALUE);
								++errorCount;
							}
						}
						// if not found at all: remove the last index to indicate this is time series without lightning
						if (errorCount >= rfTsArray.length && nclnErrCode == 0) {
							nclnErrCode = 1;
							for (var i = 0; i < rfTsArray.length; ++i) {
								rfTsArray[i].pop();
							}
						}
					};

					if (Object.keys(NCLN_JSON_OBJ).length == 0) {
						// if the lightning data is not yet initialized, ajax the JSONs files first
						nclnErrCode = 0;
						showProgress();
						$.when.apply(null, getLightningDeferredJsonActions()).done(function() {
							// after finished reading all lightning JSONs
							removeProgress();
							findJsonGrid();
							toBeExecuted();
						});
					} else {
						findJsonGrid();
						toBeExecuted();
					}
				} else {
					toBeExecuted();
				}
			} else if (currentDataMode != MODE_NOWCAST_RF && currentDataMode != MODE_NOWCAST_LN && !isStationClicked && currentGrid.getCurrentGridSuccess(clickedLL.transform(epsg900913, epsg4326))) {
				map.mrHoverLayer.destroyFeatures();
				map.mrHoverLayer.addFeatures(currentGrid.cell);
				currentDayIndex = 0;//currentDayIndex = TS_OVERVIEW_ID;

				var toBeExecuted = function() {
					//console.log("time series " + currentGrid.gridName);
					tsShow(currentGrid.gridName, "", MODE_GRID_HOURLY);
					setTimeout(function() {
						map.mrHoverLayer.destroyFeatures();
					}, 2000);
				};

				var unloadedGrids = [];
				if (!OCF_GRID_OBJ[currentGrid.gridName]) {
					showProgress();
					unloadedGrids.push(currentGrid.gridName);
					var deferreds = getDeferredJsonActions(MODE_GRID_HOURLY, unloadedGrids);
					$.when.apply(null, deferreds).done(function() {
						removeProgress();
						toBeExecuted();
					});
				} else {
					toBeExecuted();
				}
			}
		}
	});

    map = new OpenLayers.Map('map', {
        // disable controls
        controls: [new OpenLayers.Control.Navigation()],
        displayProjection: epsg4326,
        projection: epsg900913,
        eventListeners: {
            "moveend": mapEvent,
            "zoomend": mapEvent
        },
		theme: false,
        // these settings can stop the animation of marker moving
        panDuration: 1,
        panMethod: null,
        // these settings can stop the animation of marker zooming
        zoomDuration: 1,
        zoomMethod: null,
        // define zoom range user can choose
        //minZoomLevels: globalMinZoom,
        //maxZoomLevels: globalMaxZoom,
        isValidZoomLevel: function (zoomLevel) {
            var minZoomLevels = this.minZoomLevels || 0;
            var maxZoomLevels = this.maxZoomLevels && this.maxZoomLevels > minZoomLevels ? this.maxZoomLevels : this.getNumZoomLevels();
            return ((zoomLevel != null) && (zoomLevel >= minZoomLevels) && (zoomLevel < maxZoomLevels));
        },
        //restrictedExtent: new OpenLayers.Bounds(113.0, 21.7, 115.2, 23.1).transform(epsg4326, epsg900913)
		restrictedExtent: new OpenLayers.Bounds(110, 19, 118, 26).transform(epsg4326, epsg900913)
    });

	//map.restrictedExtent = new OpenLayers.Bounds(112.956, 21.328, 115.291, 23.487).transform(epsg900913, epsg4326);
    //-------------------------
    // Setup google map

    function failbackToOSM() {
        // OSM default map layer
		var osm = new OpenLayers.Layer.OSM("OpenStreetMap", MAP_URL, {
			transitionEffect : "resize"
		});
		map.minZoomLevels = 10;
		map.maxZoomLevels = 13;
        map.addLayer(osm);
        map.setBaseLayer(osm);
		isGoogleFailed = true;
    }

		//Disable Google Map
		/*
    try {
        if (google && google.maps) {
            var baseMap = new OpenLayers.Layer.Google("GoogleStreets", {
                sphericalMercator: true,
                numZoomLevels: 15
            });
            map.addLayer(baseMap);
            var googleFailbackTimeout = setTimeout(function () {
                map.removeLayer(baseMap);
                failbackToOSM();
            }, waitGMapFail);
            google.maps.event.addListener(baseMap.mapObject, 'tilesloaded', function () {
                clearTimeout(googleFailbackTimeout);
				isGoogleFailed = false;
                if (map.baseLayer != baseMap) return;
                // hide all data layers during animation of google map
                map.events.register("movestart", null, function (evt) {
                    hideAllDataLayers();
                });
                //        map.events.register("move", null, function(evt){
                //          hideAllDataLayers();
                //        });
                google.maps.event.addListenerOnce(baseMap.mapObject, "idle", function () {
                    showAllDataLayers();
                });
                // prevent station value move with multi-touch zoom while the google base map stay unmove
                var navigation = map.getControlsByClass('OpenLayers.Control.Navigation')[0];
                if (navigation && navigation.pinchZoom) {
                    var callbacks = navigation.pinchZoom.handler.callbacks;
                    var old_pinchStart = callbacks.start;
                    callbacks.start = function (evt, pinchData) {
                        old_pinchStart.apply(this, arguments);
                        this.originalResolution = this.map.getResolution();
                        this.originalZoom = this.map.getZoom();
                    }
                    OpenLayers.Control.PinchZoom.prototype.applyTransform = function () {};
                    var old_pinchMove = callbacks.move;
                    callbacks.move = function (evt, pinchData) {
                        old_pinchMove.apply(this, arguments);
                        // hide all data layers while zooming
                        hideAllDataLayers();
                        // Copy the pinchDone code to here
                        var zoom = this.map.getZoomForResolution(this.originalResolution / pinchData.scale, true);
                        if (zoom !== this.originalZoom) {
                            // Force a reflow before calling setCenter. This is to work
                            // around an issue occuring in iOS.
                            //
                            // See https://github.com/openlayers/openlayers/pull/351.
                            //
                            // Without a reflow setting the layer container div's top left
                            // style properties to "0px" - as done in Map.moveTo when zoom
                            // is changed - won't actually correctly reposition the layer
                            // container div.
                            //
                            // Also, we need to use a statement that the Google Closure
                            // compiler won't optimize away.
                            this.map.div.clientWidth = this.map.div.clientWidth;
                            //this.map.setCenter(location, zoom);
                            this.map.zoomTo(zoom);
                        }
                    }
                }
            }); // END of tilesloaded
            // prevent station value move with multi-touch zoom while the google base map stay unmove
            var hide_timeout_for_show_again = null;
            var hide_timeout_window_time = 500;

            function hideAllDataLayers() {
                // prevent duplicated hide
                if (hide_timeout_for_show_again) return;
                hide_timeout_for_show_again = setTimeout(showAllDataLayers, hide_timeout_window_time);
                // tmp hide all layers
                for (var i = 0, ii = map.layers.length; i < ii; i++) {
                    var layer = map.layers[i];
                    if (!layer.isBaseLayer && !layer.isLockedLayer) {
                        layer.setVisibility(false);
                    }
                }
            }

            function showAllDataLayers() {
				aniShiftHour(0);
                // delay the timeout to filter the noise events
                clearTimeout(hide_timeout_for_show_again);
                hide_timeout_for_show_again = setTimeout(function () {
                    // set back the original vis value
                    for (var i = 0; i < map.layers.length; i++) {
                        var layer = map.layers[i];
                        if (!layer.isBaseLayer && !layer.isLockedLayer) {
                            layer.setVisibility(true);
                        }
                    }
                    // reset back for next hide-show cycle
                    hide_timeout_for_show_again = null;
                }, hide_timeout_window_time);
            }
        }
    } catch (e) {
        console.log(e);
    }
		*/

    if (!map.baseLayer) {
        failbackToOSM();
    }

//		if(!isInter){
			failbackToOSM();
//		}

	//-------------------------
    //firstCenter = new OpenLayers.LonLat(114.112661, 22.3554167 - (isMobile ? 0.040 : 0)).transform(epsg900913, epsg4326);

	// the rectangular grid look and feel on overview map
	var gridBoxColor = '#F25C5C';
	var gridBoxRule = [];
	gridBoxRule.push(new OpenLayers.Rule({
		filter: new OpenLayers.Filter.Comparison({
			type: OpenLayers.Filter.Comparison.EQUAL_TO,
			property: "type",
			value: "singleGrid"
		}),
		symbolizer: {
			fillColor: gridBoxColor,
			fillOpacity: 0.5,
			strokeColor: gridBoxColor,
			strokeOpacity: 0.5,
			strokeWidth: 1
		}
	}));

	var gridBoxVectorStyle = new OpenLayers.Style();
	gridBoxVectorStyle.addRules(gridBoxRule);
	gridBoxVectorStyleMap = new OpenLayers.StyleMap({
		"default": gridBoxVectorStyle
	});

    // OTHER LAYERS
    map.mrLayer = new OpenLayers.Layer.Vector("LabelOverlay", {
        renderers: ['SVG', 'Canvas', 'ExCanvas', 'VML']
    });
	map.addLayer(map.mrLayer);

	// map.mrHoverLayer = new OpenLayers.Layer.Vector("LabelOverlay", {
        // renderers: ['SVG', 'Canvas', 'ExCanvas', 'VML']
    // });
	map.mrHoverLayer = new OpenLayers.Layer.Vector(
		"Hover Layer", {
			displayProjection: epsg4326,
			projection: epsg900913,
			renderers: ["SVG", "VML", "Canvas"],
			styleMap: gridBoxVectorStyleMap,
			visibility: true
		}
	);
	map.addLayer(map.mrHoverLayer);

	// nowcast: rainfall
	map.ncrfBounds = new OpenLayers.Bounds(NCRF_B_OBJ.wLon, NCRF_B_OBJ.sLat, NCRF_B_OBJ.eLon, NCRF_B_OBJ.nLat).transform(epsg4326, epsg900913);
	map.ncrfSize = new OpenLayers.Size(NCRF_B_OBJ.wSize, NCRF_B_OBJ.hSize);

	map.ncrfLayer = new OpenLayers.Layer.Image(
		'NowcastRainfall',
		'',
		map.ncrfBounds,
		map.ncrfSize,
		{
			'isBaseLayer': false,
			'alwaysInRange': true,
			opacity: 0.5
		}
	);
	map.addLayer(map.ncrfLayer);

	// boundary indicator
	map.ncrfBorder = new OpenLayers.Layer.Boxes("NcrfBorder");
	map.ncrfBorder.addMarker(new OpenLayers.Marker.Box(map.ncrfBounds, "#666666", 2));
	map.addLayer(map.ncrfBorder);

	// nowcast: lightning
	map.nclnBounds = new OpenLayers.Bounds(NCLN_B_OBJ.wLon, NCLN_B_OBJ.sLat, NCLN_B_OBJ.eLon, NCLN_B_OBJ.nLat).transform(epsg4326, epsg900913);
	map.nclnSize = new OpenLayers.Size(NCLN_B_OBJ.wSize, NCLN_B_OBJ.hSize);

	map.nclnLayer = new OpenLayers.Layer.Image(
		'NowcastLightning',
		'',
		map.nclnBounds,
		map.nclnSize,
		{
			'isBaseLayer': false,
			'alwaysInRange': true,
			opacity: 0.5
		}
	);
	map.addLayer(map.nclnLayer);

	// boundary indicator
	map.nclnBorder = new OpenLayers.Layer.Boxes("NclnBorder");
	map.nclnBorder.addMarker(new OpenLayers.Marker.Box(map.nclnBounds, "#666666", 2));
	map.addLayer(map.nclnBorder);

	// GRID boundary indicator
	map.gridBounds = new OpenLayers.Bounds(GRID_B_OBJ.wLon, GRID_B_OBJ.sLat, GRID_B_OBJ.eLon, GRID_B_OBJ.nLat).transform(epsg4326, epsg900913);
	map.gridBorder = new OpenLayers.Layer.Boxes("GridBorder");
	map.gridBorder.addMarker(new OpenLayers.Marker.Box(map.gridBounds, "#000000", 2));
	map.addLayer(map.gridBorder);

	// Geo location marker (if applicable)
	map.geoMarker = new OpenLayers.Layer.Markers( "Markers" );
	map.addLayer(map.geoMarker);

    var mrSelFeatureOption = {
        // also listen to mouse over and out event
        hover: true,
        overFeature: function (evt) {
			map.mrHoverLayer.destroyFeatures();

            // if have tooltip, display the tooltip
            if (evt.style.tooltip) {
                // remove other tooltip
                removeTooltip();
                var lonlat = new OpenLayers.LonLat(
                    evt.geometry.x,
                    evt.geometry.y
                );
                var html = evt.style.tooltip;
				var px = map.getPixelFromLonLat(lonlat);

				if (!isMsie) {
					px.y += 8;
				}
				isStnTooptipOn = true;
				if (isMobile || isWidget || isTablet) return;
				$('body').append('<div class="map-stn-tooltip">'+html+'</div>');
				$('.map-stn-tooltip').css('top', px.y);
				$('.map-stn-tooltip').css('left', px.x - $('.map-stn-tooltip').width()/2);
            }
        },
        outFeature: function (evt) {
            removeTooltip();
        },
        clickFeature: function (evt) {
			isStationClicked = true;

			removeTooltip();

			$("#tsDialog").hide();

			currentDayIndex = 0;//currentDayIndex = TS_OVERVIEW_ID;

			if (!isMoving && evt.style.stncode && evt.style.tooltip) {
				tsShow(evt.style.stncode, evt.style.tooltip, MODE_HOURLY);
			}
        }
    };
    map.mrLayer.featureCtrl = new OpenLayers.Control.DragFeature(map.mrLayer, mrSelFeatureOption);
	map.mrLayer.featureCtrl.handlers.feature.stopDown = false;
    map.addControl(map.mrLayer.featureCtrl);
    map.mrLayer.featureCtrl.activate();

	var ctmControl = new OpenLayers.Control.ListenToClick();
	map.addControl(ctmControl);
	ctmControl.activate();

	// show mrLayer by default
	setShowLayer(map.mrLayer, true);
	setShowLayer(map.ncrfLayer, false);
	setShowLayer(map.nclnLayer, false);
	setShowLayer(map.ncrfBorder, false);
	setShowLayer(map.nclnBorder, false);

	function getLocationFail(error) {
		/*switch(error.code) {
        case error.PERMISSION_DENIED:
            console.log("User denied the request for Geolocation.");
            break;
        case error.POSITION_UNAVAILABLE:
            console.log("Location information is unavailable.");
            break;
        case error.TIMEOUT:
            console.log("The request to get user location timed out.");
            break;
        case error.UNKNOWN_ERROR:
            console.log("An unknown error occurred.");
            break;
		}*/
	}

	function getLocationSuccess(position) {
		/*var geoLoc = new OpenLayers.LonLat(position.coords.longitude, position.coords.latitude).transform(epsg4326, epsg900913);
		var size = new OpenLayers.Size(25,25);
		var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
		var icon = new OpenLayers.Icon(MAP_TARGET_IMG,size,offset);
		map.geoMarker.clearMarkers();
		map.geoMarker.addMarker(new OpenLayers.Marker(geoLoc, icon));
		map.geoMarker.setZIndex(999);*/
	}

	// geo location
	if (isGeoEnabled && navigator.geolocation) {
		// http://www.w3schools.com/html/html5_geolocation.asp
		/*var timeoutVal = 10 * 1000 * 1000;
		navigator.geolocation.watchPosition(
			getLocationSuccess,
			getLocationFail,
			{ enableHighAccuracy: true, timeout: timeoutVal, maximumAge: 0 }
		);*/
		//navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationFail, {timeout: 5000});
	}

	mouseMove = function(event) {
		var boundObj = null;

		if (currentDataMode == MODE_NOWCAST_RF) {
			boundObj = NCRF_B_OBJ;
		} else if (currentDataMode == MODE_NOWCAST_LN) {
			boundObj = NCLN_B_OBJ;
		} else {
			boundObj = GRID_B_OBJ;
		}

		var gridBoundary = new OpenLayers.Bounds(boundObj.wLon, boundObj.sLat, boundObj.eLon, boundObj.nLat);

		var currentMouseCursorType = $("#map").css("cursor");
		var position = map.getLonLatFromPixel(event.xy).transform(epsg900913, epsg4326);
		if (gridBoundary.containsLonLat(position, {
				inclusive: false
			})) {

			if (currentMouseCursorType != selectedMouseCursorType) {
				$("#map").css("cursor", selectedMouseCursorType);
			}
			if (isMobile || isWidget || isTablet) return;

			if ((currentDataMode == MODE_NOWCAST_RF || currentDataMode == MODE_NOWCAST_LN) || (!isStnTooptipOn && currentGrid.getCurrentGridSuccess(position))) {
				removeTooltip();
				if (currentDataMode == MODE_HOURLY || currentDataMode == MODE_DAILY || currentDataMode == MODE_POP || currentDataMode == MODE_WX) {
					map.mrHoverLayer.destroyFeatures();
					map.mrHoverLayer.addFeatures(currentGrid.cell);
				} else {
					$('#map').append('<div id="mapHover" class="grid-point-tooltip" style="display: none"></div>');

					var toolTipContent = '';
					if (currentDataMode == MODE_NOWCAST_RF || currentDataMode == MODE_NOWCAST_LN) {
						toolTipContent = parseFloat(Math.round(position.lat * 100) / 100).toFixed(2) + ", " + parseFloat(Math.round(position.lon * 100) / 100).toFixed(2);
					} else {
						toolTipContent = currentGrid.latVal + ", " + currentGrid.lonVal;
					}
					$('.grid-point-tooltip').html(toolTipContent);

					// some web browsers may not detect variables like "event.x" "event.y"
					var thisX = (event.x ? event.x : event.xy.x);
					var thisY = (event.y ? event.y : event.xy.y);
					var hoverTop = thisY - parseInt($('.title-bar').css('height'), 10) - parseInt($('.grid-point-tooltip').css('height'), 10) - 30;
					var hoverLeft = thisX - parseInt($('.grid-point-tooltip').css('width'), 10)/2;
					$('.grid-point-tooltip').css('display','block');
					$('.grid-point-tooltip').css('top',hoverTop+'px');
					$('.grid-point-tooltip').css('left',hoverLeft+'px');

					$('.grid-point-tooltip').mouseover(function() {
						removeTooltip();
					});
				}
			} else {

			}
		} else {
			map.mrHoverLayer.destroyFeatures();
			$('.grid-point-tooltip').css('display','none');
			if (currentMouseCursorType != defaultMouseCursorType) {
				$("#map").css("cursor", defaultMouseCursorType);
			}
		}
	};
	map.events.register("mousemove", map, mouseMove);

	$("#map").mouseout(function() {
		removeTooltip();
	});

	changeZoomCenter();
	changeZoomRange();

	// data init
	if (isWidget) {
		initDataGrp(currentDataMode);
	} else {
		initDataGrp(MODE_ALL);
	}

	checkForGoogleMapError = setInterval(function(){
		if ($('.gm-err-container').length > 0) {
			$('.olForeignContainer').remove();
			waitGMapFail = 0;
			initMap();
		}
	}, 500);

	setTimeout(function() {
		clearInterval(checkForGoogleMapError);
	}, 5*60*1000);

	/*setTimeout(function() {
		if ($('.gm-err-container').length > 0) {
			$('.olForeignContainer').remove();
			try {
				failbackToOSM();
			} catch (e) {
				failbackToOSM();
			}
		}
	}, 5000);

	setTimeout(function() {
		if ($('.gm-err-container').length > 0) {
			$('.olForeignContainer').remove();
			waitGMapFail = 0;
			initMap();
		}
	}, 10000);

	setTimeout(function() {
		if ($('.gm-err-container').length > 0) {
			$('.olForeignContainer').remove();
			waitGMapFail = 0;
			initMap();
		}
	}, 20000);*/
}

function changeZoomRange() {
	var thisZoomObj = getCurrentZoomObj();
	map.minZoomLevels = thisZoomObj.minZoom;
	map.maxZoomLevels = thisZoomObj.maxZoom;
	map.zoomTo(thisZoomObj.currentZoom);
}

function changeZoomCenter() {
	var thisZoomObj = getCurrentZoomObj();
	try {
		firstCenter = new OpenLayers.LonLat(thisZoomObj.centerLon, thisZoomObj.centerLat - (isMobile ? thisZoomObj.mobileLatTune : 0)).transform(epsg4326, epsg900913);
	} catch (e) {

	}
}

function setShowLayer(layer, isShow) {
	if (!layer) return;
	layer.setVisibility(isShow);
	layer.isLockedLayer = !isShow;
}

function mapEvent(event) {
    if (event.type == "moveend") {

    } else if (event.type == "zoomend") {
        getCurrentZoomObj().currentZoom = map.getZoom();
    } else if (event.type == "mouseover") {

	} else if (event.type == "mouseout") {
	}
}

function removeTooltip() {
	$('.map-stn-tooltip').remove();
	$('.grid-point-tooltip').remove();
	isStnTooptipOn = false;
}

function getLabelFeature(stnCode, thisArray, thisZoomObj, lat, lon, ele) {
	var value = getElementValue(ele, thisArray, false);

	var labelDisplay = DUMMY_TXT;
	if (value == null) {
		labelDisplay = '';
	} else {
		labelDisplay = Math.round(parseFloat(value)).toFixed(0);
		if (labelDisplay == DUMMY_VALUE) labelDisplay = DUMMY_TXT;
	}
	var latAdjusted = lat;
    var attribute; // dummy
    var style = {
		stncode: stnCode,
        tooltip: getLocale(stnCode),
		ele: ele,
        fontFamily: "Arial",
        fontSize: thisZoomObj.getFontSize(), //(thisZoomObj.isGreatZoom() ? "40px" : "25px"),
        fontWeight: (isMobile ? 100 : 600),
		fontColor: OCF_ELE[ele].eleColor,
        labelOutlineWidth: 5,
		cursor: 'pointer',
		pointRadius: (ele == "mit" ? 0 : 28),
		fillOpacity: 0,
		strokeOpacity: 0,
		label: labelDisplay,
        labelOutlineColor: "#ffffff"
    };

    // different handling for elements
    if (ele == "tt") {
        //style.label += getLocale("unit_" + ele);
    } else if (ele == "mat" || ele == "mit") {
		var tuneLat = thisZoomObj.getMaxTempTuneLat();
		latAdjusted = (ele == "mat" ? lat + tuneLat : lat - tuneLat);
	} else if (ele == "rh") {
        //style.label += getLocale("unit_" + ele);
    } else if (ele == "ws") {
        // make some adjustments for wind speed labels to fit in the wind dial icon
        style.fontSize = (thisZoomObj.isGreatZoom() ? "20px" : "15px");
		if (isWidthLessThan(500)) style.fontSize = "12px";
        style.labelOutlineWidth = 0;
		delete style.pointRadius;
	} else if (ele == 'cr') {
		style.label = (value == DUMMY_VALUE ? DUMMY_TXT : value);
	} else if (ele == "wx") {
		var thisIcon = new WxIcon(value);
		if (value == null) {
			style.label = '';
		} else if (value == DUMMY_VALUE) {
			style.label = DUMMY_TXT;
		} else {
			style.label = null;
			style.externalGraphic = thisIcon.getWxIconUrl(false);
			style.graphicWidth = (thisZoomObj.isGreatZoom() ? 80 : 50);
			if (isWidthLessThan(500)) style.graphicWidth = 40;
			delete style.pointRadius;
			delete style.fillOpacity;
			delete style.strokeOpacity;
		}
	} else if (ele == "wd") {
        // wind direction shows wind dial images instead of digits
        style.label = null;
		if (value != null) {
			style.externalGraphic = WEB_IMG_PATH + 'wd-' + getWindDirString(value) + '.png';
			style.graphicWidth = (thisZoomObj.isGreatZoom() ? 80 : 60);
			if (isWidthLessThan(500)) style.graphicWidth = 40;
		}
		delete style.pointRadius;
		delete style.fillOpacity;
		delete style.strokeOpacity;
	}

	// fine tuning for labels on IE
	if (isMsie) {
		if (ele == "tt" || ele == "rh") {
			lat -= 0.005;
		} else if (ele == "ws") {
			//lat -= 0.0035;
		}
	}

    var geometry = new OpenLayers.Geometry.Point(lon, latAdjusted).transform(epsg4326, epsg900913);
    return new OpenLayers.Feature.Vector(geometry.clone(), attribute, style);
}

function getCurrentZoomObj() {
	if (currentDataMode == -999) currentDataMode = 0;
	return ZOOM_ELE[currentDataMode];
}

function closeBgAdjust(isScroll) {
	var top = dialogTop + 15;
	var right = dialogTop + (isScroll ? 30 : 15);
	$('.close-bg-desk').css('right', right + 'px');
	$('.close-bg-desk').css('top', top + 'px');
	$('.close-bg-mob').css('right', '10px');
	$('.close-bg-mob').css('top', '20px');
}

function setAllHomeZoom() {
	var isZoomInNeeded = (currentHeight < 800 || currentWidth < 800);
	for (var z in ZOOM_ELE) {
		if ((z == MODE_NOWCAST_RF || z == MODE_NOWCAST_LN) && (isMobile || isWidget)) {
			isZoomInNeeded = true;
		}
		ZOOM_ELE[z].setHomeZoom(isZoomInNeeded ? ZOOM_ELE[z].minZoom : ZOOM_ELE[z].rawHomeZoom);
	}
}

function tuneMapSize() {
	currentHeight = $(window).height();
	currentWidth = $(window).width();

    // adjust map dimension according to browser window size
    $('div#map').css("height", currentHeight - mapElseHeight);

	$('.all-dialog').each(function(index) {
		$(this).css("height", currentHeight - dialogTop - dialogBottom);
		if (!isMobile) {
			$(this).css('width', currentWidth - dialogTop*2 + 'px');
			$(this).css('left', dialogTop + 'px');
		}
	});

	tsAdjustDialogHeight();

	$('#hpDialog').css("left", (currentWidth - $('#hpDialog').width())/2 + "px");

	// make sure all station values are seen without dragging
	setAllHomeZoom();

	if (isMakeJqTitle) {
		$('#overviewMap').css('width',$('#tsDialog').width()+'px');
	}

	renderSlider();
}

function aniGetCurrentHour() {
    return parseInt($("#aniSlider").slider("option", "value"), 10);
}

function aniGetTimeStep() {
    return parseInt($("#aniSlider").slider("option", "step"), 10);
}

function aniGetEle() {
	try{
		currentElement = $('.ele-btn-toggled').first().attr('id').substring(6);
	} catch (e) {
        console.log(e);
		setToggleEleBtn('tt', false);
		currentElement = 'tt';
    }

	isChangeMode = (currentDataMode != OCF_ELE[currentElement].eleMode);

	currentDataMode = OCF_ELE[currentElement].eleMode;

	// after setting the new data mode, change zoom if needed
	//console.log(isChangeMode + " " + currentDataMode + " " + getCurrentZoomObj().currentZoom);
	if(isChangeMode) {
		changeZoomCenter();
		changeZoomRange();
		clickAButton("#mapZoomHome");
	}

	$("#aniUnit").css("max-width", OCF_ELE[currentElement].legendMaxWidth+"px");
}

function aniTriggerFromSlide(event, ui) {
	aniSetLabel(ui.value);
}

function aniUpdateLabel() {
	var prevElement = currentElement;

	// set current element and its corresponding data mode
	// after this line, prevElement != currentElement
	aniGetEle();

	var hh = aniGetCurrentHour();

	try {
		if (isWidget || isRefresh || isChangeMode || hh >= dataGrp[currentDataMode].data.length) {
			// switch layer
			if (currentDataMode == MODE_HOURLY || currentDataMode == MODE_DAILY || currentDataMode == MODE_POP || currentDataMode == MODE_WX) {
				setShowLayer(map.mrLayer, true);
				setShowLayer(map.mrHoverLayer, true);
				setShowLayer(lineLayer, false);
				setShowLayer(map.ncrfLayer, false);
				setShowLayer(map.ncrfBorder, false);
				setShowLayer(map.nclnLayer, false);
				setShowLayer(map.nclnBorder, false);
				setShowLayer(map.gridBorder, true);

				$("input#toggle").attr("disabled", false);
				$("input#toggle + label").removeClass('tgle-disabled');
			} else if (currentDataMode == MODE_GRID_HOURLY) {
				setShowLayer(map.mrLayer, false);
				setShowLayer(map.mrHoverLayer, false);
				setShowLayer(lineLayer, true);
				setShowLayer(map.ncrfLayer, false);
				setShowLayer(map.ncrfBorder, false);
				setShowLayer(map.nclnLayer, false);
				setShowLayer(map.nclnBorder, false);
				setShowLayer(map.gridBorder, false);

				$("input#toggle").attr("disabled", false);
				$("input#toggle + label").removeClass('tgle-disabled');
			} else if (currentDataMode == MODE_NOWCAST_RF || currentDataMode == MODE_NOWCAST_LN) {
				setShowLayer(map.mrLayer, false);
				setShowLayer(map.mrHoverLayer, false);
				setShowLayer(lineLayer, false);
				setShowLayer(map.ncrfLayer, currentDataMode == MODE_NOWCAST_RF || (!isNcrfPreloaded && currentDataMode == MODE_NOWCAST_LN));
				setShowLayer(map.ncrfBorder, currentDataMode == MODE_NOWCAST_RF);
				setShowLayer(map.nclnLayer, currentDataMode == MODE_NOWCAST_LN);
				setShowLayer(map.nclnBorder, currentDataMode == MODE_NOWCAST_LN);
				setShowLayer(map.gridBorder, false);

				$("input#toggle").attr("disabled", true);
				$("input#toggle + label").addClass('tgle-disabled');
			}

			// determine which time the next element should display
			//hh = 0;
			var desiredTime = "";
			var yesNo = false;
			var isAnimateNotNeeded = false;
			var hideDir = "down";
			var showDir = "up";
			if (!isValueChangedByUser && prevPrevTime && prevPrevTime != "") {
				desiredTime = prevPrevTime;
			}

			if (!isWidget && prevElement && prevElement != "") {
				var prevMode = OCF_ELE[prevElement].eleMode;
				var prevLength = dataGrp[prevMode].data[0].vtime.length;
				var nowLength = dataGrp[currentDataMode].data[0].vtime.length;

				var prevTime = dataGrp[prevMode].data[hh].vtime;
				// console.log(prevMode + " to " + currentDataMode + " | " + prevTime + " | " + prevLength + " vs " + nowLength);
				if (nowLength < prevLength) {
					hideDir = "left";
					showDir = "right";
				} else if (nowLength > prevLength) {
					// append zeros to match the new forecast time
					while(prevTime.length < nowLength) {
						prevTime += "00";
					}
					hideDir = "right";
					showDir = "left";
				}

				if (desiredTime == "") {
					desiredTime = prevTime;
				}
				prevPrevTime = prevTime;

				// check if animation needed
				if (
					(prevMode == MODE_HOURLY && currentDataMode == MODE_DAILY) || (prevMode == MODE_DAILY && currentDataMode == MODE_HOURLY)
						|| (prevMode == MODE_HOURLY && currentDataMode == MODE_WX) || (prevMode == MODE_WX && currentDataMode == MODE_HOURLY)
						|| (prevMode == MODE_WX && currentDataMode == MODE_DAILY) || (prevMode == MODE_DAILY && currentDataMode == MODE_WX)
						|| (prevMode == MODE_POP && currentDataMode == MODE_HOURLY) || (prevMode == MODE_HOURLY && currentDataMode == MODE_POP)
						|| (prevMode == MODE_POP && currentDataMode == MODE_DAILY) || (prevMode == MODE_DAILY && currentDataMode == MODE_POP)
						|| (prevMode == MODE_POP && currentDataMode == MODE_WX) || (prevMode == MODE_WX && currentDataMode == MODE_POP)
						|| (prevMode == MODE_NOWCAST_RF && currentDataMode == MODE_NOWCAST_LN) || (prevMode == MODE_NOWCAST_LN && currentDataMode == MODE_NOWCAST_RF)
				) {
					isAnimateNotNeeded = true;
				}
			} else {
				yesNo = true;
				isAnimateNotNeeded = true;
			}

			hh = getIndexFromValidTimeList(desiredTime);

			if (hh == DUMMY_VALUE) {
				// failed to set by previous element
				// use current time
				var dateObj = new DateExt(new Date(parseInt(currentTimeStamp, 10)));
				dateObj.tuneTimezone();
				desiredTime = dateObj.getRawString(12);
				hh = getIndexFromValidTimeList(desiredTime);

				if (hh == DUMMY_VALUE) {
					// failed to get by current time
					// set first index
					hh = 0;
				}
			}

			$("#aniSlider").slider("option", "value", hh);
			if (isMobile || isAnimateNotNeeded) {
				renderSlider();
			} else {
				renderSliderAnimate(300, hideDir, showDir);
			}

			setAutoUpdate();
		}

	} catch(e) {
		//console.log("[CAUGHT] " + e);
	}

	aniSetLabel(hh);

	isValueChangedByUser = yesNo;
}

function getIndexFromValidTimeList(validTime) {
	if (!validTime) {
		return DUMMY_VALUE;
	}
	var trimEndIndex = 12;
	if (currentDataMode == MODE_HOURLY || currentDataMode == MODE_GRID_HOURLY || currentDataMode == MODE_WX) {
		trimEndIndex = 10;
	} else if (currentDataMode == MODE_DAILY || currentDataMode == MODE_POP) {
		trimEndIndex = 8;
	}
	var validTimeTrim = validTime.substring(0, trimEndIndex);
	var dataList = dataGrp[currentDataMode].data;
	var ans = DUMMY_VALUE;
	for (var i = 0; i < dataList.length; ++i) {
		if (validTimeTrim <= dataList[i].vtime) {
			ans = i;
			break;
		}
	}
	return ans;
}

// change the look and feel of slider
// used when data mode switch occurs
function renderSliderAnimate(animateTime, hideDir, showDir) {
	//console.log($('.ani-slider-border').css('position') + " " + $('.ani-slider-border').css('left') + " " + $('.ani-slider-border').css('right'));

	$('.ui-slider-handle').hide();
	$('.ani-slider-border').hide({
		duration: animateTime,
		effect: "blind",
		direction: hideDir,
		complete: function () {
			//$("#aniSliderMark").hide();
			renderSlider();

			$('.ani-slider-border').show({
				duration: animateTime,
				effect: "blind",
				direction: showDir,
				complete: function () {
					//$("#aniSliderMark").show();
					$('.ui-slider-handle').show();
				}
			});
		}
	});
}

function renderSlider() {
	setSlider("", 0);

	if (!dataGrp[currentDataMode] || !dataGrp[currentDataMode].loaded) return;

	var sliderMarks = dataGrp[currentDataMode].sliderMarkStr;
	var sliderMax = dataGrp[currentDataMode].sliderMax;
	var dateValue;
	var dowValue;
	var markPercentage;
	var sliderHtml = "";

	if (!sliderMarks) return;
	if (!sliderMax) return;

	for (var i = 0 ; i < sliderMarks.length; ++i) {
		var dateObj = new DateExt(str2Date(sliderMarks[i].date));
		var dateLabel = dateObj.getSliderDateLabel();

		if (currentDataMode == MODE_HOURLY || currentDataMode == MODE_GRID_HOURLY || currentDataMode == MODE_WX) {
			markPercentage = (sliderMarks[i].index/(sliderMax+1)) * 100;

			// no tick marks on marginal position on the slider
			if (sliderMarks[i].index > 0 && sliderMarks[i].index < sliderMax) {
				sliderHtml += '<span class="ani-slider-tick ani-slider-tick-stroke" style="width: 1.2em; left: ' + markPercentage + '%;">|</span>';
			}

			// limit the position of date marks (avoid the situation when it is written out of the screen)
			var datePercentage = Math.min(95, markPercentage + 100/sliderMarks.length/2);
			sliderHtml += '<span class="ani-slider-tick" style="left: ' + datePercentage + '%;"><span class="ani-slider-tick-time">' + dateLabel + '</span></span>';
		} else if (currentDataMode == MODE_DAILY || currentDataMode == MODE_POP) {
			markPercentage = ((sliderMarks[i].index)/(sliderMax)) * 100;

			// limit the position of date marks (avoid the situation when it is written out of the screen)
			sliderHtml += '<span class="ani-slider-tick" style="left: ' + markPercentage + '%;"><span class="ani-slider-tick-time">' + dateLabel + '</span></span>';
		} else if (currentDataMode == MODE_NOWCAST_RF || currentDataMode == MODE_NOWCAST_LN) {
			markPercentage = ((sliderMarks[i].index)/(sliderMax)) * 100;

			var hhmmValue = dateObj.getSliderTimeLabel();

			// limit the position of date marks (avoid the situation when it is written out of the screen)
			if (i % 2 == 0) {
				sliderHtml += '<span class="ani-slider-tick" style="left: ' + markPercentage + '%;"><span class="ani-slider-tick-time">' + hhmmValue + '</span></span>';
			}
		}
	}

	setSlider(sliderHtml,sliderMax);

	if (isWidget) {
		$('.ani-slider-tick').addClass('ani-slider-tick-wid');
	}
}

function setSlider(markerStr, max) {
	$("#aniSliderMark").html(markerStr);
	$('#aniSlider').slider("option", "max", max);
	$('#aniSlider').draggable();
}

function aniShiftHour(val) {
    newHour = aniGetCurrentHour() + val;
    $("#aniSlider").slider("option", "value", newHour);
}

function aniResetHour() {
    $("#aniSlider").slider("option", "value", 0);
}

function aniAnimateLabels() {
    if (!isAni) return;
	var isPauseLoop = false;

	var currentMaxFcst = $('#aniSlider').slider("option", "max");
	if (aniGetCurrentHour() == currentMaxFcst-1) {
		// wait longer at the end of the loop before restart again.
		isPauseLoop = true;
	}

    if (aniGetCurrentHour() >= currentMaxFcst) {
        aniResetHour();
    } else {
        //$("#aniSlider").slider("option", "value", aniGetCurrentHour() + aniGetTimeStep());
        aniShiftHour(aniGetTimeStep());
    }

    aniTimeout = setTimeout(function () {
        aniAnimateLabels()
    }, (isPauseLoop ? 3600 : 900));
}

function aniStartAnimate() {
    isAni = true;
    aniTimeout = 0;
    aniAnimateLabels();
}

function aniStopAnimate() {
    isAni = false;
	clearTimeout(aniTimeout);
}

function genNcUrlAppend() {
	var d = new Date();
	var urlAppend = '' + d.getHours() + d.getMinutes();
	return urlAppend;
}

function aniSetLabel(hh) {

	if (currentDataMode == MODE_GRID_HOURLY) {
		currentFcstDateList = fcstDateList[currentDataMode];
        redrawGrid(hh);
		return;
    }

	try { map.mrLayer.destroyFeatures(); } catch (e) {}

    var labelFeatures = [];

	if (!dataGrp[currentDataMode] || !dataGrp[currentDataMode].loaded) {
		$("#aniTimeLabel").html(getLocale("ts_error"));
		return;
	}

	var data = dataGrp[currentDataMode].data[hh];

	//var displayTime = "";

	if (currentElement == "ncrf") {
		map.ncrfLayer.setUrl(NCIMG_PATH+data.values[0]+'?'+genNcUrlAppend());

		// image object of rainfall
		if (!isNcrfPreloaded) {
			var imgObj = getNcLayerImageObj();
			imgObj.load(createNcrfCanvas);
		}

		redrawLegend();
	} else if (currentElement == "ncln") {
		if (!isNcrfPreloaded) {
			// load a blank image on rainfall layer for initialization
			// otherwise there will be malfunction when user triggers the time series in lightning view the first time
			// function "aniUpdateLabel" has corresponding handling for this
			map.ncrfLayer.setUrl(NCRF_BLANK_IMG);
			createNcrfCanvas();
		}

		map.nclnLayer.setUrl(NCIMG_PATH+data.values[0]+'?'+genNcUrlAppend());
		//map.nclnLayer.setUrl(NCIMG_PATH+'lightningNowcast_201608210212_10.png');

		setUnitBasic(false);
	} else {
		// write element values on map
		var thisZoomObj = getCurrentZoomObj();
		for (var i = 0; i < OCF_STN_NAMES.length; ++i) {
			try {
				var stnObj = OCF_STN_OBJ[OCF_STN_NAMES[i]];
				if (!stnObj) continue;

				var stnCode = stnObj.StationCode;
				var lat = stnObj.Latitude;
				var lon = stnObj.Longitude;
				if (currentElement == "mmt") {
					var dArray = stnObj.DailyForecast[hh];
					labelFeatures.push(getLabelFeature(stnCode, dArray, thisZoomObj, lat, lon, "mit"));
					labelFeatures.push(getLabelFeature(stnCode, dArray, thisZoomObj, lat, lon, "mat"));
				} else if (currentElement == "cr") {
					var dArray = stnObj.DailyForecast[hh];
					labelFeatures.push(getLabelFeature(stnCode, dArray, thisZoomObj, lat, lon, currentElement));
				} else if (currentElement == "wx") {
					var hArray = null;
					for (var hwf = 0; hwf < stnObj.HourlyWeatherForecast.length; ++hwf) {
						if (parseInt(data.vtime, 10) == parseInt(stnObj.HourlyWeatherForecast[hwf].ForecastHour, 10)) {
							hArray = stnObj.HourlyWeatherForecast[hwf];
							break;
						}
					}
					if (hArray){
						labelFeatures.push(getLabelFeature(stnCode, hArray, thisZoomObj, lat, lon, currentElement));
					}
				} else {
					var hArray = stnObj.HourlyWeatherForecast[hh];
					if (currentElement == "wds") {
						labelFeatures.push(getLabelFeature(stnCode, hArray, thisZoomObj, lat, lon, "ws"));
						labelFeatures.push(getLabelFeature(stnCode, hArray, thisZoomObj, lat, lon, "wd"));
					} else if (currentElement == "wx" && !hArray.ForecastWeather) {
						continue;
					} else {
						labelFeatures.push(getLabelFeature(stnCode, hArray, thisZoomObj, lat, lon, currentElement));
					}
				}
			} catch (e) {
				console.log(OCF_STN_NAMES[i] + " ERROR "  + e);
				continue;
			}
		}

		// write unit label
		setUnitBasic(currentElement == "wx" || currentElement == 'cr' ? false : true);
	}

	// write forecast time label
	$("#aniTimeLabel").html('<span class="ani-fcst-label">' + getLocale("fcst") + '</span> ' + displayCurrentFcstTime(data.vtime, !isMobile || isWidget));

	if (currentDataMode == MODE_DAILY && currentElement == "mmt" && hh == 0) {
		$("#aniTimeStatus").show();
		$('.ani-ctrl-desk .ani-fcst-label').hide();
	} else {
		$("#aniTimeStatus").hide();
		$('.ani-ctrl-desk .ani-fcst-label').show();
	}

	//SAMindex = currentFcstDateList.indexOf(data.vtime.substring(0,8));

    map.mrLayer.addFeatures(labelFeatures);

	isValueChangedByUser = true;
}

function setUnitBasic(isIncludeUnitString) {
	$('#aniUnit').html(getLocale(currentElement) + (isIncludeUnitString ? '<br/>' + getLocale("unit") + ": " + getLocale("unit_" + currentElement) : ''));
}

function redrawLegend() {
	setUnitBasic(true);

	var isSmallLegend = isHeightLessThan(680);
	if (currentElement == "gtt" || currentElement == "grh") {
		if (typeof legendList !== "undefined") {
			legendList.gtt = new LegendDrawer();
			legendList.gtt.newBoxSize(20, isSmallLegend ? 1 : 3);
			legendList.gtt.fontSize = isSmallLegend ? 12 : 14;
			legendList.gtt.drawColor(lgMap.tt, lgMap.ttLbl, 10);

			legendList.grh = new LegendDrawer();
			legendList.grh.newBoxSize(20, isSmallLegend ? 2 : 6);
			legendList.grh.fontSize = isSmallLegend ? 12 : 14;
			legendList.grh.drawColor(lgMap.rh, lgMap.rhLbl, isSmallLegend ? 20 : 10);

			$('#aniUnit').append('<br />');
			$('#aniUnit').append(legendList[currentElement].canvas);
		} else {
			$('#aniUnit').append('<br/><img src="' + WEB_IMG_PATH + OCF_ELE[currentElement].legendImage + '" />');
		}
	} else if (currentElement == "gwds") {
		if (typeof legendList !== "undefined") {
			legendList.gwds = new LegendDrawer();
			legendList.gwds.newBoxSize(isSmallLegend ? 10 : 20, isSmallLegend ? 15 : 40);
			legendList.gwds.fontSize = isSmallLegend ? 12 : 16;
			legendList.gwds.drawWind(lgMap.wds, lgMap.wdsLbl);

			$('#aniUnit').append('<br />');
			$('#aniUnit').append(legendList[currentElement].canvas);
		} else {
			$('#aniUnit').append('<br/><img src="' + WEB_IMG_PATH + OCF_ELE[currentElement].legendImage + '" ' + (isSmallLegend ? 'height="180px"' : 'height="260px"') + ' />');
		}
    } else if (currentElement == "ncrf") {
		if (typeof legendList !== "undefined") {
			legendList.ncrf = new LegendDrawer();
			legendList.ncrf.newBoxSize(20, isSmallLegend ? 15 : 30);
			legendList.ncrf.fontSize = isSmallLegend ? 12 : 14;
			legendList.ncrf.drawColor(lgMap.ncrf, lgMap.ncrfLbl, 0);

			$('#aniUnit').append('<br />');
			$('#aniUnit').append(legendList[currentElement].canvas);
		} else {
			$('#aniUnit').append('<br/><img src="' + WEB_IMG_PATH + OCF_ELE[currentElement].legendImage + '" />');
		}
	}
}

function unToggleAllEleBtn() {
	$(".ele-toggle").each(function(index) {
		$(this).removeClass('ele-btn-toggled');
		$(this).addClass('ele-btn-untoggled');
	});
}

function setToggleEleBtn(ele, isHidePanel) {
	removeTooltip();

	var btnObj = $('#eleBtn'+ele);

	if (btnObj.hasClass('ele-btn-toggled')) return;

	unToggleAllEleBtn();

	btnObj.removeClass('ele-btn-untoggled');
	btnObj.addClass('ele-btn-toggled');

	//bgHide();
	aniUpdateLabel();

	btnObj.blur();

	if (isMobile && isHidePanel) bgHide();
}

function clickGridToggle() {
	var newEle = "";
	if (currentDataMode == MODE_GRID_HOURLY) {
		$('#aniEleMr').show();
		$('#aniEleGm').hide();
		$('#aniEleGrp').addClass('ani-ele-grp-mr');
		$('#aniEleGrp').removeClass('ani-ele-grp-gm');

		if (currentElement == 'grh') {
			newEle = 'rh';
		} else if (currentElement == 'gwds') {
			newEle = 'wds';
		} else {
			newEle = 'tt';
		}
		setToggleEleBtn(newEle, false);

		setShowLayer(map.mrLayer, true);
		setShowLayer(map.mrHoverLayer, true);
		setShowLayer(lineLayer, false);
		setShowLayer(map.ncrfLayer, false);
		setShowLayer(map.ncrfBorder, false);
		setShowLayer(map.nclnLayer, false);
		setShowLayer(map.nclnBorder, false);

		$('input#toggle').prop('checked', false);
	} else {
		if (isFirstInitGrid) {
			bgHide();
			showProgress();
			loadAllGrid(function () {
				isFirstInitGrid = false;
				removeProgress();
				clickGridToggle();
			});
			return;
		}

		$('#aniEleMr').hide();
		$('#aniEleGm').show();
		$('#aniEleGrp').removeClass('ani-ele-grp-mr');
		$('#aniEleGrp').addClass('ani-ele-grp-gm');

		if (currentElement == 'rh') {
			newEle = 'grh';
		} else if (currentElement == 'wds') {
			newEle = 'gwds';
		} else {
			newEle = 'gtt';
		}
		setToggleEleBtn(newEle, false);

		setShowLayer(map.mrLayer, false);
		setShowLayer(map.mrHoverLayer, false);
		setShowLayer(lineLayer, true);
		setShowLayer(map.ncrfLayer, false);
		setShowLayer(map.ncrfBorder, false);
		setShowLayer(map.nclnLayer, false);
		setShowLayer(map.nclnBorder, false);

		$('input#toggle').prop('checked', true);
	}

	$("#aniTimeStatus").hide();
	if (isMobile) bgHide();
}

function prepareEleGrp() {
	var mrHtml = getLocale('elegrp_mr') + '<br />';
	for (var i = 0; i < ELE_MR_LS.length; ++i) {
		var btnId = "eleBtn" + ELE_MR_LS[i];
		mrHtml += '<button value="' + ELE_MR_LS[i] + '" onClick="setToggleEleBtn(\'' + ELE_MR_LS[i] + '\', true)" id="' + btnId + '" class="ele-toggle ' + (i==0?'ele-btn-toggled':'ele-btn-untoggled') + '" style="background-image: url(\'' + WEB_IMG_PATH + OCF_ELE[ELE_MR_LS[i]].iconImage + '\');"></button>';
		eleBtnList.push(btnId);
	}

	var ncHtml = getLocale('elegrp_nc') + '<br />';
	for (var i = 0; i < ELE_NC_LS.length; ++i) {
		var btnId = "eleBtn" + ELE_NC_LS[i];
		ncHtml += '<button value="' + ELE_NC_LS[i] + '" onClick="setToggleEleBtn(\'' + ELE_NC_LS[i] + '\', true)" id="' + btnId + '" class="ele-toggle ele-btn-untoggled" style="background-image: url(\'' + WEB_IMG_PATH + OCF_ELE[ELE_NC_LS[i]].iconImage + '\');"></button>';
		eleBtnList.push(btnId);
	}

	var gmHtml = getLocale('elegrp_mr') + '<br />';
	for (var i = 0; i < ELE_GM_LS.length; ++i) {
		var btnId = "eleBtn" + ELE_GM_LS[i];
		gmHtml += '<button value="' + ELE_GM_LS[i] + '" onClick="setToggleEleBtn(\'' + ELE_GM_LS[i] + '\', true)" id="' + btnId + '" class="ele-toggle ' + (i==999?'ele-btn-toggled':'ele-btn-untoggled') + '" style="background-image: url(\'' + WEB_IMG_PATH + OCF_ELE[ELE_GM_LS[i]].iconImage + '\');"></button>';
		eleBtnList.push(btnId);
	}

	var sgTgleHtml = '<input onClick="clickGridToggle()" type="checkbox" name="toggle" id="toggle"><label for="toggle"></label>';
	var eleBtnGrpHtml = '<div id="sgMode"></div><div id="aniEleNc"></div><div id="aniEleMr"></div><div id="aniEleGm"></div>';

	$('#map').append('');

	if (isMobile) {
		isSliderOn = false;
		$('.ani-slider-border').hide();

		$('#aniPrev').before('<button id="aniEleMenu">'+getLocale('pls_sel')+'</button> ');
		$("#aniEleMenu").button({
			text: isWbNotSupported,
			icons: {
				primary: "ui-icon-gear"
			}
		});

		var eleMenuHtml = '<div id="mobEleMenuPanel" class="all-dialog">';
		eleMenuHtml += eleBtnGrpHtml;
		eleMenuHtml += "</div>";

		$('body').append(eleMenuHtml);
		$('#sgMode').append('<span>' + getLocale('stn') + '</span> / <span>' + getLocale('grid') + '</span>');
		$('#sgMode').append(sgTgleHtml);
		$('#aniEleMr').append(mrHtml);
		$('#aniEleGm').append(gmHtml);
		$('#aniEleNc').append(ncHtml);

		$('#mobEleMenuPanel').hide();

		$('#aniEleNc').after("<br />");

		$('#aniEleGm').hide();

		//$('.ele-toggle').css('margin','3px');

		TouchClick("#aniEleMenu", function() {
			closeBgAdjust(false);
			bgShow("#mobEleMenuPanel");
		});

		// add a toggle to show/hide slider controls
		$('#aniNext').after(' <button id="aniSliderToggle">&nbsp;</button>');
		$("#aniSliderToggle").button({
			text: isWbNotSupported,
			icons: {
				primary: "ui-icon-triangle-1-n"
			}
		});
		TouchClick("#aniSliderToggle", function() {
			if (isSliderOn) {
				$('.ani-ctrl-mob').animate({height: '40px'}, {
					duration: 200,
					queue: true,
					complete: function() {
						$('.ani-unit-mob').css('bottom', '60px');
						$('.ani-unit-wid').css('bottom', '60px');
						$('.ani-slider-border').hide();
						isSliderOn = false;
					}
				});
				options = {
					icons: {
						primary: "ui-icon-triangle-1-n"
					}
				};
			} else {
				$('.ani-ctrl-mob').animate({height: '95px'}, {
					duration: 200,
					queue: true,
					complete: function() {
						$('.ani-unit-mob').css('bottom', '115px');
						$('.ani-unit-wid').css('bottom', '115px');
						$('.ani-slider-border').show();
						isSliderOn = true;
					}
				});
				options = {
					icons: {
						primary: "ui-icon-triangle-1-s"
					}
				};

			}
			$("#aniSliderToggle").button("option", options);
		});

		if (!isHeightLessThan(500)) {
			setTimeout(function() {clickAButton("#aniSliderToggle");}, 1000);
		}

		if (isWidget) {
			$("#aniEleMenu").hide();
		}
	} else {
		$('#aniEleGrp').append(eleBtnGrpHtml);
		$('#aniEleGrp').show();
		$('#aniEleGrp').addClass('ani-ele-grp-mr');

		$('#aniEleMr').append(mrHtml);
		$('#aniEleGm').append(gmHtml);
		$('#aniEleNc').append(ncHtml);
		$('#sgMode').append('<span class="sg-station-label">' + getLocale('stn') + '</span><span class="sg-grid-label">' + getLocale('grid') + '</span>');
		$('#sgMode').append(sgTgleHtml);

		$('#aniEleGm').hide();

		// tooltip on element icons
		if (!isTablet) {
			$('body').append('<div id="eleTooltip" class="ele-btn-tooltip" style="display:none"></div>');
			for (var i=0; i<eleBtnList.length; ++i) {
				$('#'+eleBtnList[i]).draggable();

				$('#'+eleBtnList[i]).mouseover(function(event) {
					removeTooltip();
					$('#eleTooltip').html(getLocale($(this).val()));
					var posY = event.pageY+30;
					var posX = event.pageX-20;
					$('#eleTooltip').css('top', posY+'px');
					$('#eleTooltip').css('left', posX+'px');
					$('#eleTooltip').show();
				});

				$('#'+eleBtnList[i]).mouseout(function(event) {
					$('#eleTooltip').hide();
					$('#eleTooltip').html('');
				});
			}
		}
	}
}

function afterLoad(isRunUpdate) {
	if (isRunUpdate) {
		isNcrfPreloaded = false;

		if (isFirstLoad) {
			clickAButton('#mapZoomHome');
		}
		isFirstLoad = false;

		$('#aniCtrl').show();
		aniUpdateLabel();
		renderSlider();

		removeProgress();

		isRefresh = false;

		clearTimeout(manualUpdateTimeout);
		manualUpdateTimeout = setTimeout(function () {
			$( "#mapRefresh" ).button("enable");
		}, 1000);

		tuneMapSize();
		clickAButton('#mapZoomHome');
	}
}

function removeProgress() {
	clearTimeout(progressBarTimeout);
	$('#mapBg').fadeOut("slow");
	$('#progressBar').fadeOut("fast");
}

function bgHide() {
	$('#popBg').fadeOut("slow");
	$('#closeBg').hide();
	$('#mobEleMenuPanel').fadeOut("fast");
	$('#tsDialog').fadeOut("fast");
	$('#hpDialog').fadeOut("fast");
}

function bgShow(obj, showEffect, afterShow, whenClosed) {
	if ($(obj).is(':visible')) return;

	// stop the animation (if any)
	if (isAni) {
		$("#aniStart").click();
	}

	if (!showEffect || isMobile) {
		showEffect = 'fade';
	}

	$('#hpDialog').hide();
	$('#mobEleMenuPanel').hide();
	$("#popBg").fadeIn("fast");

	$(obj).show({
		percent: 100,
		effect: showEffect,
		duration: 500,
		complete: function() {
			$(obj).scrollTop(0, 1);
			$(obj).scrollLeft(0, 1);

			if (afterShow) {
				afterShow();
			}

			$("#closeBg").fadeIn("fast");

			//getTimeStamp();
		}
	});

	TouchClick("#closeBg", function() {
		if (whenClosed) {
			whenClosed();
		}
        bgHide();
    });

}

function readyMain() {
	setLaunchData();
	setLaunchElement("");
	setAutoPlayback();
	setTsAddMask();
	//setIconStyle();
	preloadTimeStamp();

	$.ajaxSetup({cache:false});

	$(window).resize(function () {
		if (currentDataMode && (currentDataMode == MODE_GRID_HOURLY || currentDataMode == MODE_NOWCAST_RF)) redrawLegend();
        //resize just happened, pixels changed
        tuneMapSize();
		resizeCarousel();
    });
	//initArwfMap("AIzaSyAmwOsbTxItKoMJyQTLx6EdD6X1QUORs0c");
	initArwfMap(isInter ? "AIzaSyAmwOsbTxItKoMJyQTLx6EdD6X1QUORs0c" : "");

	setKeysCtrl();
}

function setAutoUpdate() {
	try {
		clearTimeout(autoUpdateTimeout);
		if (isWidget) return;
		autoUpdateTimeout = setTimeout(function () {
			clickAButton('#mapRefresh');
		}, 600000);
	} catch (e) {

	}
}

function showProgress() {
	$('#mapBg').fadeIn("fast");
	$( "#progressBar" ).progressbar({
		value: false
	});
	progressBarTimeout = setTimeout(function () {
		$( "#progressBar" ).fadeIn("fast");
	}, 500);
}

var isLaunchGrid = false;
function setLaunchElement(url_param) {
	if (url_param == "") url_param = getUrlParam("data");
	if (url_param && OCF_ELE[url_param]) {
		if (url_param.substring(0,1) == 'g') {
			isLaunchGrid = true;
			url_param = launchElement;
		}
	} else {
		url_param = launchElement;
	}

	currentDataMode = OCF_ELE[url_param].eleMode;

	setTimeout(function() {
		setToggleEleBtn(url_param, false);
		renderSlider();
		clickAButton('#mapZoomHome');
		$('#aniTimeLabel').css('display', 'inline');
		setSelectedTime();
	}, 500);
}

function setLaunchData() {
	if (isInter) return;
	var selectedRun = getUrlParam("selbt");
	var selectedTime = getUrlParam("selvt");
	if (selectedRun && selectedTime) {
		var subFolder = selectedRun+"/"+selectedTime;
		DAT_PATH = DATCUS_PATH+selectedRun.substring(0,4)+"/"+selectedRun.substring(0,6)+"/"+selectedRun.substring(0,8)+"/"+subFolder+"/";
		NCIMG_PATH = NCTXT_PATH+'prd/';
		$("#mapRefresh").hide();
		$("#mapHelp").hide();
		//$("#actualBtnGrp").hide();
		$(".lang-bar").hide();
		console.log("Customized Data");
	}
}

// select the desired time at web launch
function setSelectedTime() {
	var url_param = getUrlParam("seltime");
	if (url_param && !isNaN(url_param)) {
		var timeIndex = parseInt(url_param, 10);
		var sliderMax = parseInt($("#aniSlider").slider("option", "max"), 10);

		if (timeIndex < 0) timeIndex = 0;
		else if (timeIndex > sliderMax) timeIndex = sliderMax;

		// checking for EO mode
		// EO mode: data=mmt&seltime=1
		// after 5pm: select "tomorrow"
		// else: select "today"
		var dateObj = new DateExt(new Date(parseInt(currentTimeStamp, 10)));
		if (currentDataMode == MODE_DAILY && timeIndex == 1 && parseInt(dateObj.hh, 10) < 17) timeIndex = 0;

		$("#aniSlider").slider("option", "value", timeIndex);
	}
}

function setAutoPlayback() {
	setTimeout(function() {
		var url_param = getUrlParam("play");
		if (url_param && url_param == '1') {
			clickAButton('#aniStart');
		}
	}, 1500);
}

// dev only
/*function setIconStyle() {
	var url_param = getUrlParam("twoicons");
	if (url_param && url_param == '1') {
		isTwoIcon = true;
	}
}*/

function initDataGrp(mode){
	initConstructor();

	if (mode == MODE_ALL || mode == MODE_HOURLY) {
		determineFcstDates();
		var deferreds = getDeferredJsonActions(MODE_HOURLY, OCF_STN_NAMES);
		$.when.apply(null, deferreds).done(function() {
			initStruct(OCF_STN_OBJ["HKO"], MODE_HOURLY);
			if(!alertModelTime){
				alertModelTime = true;
				var modelTime = OCF_STN_OBJ["HKO"].ModelTime;
				var logString = "BaseTime (UTC) = " + OCF_STN_OBJ["HKO"].ModelTime+", Update Time (HKT) = "+ OCF_STN_OBJ["HKO"].LastModified;
				console.log(logString);
				if(getEnv() == "development"){
					$.notify.defaults({
						autoHideDelay: 2000,
						globalPosition: 'bottom right',
					});
					$.notify(logString, "info");
				}
			}
			if(currentDataMode != MODE_GRID_HOURLY) {
				//console.log("afterload stn");
				afterLoad(true);
				if (isLaunchGrid) {
					clickGridToggle();
				}
			}
        });
	}
	if (mode == MODE_ALL || mode == MODE_GRID_HOURLY) {
		determineFcstDates();
		var deferreds = getDeferredJsonActions(MODE_GRID_HOURLY, OCF_HK_GRID_NAMES);
		$.when.apply(null, deferreds).done(function() {
			initStruct(OCF_GRID_OBJ[OCF_HK_GRID_NAMES[0]], MODE_GRID_HOURLY);

			if(currentDataMode == MODE_GRID_HOURLY) {
				//loadAllGrid(function () {  });
				afterLoad(true);
			}
        });
	}
	if (mode == MODE_ALL || mode == MODE_NOWCAST_RF || mode == MODE_NOWCAST_LN) nModeRefreshData();
}

function determineFcstDates() {

}

function loadAllGrid(callBack) {
	var unloadedGrids = [];
	for (var i = 0; i < OCF_ALL_GRID_NAMES.length; ++i) {
		if (!OCF_GRID_OBJ[OCF_ALL_GRID_NAMES[i]]) {
			unloadedGrids.push(OCF_ALL_GRID_NAMES[i]);
		}
	}

	var deferreds = getDeferredJsonActions(MODE_GRID_HOURLY, unloadedGrids);
	$.when.apply(null, deferreds).done(callBack);
}

function initComponent() {
	checkPlatform();

	// +++++++++++ Progress Bar +++++++++++
	showProgress();

    // +++++++++++ Labels +++++++++++
    $(document).attr("title", getLocale("hkotitle") + " " + getLocale("htmltitle"));
    $("#aniPrev").text(getLocale("prev"));
    $("#aniStart").text(getLocale("play_pause"));
    $("#aniNext").text(getLocale("next"));
	$('#closeBg').text(getLocale("close"));
	// +++++++++++ Map buttons +++++++++++
    $('#map').prepend("<div id='mapBtnGrp'><button id='mapZoomIn'>"+getLocale("zoom_in")+"</button><button id='mapZoomHome'>"+getLocale("zoom_home")+"</button><button id='mapZoomOut'>"+getLocale("zoom_out")+"</button><button id='mapRefresh'>"+getLocale("refresh")+"</button><button id='mapHelp'>"+getLocale("help")+"</button></div>");
    $("#mapZoomHome").button({
        title: "",
        text: isWbNotSupported,
        icons: {
            primary: "ui-icon-home"
        }
    });
	TouchClick("#mapZoomHome", function() {
		try { map.setCenter(firstCenter, getCurrentZoomObj().homeZoom); } catch (e) {}
	});

    $("#mapZoomIn").button({
        text: isWbNotSupported,
        icons: {
            primary: "ui-icon-plus"
        }
    });
	TouchClick("#mapZoomIn", function() {
		map.zoomTo(map.getZoom() + 1);
	});
    $("#mapZoomOut").button({
        text: isWbNotSupported,
        icons: {
            primary: "ui-icon-minus"
        }
    });
	TouchClick("#mapZoomOut", function() {
		map.zoomTo(map.getZoom() - 1);
	});
	// refresh button
	$("#mapRefresh").button({
		text: isWbNotSupported,
		icons: {
			primary: "ui-icon-refresh"
		}
	});
	TouchClick("#mapRefresh", function() {
		$("#mapRefresh").button("disable");
		showProgress();
		isRefresh = true;
		clearTimeout(manualUpdateTimeout);
		manualUpdateTimeout = setTimeout(function () {
			if (currentDataMode == MODE_GRID_HOURLY) location.reload();
			isFirstInitGrid = true;
			dataGrp = [];
			fcstDateList = [];
			OCF_STN_OBJ = [];
			OCF_GRID_OBJ = [];
			NCLN_JSON_OBJ = [];
			NCLN_FCSTS = [];
			initDataGrp(MODE_ALL);
		}, 1000);
	});
	$("#mapRefresh").button("disable");

	// help button on map (only appears on mobile mode)
	$("#mapHelp").button({
		text: isWbNotSupported,
		icons: {
			primary: "ui-icon-help"
		}
	});
	TouchClick("#mapHelp", function() {
		bgShow("#hpDialog");
	});

    // +++++++++++ Animation loop slider +++++++++++
    $("#aniSlider").slider({
        range: "max",
        step: 1,
        min: 0,
        max: 50,
        value: 0,
        slide: function (event, ui) {
            aniTriggerFromSlide(event, ui);
        },
        change: function (event, ui) {
            aniTriggerFromSlide(event, ui);
        }
    });
	//$("#aniSlider").css("border-left", "none");

    // +++++++++++ Animation loop playback buttons +++++++++++
	$('#aniCtrl').addClass('do-not-touch');
    $("#aniPrev").button({
        text: isWbNotSupported,
        icons: {
            primary: "ui-icon-seek-prev"
        }
    });
	TouchClick("#aniPrev", function() {
		if (aniGetCurrentHour() <= parseInt($("#aniSlider").slider("option", "min"), 10)) return;
		aniShiftHour((-1) * aniGetTimeStep());
	});
    $("#aniStart").button({
        text: isWbNotSupported,
        icons: {
            primary: "ui-icon-play"
        }
    });
	TouchClick("#aniStart", function() {
		if (!isAni) {
			aniStartAnimate();
			options = {
				icons: {
					primary: "ui-icon-pause"
				}
			};
		} else {
			aniStopAnimate();
			options = {
				icons: {
					primary: "ui-icon-play"
				}
			};
		}
		$("#aniStart").button("option", options);
	});
    $("#aniNext").button({
        text: isWbNotSupported,
        icons: {
            primary: "ui-icon-seek-next"
        }
    });
	TouchClick("#aniNext", function() {
		if (aniGetCurrentHour() >= parseInt($("#aniSlider").slider("option", "max"), 10)) return;
		aniShiftHour(aniGetTimeStep());
	});

    $("#closeBg").button({
		title: getLocale("close"),
		text: isWbNotSupported,
		icons: {
            primary: "ui-icon-close"
        }
	}).hide();

	// +++++++++++ Help Dialog +++++++++++
	$('#hpTitle').html(getLocale("help"));

	// +++++++++++ Actual Weather Crosslink Button +++++++++++
	var helpBtnStr = '<a href="' + getHelpUrl() + '" class="hp-button" target="_blank">' + (isMobile ? '<button class="ext-btn">' : '') + getLocale('help') + (isMobile ? '</button>' : '') + '</a>';

	function initExtLinks() {
		var linkList = [];
		if (isMobile) linkList.push({name: getLocale('help'), url: getHelpUrl(), isExternal: true});
		linkList.push({name: getLocale('act_btn'), url: ACTUAL_WX_URL, isExternal: true});
		linkList.push({name: getLocale('actln_btn'), url: ACTUAL_LN_URL, isExternal: true});
		if (isMobile) linkList.push({name: getLocale('desktop_title'), url: 'index_'+getLocale('lang')+'.html?load=c', isExternal: false});

		var html = '';
		for (var i = 0; i < linkList.length; ++i) {
			if (!isMobile && i > 0) html += ' | ';
			if (isMobile) html += '<div>';
			html += '<a ' + (linkList[i].isExternal ? 'target="_blank"' : '') + ' href="' + linkList[i].url + '">';
			if (isMobile) html += '<button class="' + (linkList[i].isExternal ? 'ext-link-btn' : 'int-link-btn') + '">';
			html += linkList[i].name;
			if (isMobile) html += '</button>';
			html += '</a>';
			if (isMobile) html += '</div>';
		}

		return html;
	}

	// +++++++++++ Mobile Handling +++++++++++
	if (isMobile) {
		// position of dialogs
		dialogTop = 0;
		dialogBottom = 0;

		// mobile setting: not allow page scrolling/scaling, fit device width
		$('head').prepend('<meta name="viewport" content="width=device-width, user-scalable=0, initial-scale=1.0" />');

		// indicating "mobile version" on head title
		$(document).attr("title", $(document).attr("title") + ' (' + getLocale("mobile_title") + ')');

		// map fitting the entire screen
		mapElseHeight = 0;

		// position of dialog close button
		$('#closeBg').addClass('close-bg-mob');

		// Content inserted into help dialog
		mobileHeaderStr = HKO_LOGO_IMG_URL_M;
		mobileHeaderStr += '<h1 class="title-label-mob">' + getLocale("htmltitle") + '</h1>';
		mobileHeaderStr += '<div class="mb-lang-bar"></div>';
		mobileFooterStr = '<div class="mb-footer-bar"></div>';
		if (isWidget) {
			$("#mapHelp").hide();
			$("#mapRefresh").hide();
		} else {
			$('#hpDialog').prepend(mobileHeaderStr);
		}
		$('#hpDialog').append(initExtLinks());
		$('#hpDialog').append(mobileFooterStr);

		$('.ext-link-btn').css('font-size', '16px');
		$('.int-link-btn').css('font-size', '16px');

		// Langauge bar & Footer bar
		currentLocale.setLangBar(".mb-lang-bar", "index");
		setFooterBar(".mb-footer-bar");

		// forecast time label
		$('#map').append('<div id="aniTimeLabel"></div>');

		// the theme of animation control panel
		$('#aniCtrl').addClass('ani-ctrl-mob');
		$('#aniTimeLabel').addClass(isWidget ? "ani-time-label-wid" : "ani-time-label-mob");
		$('.ani-slider-border').css("left", "30px");
		$('.ani-slider-border').css("width", "calc(100% - 60px)");
		$('.ani-slider-border').css("margin-top", "15px");

		// map ctrl buttons
		$('#mapBtnGrp').addClass('map-btn-grp-mob');

		// title of time series panel
		$('#tsTitle').css('font-size', '16px');
		$('#tsTitle').css('font-weight', 'normal');

		// unit label
		$('#aniUnit').addClass(isWidget ? 'ani-unit-wid' : 'ani-unit-mob');

		$('body').css("font-weight", isWidget ? "normal" : "200");
		$('.all-dialog h1').css("font-weight", "inherit");

		// content of help dialog
		$('#hpContent').css("padding", "10px 10px 20px 10px");
	} else {
		if (isTablet) {
			$('head').prepend('<meta name="viewport" content="user-scalable=0" />');
		}

		// position of dialogs
		dialogTop = 10;
		dialogBottom = 10;

		// Header bar & Footer bar
		$('.title-bar').show();
		$('.footer-bar').show();
		currentLocale.setLangBar(".lang-bar", "index");
		setFooterBar(".footer-bar");
		$(".lang-bar").prepend(helpBtnStr + ' | ');
		$(".lang-bar").append('<br />' + initExtLinks());
		$(".title-img").html(HKO_LOGO_IMG_URL_M);
		$(".title-bar").append("<div class='title-label-desk'>" + getLocale("htmltitle") + "</div>");
		$(".title-bar").css("font-size", getLocale("title_fontsize"));

		/*$("body").append('<div id="urlDialog"></div>');
		$('#urlDialog').append(initExtLinks());
		$('#urlMenu').hover(function() {
			$('#urlDialog').show();
		}, function() {
			//$('#urlDialog').hide();
		});

		$('#urlDialog').hover(function() {

		}, function() {
			$('#urlDialog').hide();
		});*/

		// map fitting the entire screen
		mapElseHeight = 92;

		// map ctrl buttons
		$("#mapHelp").hide();
		$('#mapBtnGrp').addClass('map-btn-grp-desk');
		$('#mapBtnGrp button').each(function(index) {
			$(this).css("width", "35px");
			$(this).css("height", "35px");
		});

		// title of time series panel
		$('#tsTitle').css('font-size', '22px');
		$('#tsTitle').css('font-weight', 'bold');

		// position of dialog close button
		$('#closeBg').addClass('close-bg-desk');

		// unit label
		$('#aniUnit').addClass('ani-unit-desk');

		// forecast time label
		$('#aniCtrl').prepend('<div id="aniTimeLabel"></div>');

		// the theme of animation control panel
		$('#aniCtrl').addClass('ani-ctrl-desk');

		$('#aniTimeLabel').addClass("ani-time-label-desk");

		// time status label
		$("#aniTimeStatus").html(getLocale('remain_time0') + '<br />' + getLocale('remain_time1'));
	}

	$('#popBg').click(function() {
		clickAButton('#closeBg');
	});

	$(".ext-link-btn").addClass('do-not-touch');
	$(".ext-link-btn").button({
        icons: {
            primary: "ui-icon-extlink"
        }
    });
	$(".int-link-btn").addClass('do-not-touch');
	$(".int-link-btn").button({
        icons: {
            primary: "ui-icon-arrowthick-1-e"
        }
    });

	if (isMobile || isTablet) {
		// dialogs made wider to utilize as much space as possible
		$('.all-dialog').each(function(index) {
			$(this).css('width', '100%');
			$(this).css('left', '0');
			$(this).css('-webkit-overflow-scrolling', 'touch');
			if (!isWidget) {
				$(this).css('overflow-y', 'auto');
			}
		});
	}

	$('#tsCrTitle').text(getLocale("cr_panel"));
	$('.all-dialog').css('top', dialogTop + 'px');

	lgMap.ncrf = [];
	for (var i = 1; i < NCRF_R.length; ++i) {
		lgMap.ncrf.push('rgb('+NCRF_R[i]+', '+NCRF_G[i]+', '+NCRF_B[i]+')');
	}
	lgMap.ncrfLbl = ['0.5', '2.5', '5', '10', '20', '']; //['0.5', '10', '20', '30', '50', ''];

	prepareEleGrp();
}
